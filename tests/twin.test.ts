import { describe, expect, it } from "vitest";
import { brandsOf, modelById, shopModels, wattsFactorOf } from "../src/sim/10-catalog/hardware";
import { presetPrice } from "../src/sim/10-catalog/parts";
import { newGame, type GameState } from "../src/sim/50-state";
import { deviceHealth, freeSlots, nodesOf, rackPower, working } from "../src/sim/60-infra/status";
import { usedModels } from "../src/sim/80-business/used";
import { deliverListing } from "../src/sim/90-actions/used";
import { connect, mountDevice, moveInRack, sellDevice, shipStock, unmountDevice } from "../src/sim/90-actions/hardware";
import { provisionService } from "../src/sim/90-actions/clusters";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, skipTo, withServer } from "./fixtures";
import type { Listing } from "../src/sim/10-catalog/used";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);

function game(): GameState {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  skipTo(s, 2008);
  return s;
}
// A Twin 2U bought into the basement and mounted at U3 with both power supplies plugged in.
function twin(s: GameState) {
  const id = ok(buyDevice(s, "g2-twin", "SuperMacro", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 3));
  for (const c of s.devices.find((d) => d.id === id)!.components) if (c.kind === "psu") c.plugged = true;
  return { id, nodes: nodesOf(s, id).map((d) => d.id) };
}
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const fail = (s: GameState, id: string, kind: string, count = 1) => {
  for (const c of dev(s, id).components.filter((x) => x.kind === kind).slice(0, count)) c.failedAt = s.hour;
};

describe("Twin 2U catalog", () => {
  it("comes from SuperMacro and Dwell from 2008 at 0.6 the price and 0.8 the power of a 1U per node", () => {
    const chassis = modelById("g2-twin"), node = modelById("g2-twin-node"), oneU = modelById("g2-compute");
    expect(chassis).toMatchObject({ kind: "chassis", height: 2, psus: 2, name: "Twin 2U G2", nodes: { model: "g2-twin-node", count: 4 } });
    expect(brandsOf(chassis)).toEqual(["Dwell", "SuperMacro"]);
    expect(node).toMatchObject({ kind: "server", height: 0, chassis: "g2-twin", price: Math.round(oneU.price * 0.6), watts: Math.round(oneU.watts * 0.8) });
    expect(presetPrice(chassis, 2008, "Dwell")).toBe(4 * presetPrice(node, 2008, "Dwell"));
    expect(shopModels(2005).some((m) => m.id.includes("twin"))).toBe(false);
    expect(shopModels(2008).filter((m) => m.id.includes("twin")).map((m) => m.id)).toEqual(["g2-twin"]);
  });
});

describe("Twin 2U purchase and mounting", () => {
  it("creates one chassis and four nodes that take 2U together", () => {
    const s = game(), cash = s.cash;
    const { id, nodes } = twin(s);
    expect(cash - s.cash).toBe(presetPrice(modelById("g2-twin"), 2008, "SuperMacro"));
    expect(nodes).toHaveLength(4);
    expect(dev(s, id).components.map((c) => c.kind).sort()).toEqual(["fan", "fan", "fan", "fan", "psu", "psu"]);
    for (const n of nodes) {
      expect(dev(s, n)).toMatchObject({ chassisId: id, rackId: "rack2", slot: 3, price: 0 });
      expect(dev(s, n).components.map((c) => c.kind)).not.toContain("psu");
      expect(dev(s, n).components.map((c) => c.kind)).toEqual(expect.arrayContaining(["cpu", "ram", "hdd", "nic", "board"]));
      expect(working(s, n)).toBe(true);
    }
    expect(freeSlots(s, "rack2", 1)).not.toContain(3);
    expect(freeSlots(s, "rack2", 1)).not.toContain(4);
    expect(rackPower(s, "rack2").watts).toBeCloseTo(108 + 4 * modelById("g2-twin-node").idleWatts * wattsFactorOf(modelById("g2-twin-node"), "SuperMacro"));
  });

  it("moves, unmounts, ships and sells as one unit", () => {
    const s = game(), { id, nodes } = twin(s);
    expect(err(mountDevice(s, nodes[0], "rack2", 10))).toBe("error.inChassis");
    expect(err(sellDevice(s, nodes[0]))).toBe("error.inChassis");
    for (const c of dev(s, id).components) if (c.kind === "psu") c.plugged = false;
    ok(moveInRack(s, id, 8));
    expect(nodes.map((n) => dev(s, n).slot)).toEqual([8, 8, 8, 8]);
    ok(unmountDevice(s, id));
    expect(nodes.map((n) => dev(s, n).store)).toEqual(["loc1", "loc1", "loc1", "loc1"]);
    expect(err(shipStock(s, [nodes[1]], "loc1"))).toBe("error.inChassis");
    const cash = s.cash;
    ok(sellDevice(s, id));
    expect(s.devices.some((d) => d.id === id || nodes.includes(d.id))).toBe(false);
    expect(s.cash).toBeGreaterThan(cash);
  });
});

