import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import { access, HALL } from "../src/sim/20-world/properties";
import type { Facing } from "../src/sim/20-world/layout";
import type { HallItemKind } from "../src/sim/50-state";
import { powerByLocation } from "../src/sim/88-tick/tick";
import { airflow, coolingKw, rackDelta } from "../src/sim/60-infra/airflow";
import { gridOutage, hallBackupMinutes } from "../src/sim/60-infra/incidents";
import { hotSpot } from "../src/sim/60-infra/thermal";
import { unmaintained } from "../src/sim/90-actions/hall";
import { buyDevice, buyRack, mountDevice } from "../src/sim/90-actions/hardware";
import { customer, ok, ownHall, rack as placeRack, type OwnHall } from "./own-dc-hall";

type T = { x: number; y: number; facing: Facing };
// Lays a hall by hand: the validator is not under test here. Customers are racks of a set draw.
function lay(e: OwnHall, o: { cracs?: [number, number][]; vents?: [number, number][]; contain?: [number, number][]; racks?: (T & { kw?: number })[] }) {
  const h = e.hall(), mk = (kind: HallItemKind, x: number, y: number, area: "hall" | "xfmr" | "battery" = "hall", facing: Facing = "n") =>
    ({ id: `${kind}${x}_${y}`, kind, area, x, y, facing, price: 0, builtAt: 0 });
  h.items = [...h.items.filter((i) => i.area !== "hall" || (i.kind !== "crac" && i.kind !== "vent" && i.kind !== "containment")),
    ...(o.cracs ?? []).map(([x, y]) => mk("crac", x, y)), ...(o.vents ?? []).map(([x, y]) => mk("vent", x, y)), ...(o.contain ?? []).map(([x, y]) => mk("containment", x, y))];
  h.zones = [];
  h.customers = (o.racks ?? []).map((r, i) => customer(e, i, { x: r.x, y: r.y, facing: r.facing }, null, r.kw ?? 3));
}
const loc = (e: OwnHall) => e.s.locations.find((l) => l.id === e.hallId)!;
const af = (e: OwnHall) => airflow(e.s, loc(e));
// Two runs of ten 3 kW racks facing each other across a vent line at y = 3.
const twoRuns = (kw = 3) => [...Array.from({ length: 10 }, (_, x) => ({ x, y: 2, facing: "s" as Facing, kw })), ...Array.from({ length: 10 }, (_, x) => ({ x, y: 4, facing: "n" as Facing, kw }))];
const ventLine = Array.from({ length: 10 }, (_, x) => [x, 3] as [number, number]);
const near: [number, number][] = [[4, 6], [6, 6]];

