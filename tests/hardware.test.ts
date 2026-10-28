import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { GENERATIONS } from "../src/sim/10-catalog/economy";
import { MODELS, modelById, shopModels } from "../src/sim/10-catalog/hardware";
import { newGame, type GameState } from "../src/sim/50-state";
import { freeSlots, linkStatus, portPeers } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { buyDevice, connect, disconnect, removeDevice, rentRack, setBond, setPortGroup } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";

const atYear = (year: number, cash = 1_000_000): GameState => ({ ...newGame(1), hour: hourOf(new Date(Date.UTC(year, 0, 1))), cash });
const ok = (r: ReturnType<typeof buyDevice>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof buyDevice>) => (r.ok ? "ok" : r.error);
const handoffOf = (s: GameState, rackId: string) => s.devices.find((d) => d.rackId === rackId && d.model === "handoff")!.id;

describe("catalog", () => {
  it("has unique ids and sane numbers", () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    for (const m of MODELS) {
      expect(m.idleWatts).toBeLessThanOrEqual(m.watts);
      expect(m.ports.length).toBeGreaterThan(0);
    }
    expect(() => modelById("nope")).toThrow();
  });
  it("scales servers from the generation row", () => {
    const g1 = modelById("g1-compute");
    expect(g1.server).toMatchObject({ cores: 2, ramGb: 8, maxRamGb: 16, diskGb: 500, disk: "HDD" });
    expect([g1.price, g1.watts, g1.idleWatts, g1.ports[0]]).toEqual([2500, 250, 100, { media: "rj45", gbit: 1 }]);
    expect(modelById("g1-compute-2psu")).toMatchObject({ price: 2750, psus: 2 });
    expect(modelById("g3-compute").ports[0]).toEqual({ media: "sfp", gbit: 10 });
    expect(modelById("g5-compute").ports[0].gbit).toBe(25);
    expect(modelById("g7-highmem")).toMatchObject({ height: 2, price: 12100, ports: expect.arrayContaining([{ media: "sfp", gbit: 100 }]) });
    expect(modelById("g6-arm").server!.arch).toBe("arm");
    expect(MODELS.filter((m) => m.id.endsWith("-arm")).map((m) => m.from)).toEqual([2020, 2023]);
    expect(MODELS.some((m) => m.id === "g1-highmem")).toBe(false);
    expect(GENERATIONS[6].cores).toBe(128);
  });
  it("sells each generation until two generations later and never sells gateways", () => {
    const ids = (y: number) => shopModels(y).map((m) => m.id);
    expect(ids(2005)).toEqual(expect.arrayContaining(["tower", "g1-compute", "sw-8", "sw-24", "patch-24"]));
    expect(ids(2005)).not.toContain("home-router");
    expect(ids(2005)).not.toContain("handoff");
    expect(ids(2010)).toEqual(expect.arrayContaining(["tower", "g1-compute", "g2-compute"]));
    expect(ids(2011)).not.toContain("tower");
    expect(ids(2011)).not.toContain("g1-compute");
    expect(ids(2026)).toEqual(expect.arrayContaining(["g6-compute", "g7-compute", "sw-24", "sw-32c"]));
  });
});

describe("new game", () => {
  it("starts with the tower online on the basement shelf", () => {
    const s = newGame(3);
    expect(s.locations).toEqual([{ id: "loc1", kind: "basement", city: "Frankfurt", name: "Basement" }]);
    const tower = s.devices.find((d) => d.model === "tower")!;
    expect(tower.name).toBe("fra1-srv-01");
    expect(linkStatus(s, tower.id)).toEqual({ online: true, gbit: 1, warning: null });
    expect(freeSlots(s, "rack2", 1)).toEqual([2, 3]);
    expect(portPeers(s, tower.id)).toEqual([{ device: "dev4", port: 0 }]);
  });
});

describe("rentRack", () => {
  it("rents a 42U rack with a handoff on top and reuses the city's location", () => {
    const s = atYear(2005);
    const r1 = ok(rentRack(s, "Frankfurt"));
    const r2 = ok(rentRack(s, "Frankfurt"));
    const rented = s.locations.filter((l) => l.kind === "rented");
    expect(rented).toHaveLength(1);
    expect(s.racks.find((r) => r.id === r1)).toMatchObject({ units: 42, shelf: false, rentPerMonth: 2520, name: "fra2-rack-01" });
    expect(s.racks.find((r) => r.id === r2)!.name).toBe("fra2-rack-02");
    expect(s.devices.find((d) => d.id === handoffOf(s, r1))).toMatchObject({ slot: 42, name: "fra2-gw-01" });
    expect(freeSlots(s, r1, 2).at(-1)).toBe(40);
  });
  it("rejects an unknown city and too little cash", () => {
    expect(err(rentRack(atYear(2005), "Atlantis"))).toBe("error.unknownCity");
    expect(err(rentRack(atYear(2005, 100), "Paris"))).toBe("error.noCash");
  });
});