describe("shared power supplies and fans", () => {
  it("downs all four nodes when the shared supplies fail", () => {
    const s = game(), { id, nodes } = twin(s);
    fail(s, id, "psu");
    expect(nodes.every((n) => working(s, n))).toBe(true);
    fail(s, id, "psu", 2);
    expect(nodes.some((n) => working(s, n))).toBe(false);
    expect(nodes.map((n) => deviceHealth(s, n).state)).toEqual(["down", "down", "down", "down"]);
    expect(rackPower(s, "rack2").watts).toBe(108);
  });

  it("downs all four nodes when a fan of the shared wall fails", () => {
    const s = game(), { id, nodes } = twin(s);
    fail(s, id, "fan");
    expect(nodes.some((n) => working(s, n))).toBe(false);
  });

  it("keeps the other nodes up when one node fails", () => {
    const s = game(), { nodes } = twin(s);
    fail(s, nodes[0], "ram");
    expect(nodes.map((n) => working(s, n))).toEqual([false, true, true, true]);
  });
});

describe("Twin nodes as servers", () => {
  it("joins nodes into a cluster", () => {
    const s = game(), { nodes } = twin(s);
    const cluster = hypervisor(s, nodes.slice(0, 2), "Twin");
    expect(s.clusters.find((c) => c.id === cluster)!.nodes.map((n) => n.deviceId)).toEqual(nodes.slice(0, 2));
  });

  it("rents a node as a dedicated server", () => {
    const s = game(), { id, nodes } = twin(s), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    ok(connect(s, { device: nodes[0], port: 0 }, { device: "dev4", port: 3 }));
    // The basement server may take the first one.
    const hosts = [ok(provisionService(s, cus, "dedicated", { label: "one" })), ok(provisionService(s, cus, "dedicated", { label: "two" }))]
      .flatMap((v) => workloadsOf(s, v).map((w) => w.deviceId));
    expect(hosts).toContain(nodes[0]);
    expect(err(unmountDevice(s, id))).toBe("error.serverInUse");
  });
});

describe("used Twin lots", () => {
  it("lists the chassis, never a node alone, and delivers it with four aged nodes", () => {
    expect(usedModels(2010).some((m) => m.id === "g2-twin")).toBe(true);
    expect(usedModels(2010).some((m) => m.chassis)).toBe(false);
    const s = game();
    skipTo(s, 2);
    const lot: Listing = { id: "used1", channel: "board", model: "g2-twin", brand: "Dwell", qty: 1, age: 2, wear: [], defect: null, price: 3000, city: "Frankfurt", shipDays: 2, postedAt: s.hour, expiresAt: s.hour + 100 };
    const [id] = deliverListing(s, lot, "loc1", 3000);
    const nodes = nodesOf(s, id);
    expect(nodes).toHaveLength(4);
    expect(dev(s, id)).toMatchObject({ price: 3000, used: true });
    for (const n of nodes) expect(n).toMatchObject({ used: true, transitTo: "loc1", price: 0 });
    expect(nodes[0].components[0].installedAt).toBeLessThan(s.hour - 8760);
  });
});

describe("old saves", () => {
  it("load with every device outside a chassis", () => {
    const s = game(), data = JSON.parse(serialize(s));
    for (const d of data.devices) delete d.chassisId;
    expect(deserialize(JSON.stringify(data)).devices.every((d) => d.chassisId === null)).toBe(true);
  });
});