describe("own datacenter: airflow", () => {
  it("worked numbers: room cooling, vents, containment", () => {
    const e = ownHall();
    lay(e, { cracs: near, racks: twoRuns() });
    let a = af(e);
    expect([+a.efficiency.toFixed(1), +a.effective.toFixed(1), a.crac, a.hot]).toEqual([0.7, 56, 80, 0]);
    expect(a.load).toBe(60);
    expect(a.pue).toBeCloseTo(1.35, 5);
    expect(a.spots.every((p) => p.delta === 4)).toBe(true);
    lay(e, { cracs: near, vents: ventLine, racks: twoRuns() });
    a = af(e);
    expect([+a.efficiency.toFixed(1), +a.effective.toFixed(1), +a.pue.toFixed(2), a.hot]).toEqual([0.9, 72, 1.25, 0]);
    expect(a.spots.every((p) => p.delta === 0)).toBe(true);
    lay(e, { cracs: near, vents: ventLine, contain: ventLine, racks: twoRuns() });
    a = af(e);
    expect([+a.efficiency.toFixed(1), +a.effective.toFixed(1), +a.pue.toFixed(2), a.hot]).toEqual([1, 80, 1.2, 0]);
  });

  it("6 kW racks on room cooling run hot, a pair sharing a vent does not", () => {
    const e = ownHall();
    lay(e, { cracs: near, racks: [{ x: 2, y: 2, facing: "s", kw: 6 }, { x: 2, y: 4, facing: "n", kw: 6 }] });
    expect(af(e).spots.map((p) => p.delta)).toEqual([6, 6]);
    expect(af(e).hot).toBe(2);
    lay(e, { cracs: near, vents: [[2, 3]], racks: [{ x: 2, y: 2, facing: "s", kw: 6 }, { x: 2, y: 4, facing: "n", kw: 6 }] });
    expect(af(e).spots.map((p) => p.delta)).toEqual([0, 0]);
  });

  it("runs facing front to back recirculate: +6, hot, efficiency down 0.1", () => {
    const e = ownHall();
    const run = (y: number) => Array.from({ length: 5 }, (_, x) => ({ x, y, facing: "s" as Facing }));
    lay(e, { cracs: near, vents: [...Array.from({ length: 5 }, (_, x) => [x, 3] as [number, number]), ...Array.from({ length: 5 }, (_, x) => [x, 5] as [number, number])], racks: [...run(2), ...run(4)] });
    const a = af(e);
    expect(a.spots.filter((p) => p.recirc)).toHaveLength(5);
    expect(a.spots.filter((p) => p.recirc).every((p) => p.delta === 6)).toBe(true);
    expect(a.hot).toBe(5);
    expect(a.efficiency).toBeCloseTo(0.8, 5);
  });

  it("a vent beyond reach counts as room cooling; blocked exhaust adds 3; contained intake removes 2", () => {
    const e = ownHall();
    const one = (x: number, y: number, facing: Facing = "s") => [{ x, y, facing, kw: 3 }];
    lay(e, { cracs: [[0, 7]], vents: [[14, 7], [10, 0]], racks: one(14, 6) });
    expect(af(e).spots[0].fed).toBe(false);
    expect(af(e).spots[0].delta).toBe(4);
    expect(af(e).tones["14,7"]).toBe("room");
    expect(af(e).tones["10,0"]).toBe("ventIdle");
    lay(e, { cracs: [[1, 7]], vents: [[13, 7]], racks: one(13, 6) });
    expect(af(e).spots[0].fed).toBe(true);
    lay(e, { cracs: [[12, 5]], vents: [[13, 1]], racks: one(13, 0) });
    expect(af(e).spots[0].delta).toBe(3);
    lay(e, { cracs: [[12, 5]], vents: [[13, 4]], contain: [[13, 4]], racks: one(13, 3) });
    expect(af(e).spots[0].delta).toBe(-2);
  });

  it("efficiency stays at 0.5 or more and cooling follows the units and outages", () => {
    const e = ownHall();
    lay(e, { racks: [{ x: 2, y: 4, facing: "n" }, { x: 2, y: 6, facing: "n" }] });
    const a = af(e);
    expect(a.spots[1].recirc).toBe(true);
    expect(a.efficiency).toBeGreaterThanOrEqual(HALL.air.min);
    expect(a.effective).toBe(0);
    lay(e, { cracs: near, racks: twoRuns() });
    const now = e.s.hour * 60;
    e.s.ops = { ...e.s.ops, cooling: { [e.hallId]: e.s.hour + 2 } };
    expect(coolingKw(e.s, loc(e), now)).toBe(0);
    expect(coolingKw(e.s, loc(e), now + 180)).toBe(56);
  });

  it("customers and the exchange count by kW, a delivered rack is absent", () => {
    const e = ownHall();
    lay(e, { cracs: near, racks: [{ x: 2, y: 2, facing: "s", kw: 5 }] });
    e.hall().exchange = { id: "x1", tile: { x: 6, y: 2, facing: "s" } };
    expect(af(e).load).toBe(7);
    ok(buyRack(e.s, e.hallId, "rack-42", 15));
    expect(af(e).spots).toHaveLength(2);
  });

  it("is memoised per hour and recomputed after an edit", () => {
    const e = ownHall();
    lay(e, { cracs: near, racks: twoRuns() });
    const a = af(e);
    expect(af(e)).toBe(a);
    e.hall().items = [...e.hall().items, { id: "v", kind: "vent", area: "hall", x: 0, y: 3, facing: "n", price: 0, builtAt: 0 }];
    expect(af(e)).not.toBe(a);
    const b = af(e);
    e.s.hour += 1;
    expect(af(e)).not.toBe(b);
  });

  it("a hall rack's inlet and wear follow its delta", () => {
    const e = ownHall();
    e.s.player = { ...e.s.player, at: e.hallId };
    const id = placeRack(e, 13, 3);
    const dev = ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId));
    ok(mountDevice(e.s, dev, id, 1));
    const rack = e.s.racks.find((r) => r.id === id)!, d = e.s.devices.find((x) => x.id === dev)!;
    rack.tile = { x: 13, y: 0, facing: "s" };
    e.hall().items = e.hall().items.filter((i) => i.kind !== "crac");
    expect(rackDelta(e.s, rack)).toBe(4 + 3);
    expect(hotSpot(e.s, d)).toBe(true);
    rack.tile = { x: 13, y: 3, facing: "s" };
    expect(rackDelta(e.s, rack)).toBe(4);
    expect(hotSpot(e.s, d)).toBe(false);
  });

  it("the power bill is lower at PUE 1.2 than at 1.35", () => {
    const e = ownHall();
    e.s.player = { ...e.s.player, at: e.hallId };
    const id = placeRack(e, 2, 2), dev = ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId));
    ok(mountDevice(e.s, dev, id, 1));
    e.s.devices = e.s.devices.map((x) => ({ ...x, on: true }));
    lay(e, { cracs: near, racks: [] });
    const room = powerByLocation(e.s)[e.hallId];
    e.hall().items = [...e.hall().items, { id: "v", kind: "vent", area: "hall", x: 2, y: 3, facing: "n", price: 0, builtAt: 0 }, { id: "c", kind: "containment", area: "hall", x: 2, y: 3, facing: "n", price: 0, builtAt: 0 }];
    const best = powerByLocation(e.s)[e.hallId];
    expect(room.kwh).toBeGreaterThan(0);
    expect(best.kwh).toBe(room.kwh);
    expect(best.eur / room.eur).toBeCloseTo(1.2 / 1.35, 3);
  });
});