describe("buyDevice", () => {
  it("places the device, pays for it and books it", () => {
    const s = atYear(2005, 10_000);
    const rack = ok(rentRack(s, "Berlin"));
    const id = ok(buyDevice(s, "g1-compute", rack, 1, "SuperMacro"));
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ slot: 1, brand: "SuperMacro", name: "ber1-srv-01", bond: "failover", groups: [] });
    expect(s.cash).toBe(7500);
    expect(s.ledger).toEqual([{ hour: s.hour, category: "hardware", key: "ledger.hardware", params: { model: "Compute 1U G1", device: "ber1-srv-01" }, amount: -2500 }]);
    expect(ok(buyDevice(newGame(1), "sw-8", "rack2", 2))).toBeTruthy();
  });
  it("rejects every invalid purchase", () => {
    const s = atYear(2005);
    const rack = ok(rentRack(s, "Berlin"));
    ok(buyDevice(s, "g1-storage", rack, 5));
    expect(err(buyDevice(s, "g2-compute", rack, 1))).toBe("error.notInShop");
    expect(err(buyDevice(s, "home-router", "rack2", 2))).toBe("error.notInShop");
    expect(err(buyDevice(s, "g1-compute", "nope", 1))).toBe("error.unknownRack");
    expect(err(buyDevice(s, "tower", rack, 1))).toBe("error.needsShelf");
    expect(err(buyDevice(s, "g1-compute", "rack2", 2))).toBe("error.needsRack");
    expect(err(buyDevice(s, "g1-storage", rack, 42))).toBe("error.outOfBounds");
    expect(err(buyDevice(s, "g1-compute", rack, 0))).toBe("error.outOfBounds");
    expect(err(buyDevice(s, "g1-compute", rack, 6))).toBe("error.slotTaken");
    expect(err(buyDevice(s, "g1-storage", rack, 4))).toBe("error.slotTaken");
    expect(err(buyDevice(s, "g1-compute", rack, 1, "Appel"))).toBe("error.unknownBrand");
    s.cash = 10;
    expect(err(buyDevice(s, "g1-compute", rack, 1))).toBe("error.noCash");
  });
});

describe("removeDevice", () => {
  it("removes the device and its cables without a refund", () => {
    const s = newGame(1);
    ok(removeDevice(s, "dev3"));
    expect(s.devices.map((d) => d.id)).toEqual(["dev4"]);
    expect(s.cables).toEqual([]);
    expect(s.cash).toBe(5000);
    expect(err(removeDevice(s, "dev3"))).toBe("error.unknownDevice");
    expect(err(removeDevice(s, "dev4"))).toBe("error.cannotRemove");
  });
});

describe("connect", () => {
  it("picks copper, DAC or fiber", () => {
    const s = atYear(2011);
    const a = ok(rentRack(s, "Paris"));
    const b = ok(rentRack(s, "Paris"));
    const srv = ok(buyDevice(s, "g3-compute", a, 1));
    const swA = ok(buyDevice(s, "sw-48", a, 41));
    const swB = ok(buyDevice(s, "sw-48", b, 41));
    const kind = (r: ReturnType<typeof connect>) => s.cables.find((c) => c.id === ok(r))!.kind;
    expect(kind(connect(s, { device: swA, port: 0 }, { device: handoffOf(s, a), port: 0 }))).toBe("copper");
    expect(kind(connect(s, { device: srv, port: 0 }, { device: swA, port: 48 }))).toBe("dac");
    expect(kind(connect(s, { device: swA, port: 49 }, { device: swB, port: 48 }))).toBe("fiber");
  });
  it("rejects every invalid cable", () => {
    const s = atYear(2011);
    const a = ok(rentRack(s, "Paris"));
    const srv = ok(buyDevice(s, "g3-compute", a, 1));
    const sw = ok(buyDevice(s, "sw-48", a, 41));
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 48 }));
    expect(err(connect(s, { device: "x", port: 0 }, { device: sw, port: 1 }))).toBe("error.unknownDevice");
    expect(err(connect(s, { device: srv, port: 9 }, { device: sw, port: 1 }))).toBe("error.unknownPort");
    expect(err(connect(s, { device: sw, port: 2 }, { device: sw, port: 1 }))).toBe("error.sameDevice");
    expect(err(connect(s, { device: srv, port: 0 }, { device: sw, port: 49 }))).toBe("error.portInUse");
    expect(err(connect(s, { device: sw, port: 0 }, { device: "dev4", port: 1 }))).toBe("error.otherLocation");
    expect(err(connect(s, { device: srv, port: 1 }, { device: sw, port: 0 }))).toBe("error.mediaMismatch");
    const sw24 = ok(buyDevice(s, "sw-24", a, 40));
    expect(err(connect(s, { device: srv, port: 1 }, { device: sw24, port: 24 }))).toBe("error.speedMismatch");
  });
  it("disconnects", () => {
    const s = newGame(1);
    ok(disconnect(s, "cab5"));
    expect(linkStatus(s, "dev3").online).toBe(false);
    expect(err(disconnect(s, "cab5"))).toBe("error.unknownCable");
  });
});

