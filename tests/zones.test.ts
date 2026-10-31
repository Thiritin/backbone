import { describe, expect, it } from "vitest";
import { REGIONS, regionOf } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { storageStacks } from "../src/sim/60-infra/status";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, closeLocation, sellDevice, shipStock, unmountDevice } from "../src/sim/90-actions/hardware";
import { mountDevice, mountStack } from "./plugged";
import { buyCart, buyDevice, freeFloor } from "./fixtures";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 100_000 });
const ok = (r: ReturnType<typeof buyDevice>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof buyDevice>) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const az = (s: GameState, id: string) => s.locations.find((l) => l.id === id)!.az;
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};

describe("availability zones", () => {
  it("names each location after its region and the next number there", () => {
    expect(REGIONS.map((r) => r.id)).toEqual(["fra", "ams", "lon", "par", "ber", "mil", "vie", "zrh", "dus", "ker", "nue", "fsn", "muc", "ash", "nyc", "chi", "dfw", "lax"]);
    const s = rich();
    expect(az(s, "loc1")).toBe("fra1");
    const fr5 = ok(addLocation(s, "equinox-fr5", "share", 8));
    const lon = ok(addLocation(freeFloor(s), "tellyhouse-north", "cage", 4));
    const zrh = ok(addLocation(freeFloor(s), "greenchz-lupfig", "cage", 4));
    const fra3 = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
    expect([fr5, lon, zrh, fra3].map((id) => az(s, id))).toEqual(["fra2", "lon1", "zrh1", "fra3"]);
    expect(regionOf(s.locations.find((l) => l.id === zrh)!)).toEqual({ id: "zrh", name: "Zurich", city: "Zurich" });
    expect(s.devices.find((d) => d.panel === zrh)!.name).toBe("zrh1-gw-01");
    ok(closeLocation(s, lon));
    expect(az(s, ok(addLocation(freeFloor(s), "docklands-data", "suite", 20)))).toBe("lon1");
    expect(az(s, ok(addLocation(freeFloor(s), "mainqubes-fra", "cage", 4)))).toBe("fra4");
  });
});

describe("storage per zone", () => {
  it("delivers purchases to the chosen zone, ready or not", () => {
    const s = rich();
    const lon = ok(addLocation(freeFloor(s), "tellyhouse-north", "cage", 4));
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 2, lon));
    expect(dev(s, id)).toMatchObject({ store: lon, rackId: null, transitTo: null, arriveAt: null });
    expect(storageStacks(s, lon)[0].ids).toHaveLength(2);
    expect(storageStacks(s, "loc1")).toEqual([]);
    ok(buyCart(s, [{ model: "sw-8", brand: "Sysko", qty: 1 }], { kind: "cash" }, lon));
    expect(storageStacks(s, lon).map((x) => x.model)).toEqual(["g1-compute", "sw-8"]);
    expect(err(buyDevice(s, "g1-compute", "Dwell", 1, "nope"))).toBe("error.unknownLocation");
    expect(err(buyCart(s, [{ model: "sw-8", brand: "Sysko", qty: 1 }], { kind: "cash" }, "nope"))).toBe("error.unknownLocation");
  });
  it("mounts only units stored in the rack's zone", () => {
    const s = rich();
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    const rack = ok(buyRack(s, fr5, "rack-42", 1));
    const here = ok(buyDevice(s, "sw-8", "Sysko", 2, "loc1"));
    expect(err(mountDevice(s, here, rack, 1))).toBe("error.notInZone");
    expect(err(mountStack(s, "sw-8", "Sysko", rack, 1))).toBe("error.notInZone");
    expect(err(mountStack(s, "sw-8", "Sysko", rack, 1, 5))).toBe("error.notInZone");
    expect(err(mountStack(s, "sw-8", "Sysko", rack, 3))).toBe("error.notInStorage");
    ok(mountStack(s, "sw-8", "Sysko", "rack2", 2, 5));
    expect(storageStacks(s, "loc1")).toEqual([]);
  });
  it("returns an unmounted unit to its rack's zone", () => {
    const s = rich();
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    const rack = ok(buyRack(s, fr5, "rack-42", 1));
    const sw = ok(buyDevice(s, "sw-8", "Sysko", 1, fr5));
    ok(mountDevice(s, sw, rack, 1));
    expect(dev(s, sw)).toMatchObject({ store: null, name: "fra2-sw-01" });
    ok(unmountDevice(s, sw));
    ok(unmountDevice(s, "dev3"));
    expect([dev(s, sw).store, dev(s, "dev3").store]).toEqual([fr5, "loc1"]);
  });
});