describe("own datacenter: backup power by capacity", () => {
  function backed(ups: number, batteries: number, generators: number, kw: number) {
    const e = ownHall("fechenhalle");
    lay(e, { racks: [{ x: 2, y: 2, facing: "s", kw }] });
    const add = (kind: HallItemKind, n: number) => { for (let i = 0; i < n; i++) e.hall().items.push({ id: `${kind}${i}`, kind, area: kind === "generator" ? "xfmr" : "battery", x: i, y: 0, facing: "s", price: 0, builtAt: 0 }); };
    add("ups", ups); add("battery", batteries); add("generator", generators);
    return e;
  }
  const dark = (e: OwnHall, minutes: number) => gridOutage(e.s, loc(e), minutes, createRng(1), []).dark;

  it("one UPS and two batteries bridge 60 minutes at 100 kW, and nothing at 160 kW", () => {
    const e = backed(1, 2, 0, 100);
    expect(hallBackupMinutes(e.s, e.hall(), 100)).toBe(60);
    expect(dark(e, 90)).toBe(30);
    expect(hallBackupMinutes(e.s, e.hall(), 160)).toBe(0);
    expect(hallBackupMinutes(e.s, e.hall(), 1)).toBe(HALL.backupMaxMin);
  });

  it("a 300 kW generator carries 250 kW after the bridge and not 350 kW; without a UPS it never starts", () => {
    expect(dark(backed(2, 3, 1, 250), 120)).toBe(0);
    expect(dark(backed(3, 3, 1, 350), 120)).toBe(Math.round(120 - hallBackupMinutes(backed(3, 3, 1, 350).s, backed(3, 3, 1, 350).hall(), 350)));
    expect(dark(backed(0, 0, 1, 100), 120)).toBe(120);
  });

  it("a 20-minute outage on a hall with the old upgrades is carried", () => {
    expect(dark(backed(4, 3, 2, 30), 20)).toBe(0);
  });
});

describe("own datacenter: unreachable backup gear", () => {
  it("a UPS, battery or generator without a way to its front gives half its capacity", () => {
    const e = ownHall("fechenhalle");
    for (const [kind, area] of [["ups", "battery"], ["battery", "battery"], ["generator", "xfmr"]] as const)
      e.hall().items.push({ id: `${kind}0`, kind, area, x: 0, y: 0, facing: "s", price: 0, builtAt: 0 });
    const full = hallBackupMinutes(e.s, e.hall(), 50);
    expect(full).toBe(60);
    access.cut = () => new Set(["battery0"]);
    try { expect(hallBackupMinutes(e.s, e.hall(), 50)).toBe(30); } finally { access.cut = (s, id) => new Set(unmaintained(s, id).map((r) => r.slice(5))); }
    access.cut = () => new Set(["ups0"]);
    try { expect(hallBackupMinutes(e.s, e.hall(), 100)).toBe(0); } finally { access.cut = (s, id) => new Set(unmaintained(s, id).map((r) => r.slice(5))); }
  });
});