describe("linkStatus", () => {
  it("goes online through a switch", () => {
    const s = atYear(2005);
    const rack = ok(rentRack(s, "Vienna"));
    const srv = ok(buyDevice(s, "g1-compute", rack, 1));
    const sw = ok(buyDevice(s, "sw-24", rack, 41));
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 0 }));
    expect(linkStatus(s, srv).online).toBe(false);
    ok(connect(s, { device: sw, port: 23 }, { device: handoffOf(s, rack), port: 1 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: null });
    expect(linkStatus(s, sw).online).toBe(true);
  });
  it("goes online through a patch panel in another rack, front to back", () => {
    const s = atYear(2005);
    const a = ok(rentRack(s, "Zurich"));
    const b = ok(rentRack(s, "Zurich"));
    const sw = ok(buyDevice(s, "sw-24", a, 41));
    ok(connect(s, { device: sw, port: 0 }, { device: handoffOf(s, a), port: 0 }));
    const srv = ok(buyDevice(s, "g1-compute", b, 1));
    const pp = ok(buyDevice(s, "patch-24", b, 41));
    ok(connect(s, { device: srv, port: 0 }, { device: pp, port: 3 }));
    ok(connect(s, { device: pp, port: 4 }, { device: sw, port: 5 }));
    expect(linkStatus(s, srv).online).toBe(false);
    ok(connect(s, { device: pp, port: 27 }, { device: sw, port: 6 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: null });
  });
  it("adds up a grouped balance bond and warns when the switch ports are not grouped", () => {
    const s = atYear(2005);
    const rack = ok(rentRack(s, "Milan"));
    const srv = ok(buyDevice(s, "g1-compute", rack, 1));
    const sw = ok(buyDevice(s, "sw-24", rack, 41));
    ok(connect(s, { device: sw, port: 23 }, { device: handoffOf(s, rack), port: 0 }));
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 0 }));
    ok(connect(s, { device: srv, port: 1 }, { device: sw, port: 1 }));
    expect(linkStatus(s, srv).gbit).toBe(1);
    ok(setBond(s, srv, "balance"));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: "bondNotGrouped" });
    ok(setPortGroup(s, sw, [1, 0]));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 2, warning: null });
  });
});

describe("setBond and setPortGroup", () => {
  it("rejects non-servers for bonds", () => {
    const s = newGame(1);
    expect(err(setBond(s, "dev4", "balance"))).toBe("error.notServer");
    expect(err(setBond(s, "x", "balance"))).toBe("error.unknownDevice");
  });
  it("replaces overlapping groups, clears with one port or none, and validates", () => {
    const s = atYear(2005);
    const rack = ok(rentRack(s, "London"));
    const sw = ok(buyDevice(s, "sw-24", rack, 1));
    const groups = () => s.devices.find((d) => d.id === sw)!.groups;
    ok(setPortGroup(s, sw, [0, 1]));
    ok(setPortGroup(s, sw, [4, 5, 6]));
    ok(setPortGroup(s, sw, [1, 2]));
    expect(groups()).toEqual([[4, 5, 6], [1, 2]]);
    ok(setPortGroup(s, sw, [5]));
    expect(groups()).toEqual([[1, 2]]);
    ok(setPortGroup(s, sw, []));
    expect(groups()).toEqual([]);
    expect(err(setPortGroup(s, sw, [0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe("error.groupSize");
    expect(err(setPortGroup(s, sw, [0, 99]))).toBe("error.unknownPort");
    expect(err(setPortGroup(s, handoffOf(s, rack), [0, 1]))).toBe("error.notSwitch");
    expect(err(setPortGroup(s, "x", [0, 1]))).toBe("error.unknownDevice");
  });
});

describe("monthly bills", () => {
  it("accrues basement power hourly and pays power and rent on the first of the month", () => {
    const s = newGame(1);
    rentRack(s, "Frankfurt");
    const events = [];
    for (let h = 0; h < 24 * 31; h++) events.push(...tick(s));
    // Tower 60 W and router 10 W idle, 744 h at 9 ct × 1.6.
    const power = Math.round(0.07 * 744 * 0.09 * 1.6 * 100) / 100;
    expect(power).toBe(7.5);
    expect(s.cash).toBe(5000 - 2520 - power);
    expect(s.powerDue).toBe(0);
    expect(s.ledger.map((l) => [l.category, l.amount])).toEqual([["power", -power], ["rent", -2520]]);
    expect(events).toContainEqual({ app: "Finance", key: "event.bills", params: { power, rent: 2520, total: 2520 + power } });
  });
});

describe("hardware save", () => {
  it("round-trips racks, devices and cables", () => {
    const s = atYear(2005);
    const rack = ok(rentRack(s, "Amsterdam"));
    ok(buyDevice(s, "g1-compute", rack, 1));
    for (let h = 0; h < 50; h++) tick(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("gives a save from before hardware the starting basement", () => {
    const old = deserialize(JSON.stringify({ seed: 4, hour: 5000, cash: 1234 }));
    expect(old.cash).toBe(1234);
    expect(old.devices.map((d) => d.model)).toEqual(["tower", "home-router"]);
    expect(old.nextId).toBe(6);
    expect(linkStatus(old, "dev3").online).toBe(true);
    expect(ok(buyDevice(old, "sw-8", "rack2", 2))).toBe("dev6");
  });
});
