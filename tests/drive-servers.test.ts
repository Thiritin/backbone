import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { favoursLeft, FRIEND_FEE, TRAVEL } from "../src/sim/60-infra/handwork";
import { locationOf } from "../src/sim/60-infra/status";
import { addLocation, buyRack, moveServer, MOVE_INSTALL_HOURS } from "../src/sim/90-actions/hardware";
import { drive, travelTo } from "../src/sim/90-actions/travel";
import { buyDevice, hypervisor, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;

// Two basement servers in one cluster, the player at home, and a datacenter in the home city with an empty rack.
function world() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  const cluster = hypervisor(s, ["dev3", second], "Home");
  const dc = ok(addLocation(s, "interaction-fra", "cage", 4));
  for (const l of s.locations) l.readyAt = 0;
  ok(buyRack(s, dc, "rack-42", 1));
  for (const r of s.racks) r.arriveAt = null;
  return { s, servers: ["dev3", second], cluster, dc };
}
const keys = (s: { ledger: { key: string }[] }, from: number) => s.ledger.slice(from).map((l) => l.key);

describe("driving servers to a datacenter", () => {
  it("charges the drive fare only and racks the whole cluster on arrival", () => {
    const { s, servers, cluster, dc } = world();
    const cash = s.cash, hour = s.hour, lines = s.ledger.length, fare = drive(s, dc)!;
    expect(fare.fee).toBe(TRAVEL.city.fee);
    ok(moveServer(s, servers, dc, "self"));
    expect(s.cash).toBe(cash - TRAVEL.city.fee);
    expect(keys(s, lines)).toEqual(["ledger.drive"]);
    expect(servers.map((id) => locationOf(s, s.devices.find((d) => d.id === id)!)!.id)).toEqual([dc, dc]);
    expect(s.clusters.find((c) => c.id === cluster)!.az).toBe(s.locations.find((l) => l.id === dc)!.az);
    expect(s.clusters.find((c) => c.id === cluster)!.name).toBe("Home");
    const work = s.player.until - hour - fare.hours;
    expect(work).toBeGreaterThanOrEqual(2 * MOVE_INSTALL_HOURS.min);
    expect(work).toBeLessThanOrEqual(2 * MOVE_INSTALL_HOURS.max);
    expect(s.player.at).toBe(dc);
    for (const id of servers) expect(s.devices.find((d) => d.id === id)!.maintenance!.doneAt).toBe(s.player.until);
  });

  it("renames a cluster named after the basement to the datacenter it moves to", () => {
    const { s, dc } = world();
    const own = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, own, "rack2", 4));
    const cluster = hypervisor(s, [own]);
    expect(s.clusters.find((c) => c.id === cluster)!.name).toBe("Basement 1");
    ok(moveServer(s, own, dc, "self"));
    expect(s.clusters.find((c) => c.id === cluster)!.name).toBe(`${s.locations.find((l) => l.id === dc)!.name} 1`);
  });

  it("needs the player at the servers, the whole cluster and no burn-in", () => {
    const { s, servers, dc } = world();
    expect(err(moveServer(s, servers[0], dc, "self"))).toBe("error.clusterSpans");
    s.devices.find((d) => d.id === servers[1])!.burnin = { until: s.hour + 5, full: false };
    expect(err(moveServer(s, servers, dc, "self"))).toBe("error.burninRunning");
    s.devices.find((d) => d.id === servers[1])!.burnin = null;
    ok(travelTo(s, dc));
    s.hour = s.player.until;
    expect(err(moveServer(s, servers, dc, "self"))).toBe("error.notThere");
    expect(err(moveServer(s, [], dc, "self"))).toBe("error.emptyShipment");
  });

  it("lets a friend take the load from home for one favour", () => {
    const { s, servers, dc } = world();
    const cash = s.cash, lines = s.ledger.length, left = favoursLeft(s);
    ok(moveServer(s, servers, dc, "friend"));
    expect(s.cash).toBe(cash - FRIEND_FEE);
    expect(keys(s, lines)).toEqual(["ledger.friend"]);
    expect(favoursLeft(s)).toBe(left - 1);
    expect(locationOf(s, s.devices.find((d) => d.id === servers[1])!)!.id).toBe(dc);
  });
});
