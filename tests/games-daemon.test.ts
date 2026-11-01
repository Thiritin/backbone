import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { POOL_SIZE, POOL_START, daemonBehind, nodeOf } from "../src/sim/60-infra/daemons";
import { gameOf } from "../src/sim/60-infra/games";
import { crashChance, gamesTick } from "../src/sim/85-products/games-tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addAllocation, removeAllocation, restartDaemon, updateDaemon } from "../src/sim/90-actions/games";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { targetFor } from "../src/sim/30-market/sales";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function node(title = "blockcraft", year = 2018) {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, year);
  const cluster = panelServer(s, two, "pterodaktyl"), customer = addCustomer(s, "Ada Lang", "hobbyDev");
  const add = (label: string, t = title) => ok(provisionService(s, customer, "gameServer", { label, spec: sizeSpec("gameServer", 0, year), clusterId: cluster, title: t }));
  const id = add("ada");
  s.hour += 24 * 40;
  gamesTick(s);
  return { s, id, add, key: nodeOf(s, id)!.key, cluster };
}

describe("node daemons", () => {
  it("exist for every node of a Pterodaktyl cluster and start online", () => {
    const { s, key } = node();
    expect(s.daemons[key]).toMatchObject({ state: "online" });
  });

  it("fail now and then, and their servers are unreachable until the daemon is back", () => {
    const { s, id, key } = node();
    let outages = 0, was = "online";
    for (let i = 0; i < 24 * 365 * 3; i++) {
      s.hour++;
      gamesTick(s);
      if (s.daemons[key].state === "offline" && was === "online") outages++;
      was = s.daemons[key].state;
    }
    expect(outages).toBeGreaterThan(0);
    expect(outages).toBeLessThan(30);
    s.daemons[key] = { state: "offline", version: s.daemons[key].version, since: s.hour };
    expect(serviceOnline(s, id)).toBe(false);
    for (let i = 0; i < 5; i++) { s.hour++; gamesTick(s); }
    expect(s.daemons[key].state).toBe("offline");
    s.hour++;
    gamesTick(s);
    expect(s.daemons[key].state).toBe("online");
  });

  it("come back at once when the player restarts them", () => {
    const { s, id, key } = node();
    s.daemons[key] = { ...s.daemons[key], state: "offline" };
    ok(restartDaemon(s, key));
    expect(s.daemons[key].state).toBe("online");
    expect(serviceOnline(s, id)).toBe(true);
    expect(restartDaemon(s, "dev999").ok).toBe(false);
  });

  it("double the crash chance more than one release behind until updated", () => {
    const { s, id, key, cluster } = node();
    const plain = crashChance(s, gameOf(s, id)!);
    s.daemons[key] = { ...s.daemons[key], version: s.clusters.find((c) => c.id === cluster)!.version - 2 };
    expect(daemonBehind(s, id)).toBe(true);
    expect(crashChance(s, gameOf(s, id)!)).toBeCloseTo(plain * 2);
    ok(updateDaemon(s, key));
    expect(daemonBehind(s, id)).toBe(false);
    expect(crashChance(s, gameOf(s, id)!)).toBeCloseTo(plain);
  });

  it("an old save without daemons gets them online", () => {
    const { s, key } = node();
    const old = JSON.parse(serialize(s));
    delete old.daemons;
    const back = deserialize(JSON.stringify(old));
    expect(back.daemons[key]).toMatchObject({ state: "online" });
  });
});

describe("port allocations", () => {
  it("give a game server one port and a title with a query port two", () => {
    const { s, id, add } = node("blockcraft", 2018);
    expect(gameOf(s, id)!.ports).toEqual([POOL_START]);
    const rost = add("rost", "rost");
    expect(gameOf(s, rost)!.ports).toEqual([POOL_START + 1, POOL_START + 2]);
  });

  it("can be added and removed, keeping the game port", () => {
    const { s, id } = node();
    ok(addAllocation(s, id));
    expect(gameOf(s, id)!.ports).toEqual([POOL_START, POOL_START + 1]);
    expect(removeAllocation(s, id, POOL_START + 1).ok).toBe(true);
    expect(removeAllocation(s, id, POOL_START).ok).toBe(false);
    expect(removeAllocation(s, id, 1).ok).toBe(false);
  });

  it("run out at a hundred, which refuses new servers and skips the node when placing", () => {
    const { s, id, cluster } = node();
    s.gameServers = s.gameServers.map((g) => (g.serviceId === id ? { ...g, ports: Array.from({ length: POOL_SIZE }, (_, i) => POOL_START + i) } : g));
    expect(addAllocation(s, id).ok).toBe(false);
    const city = s.locations[0].city;
    expect(targetFor(s, { city, product: "gameServer", spec: sizeSpec("gameServer", 0, 2018) })).toBeNull();
    const customer = addCustomer(s, "Bo Lang", "hobbyDev");
    const r = provisionService(s, customer, "gameServer", { label: "bo", spec: sizeSpec("gameServer", 0, 2018), clusterId: cluster });
    expect(r).toMatchObject({ ok: false, error: "error.noAllocation" });
    expect(s.services.filter((v) => v.label === "bo")).toEqual([]);
  });
});