describe("shipStock", () => {
  it("ships within a region for €300 in a day, keeps units unusable on the way and delivers them", () => {
    const s = rich();
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    const rack = ok(buyRack(s, fr5, "rack-42", 1));
    const first = ok(buyDevice(s, "g1-compute", "Dwell", 2, "loc1"));
    const ids = s.devices.filter((d) => d.store === "loc1").map((d) => d.id);
    const cash = s.cash;
    ok(shipStock(s, ids, fr5));
    expect(s.cash).toBe(cash - 300);
    expect(s.ledger.at(-1)).toMatchObject({ category: "moving", key: "ledger.ship", params: { count: 2, location: "Equinox FR5" }, amount: -300 });
    expect(dev(s, first)).toMatchObject({ store: null, transitTo: fr5, arriveAt: 24 });
    expect([storageStacks(s, "loc1"), storageStacks(s, fr5)]).toEqual([[], []]);
    expect(err(mountDevice(s, first, rack, 1))).toBe("error.inTransit");
    expect(err(sellDevice(s, first))).toBe("error.inTransit");
    expect(err(closeLocation(s, fr5))).toBe("error.storageNotEmpty");
    expect(run(s, 23).some((e) => e.key === "event.stockArrived")).toBe(false);
    expect(run(s, 1)).toContainEqual({ app: "Locations", key: "event.stockArrived", params: { count: 2, location: "Equinox FR5" } });
    expect(dev(s, first)).toMatchObject({ store: fr5, transitTo: null, arriveAt: null });
    ok(mountStack(s, "g1-compute", "Dwell", rack, 2));
  });
  it("takes three days and €1,200 to another region", () => {
    const s = rich();
    const lon = ok(addLocation(freeFloor(s), "tellyhouse-north", "cage", 4));
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    const cash = s.cash;
    ok(shipStock(s, [id], lon));
    expect([s.cash, dev(s, id).arriveAt]).toEqual([cash - 1200, 72]);
    run(s, 72);
    expect(dev(s, id).store).toBe(lon);
  });
  it("rejects empty, unknown, mounted, mixed, same-zone and unaffordable shipments", () => {
    const s = rich();
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    const a = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    const b = ok(buyDevice(s, "sw-8", "Sysko", 1, fr5));
    expect(err(shipStock(s, [], fr5))).toBe("error.emptyShipment");
    expect(err(shipStock(s, ["x"], fr5))).toBe("error.unknownDevice");
    expect(err(shipStock(s, ["dev3"], fr5))).toBe("error.notInStorage");
    expect(err(shipStock(s, [a, b], fr5))).toBe("error.mixedZones");
    expect(err(shipStock(s, [a], "nope"))).toBe("error.unknownLocation");
    expect(err(shipStock(s, [a], "loc1"))).toBe("error.sameZone");
    s.cash = 299;
    expect(err(shipStock(s, [a], fr5))).toBe("error.noCash");
  });
});

describe("closeLocation and saves", () => {
  it("keeps a zone open while its storage holds anything", () => {
    const s = rich();
    const fr5 = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, fr5));
    expect(err(closeLocation(s, fr5))).toBe("error.storageNotEmpty");
    ok(sellDevice(s, id));
    ok(closeLocation(s, fr5));
  });
  it("gives older saves zone codes and puts their stored units in the first location", () => {
    const s = rich();
    const fr5 = ok(addLocation(s, "equinox-fr5", "share", 1));
    const lon = ok(addLocation(s, "tellyhouse-north", "share", 1));
    const stored = ok(buyDevice(s, "sw-8", "Sysko", 1, fr5));
    const raw = JSON.parse(serialize(s));
    for (const l of raw.locations) delete l.az;
    for (const d of raw.devices) {
      delete d.store;
      delete d.transitTo;
      delete d.arriveAt;
    }
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.locations.map((l) => l.az)).toEqual(["fra1", "fra2", "lon1"]);
    expect(loaded.devices.find((d) => d.id === stored)).toMatchObject({ store: "loc1", transitTo: null, arriveAt: null });
    expect(loaded.devices.filter((d) => d.store === null).map((d) => d.id)).toEqual(["dev3", "dev4", "dev5", "dev6", s.devices.find((d) => d.panel === fr5)!.id, s.devices.find((d) => d.panel === lon)!.id]);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});
