import { describe, expect, it } from "vitest";
import { CITIES, START_CASH } from "../src/sim/10-catalog/economy";
import { BASEMENT, DATACENTERS, datacenterById, LEAD_DAYS, PROVIDERS, RACK_MODELS, SPACE_SIZES, spacePrice } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { freeSlots } from "../src/sim/60-infra/status";
import { freePositions, linkStatus, moveCost, rackPower, resaleValue } from "../src/sim/60-infra/status";
import { powerPerHour, tick, type SimEvent } from "../src/sim/88-tick/tick";
import { deserialize } from "../src/sim/91-save/save";
import { addLocation, buyRack, closeLocation, connect, moveRack, sellDevice, sellRack, unmountDevice } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { mountDevice, mountStack } from "./plugged";
import { runServers, withServer } from "./fixtures";

const rich = (cash = 1_000_000): GameState => ({ ...withServer(newGame(1)), cash });
const ok = (r: ReturnType<typeof addLocation>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof addLocation>) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
const loc = (s: GameState, id: string) => s.locations.find((l) => l.id === id)!;
const rack = (s: GameState, id: string) => s.racks.find((r) => r.id === id)!;
const handoffOf = (s: GameState, locationId: string) => s.devices.find((d) => d.panel === locationId)!.id;

describe("datacenter catalog", () => {
  it("matches the economy.md table", () => {
    expect(DATACENTERS).toHaveLength(39);
    expect(new Set(DATACENTERS.map((d) => d.id)).size).toBe(39);
    expect(PROVIDERS.map((p) => p.id)).toEqual(["equinox", "interaction", "mainqubes", "hetzler", "tellyhouse", "globalsnitch", "docklands", "ironmolehill", "data5", "ntd", "spree", "arubaba", "nextlair", "greenchz", "skyblink", "borisnet", "digitalreality", "corespite", "telex"]);
    for (const dc of DATACENTERS) expect(PROVIDERS.some((p) => p.id === dc.provider)).toBe(true);
    // Kerkrade and Falkenstein are one-datacenter towns.
    for (const c of CITIES) expect(DATACENTERS.filter((d) => d.city === c.name).length).toBeGreaterThanOrEqual(["Kerkrade", "Falkenstein"].includes(c.name) ? 1 : 2);
    expect(datacenterById("equinox-fr5")).toEqual({
      id: "equinox-fr5", name: "Equinox FR5", provider: "equinox", city: "Frankfurt", carriers: 30, exchange: { name: "DE-KICKS", onSite: true },
      feeds: "ab", backup: "ups+generator", green: true, kwPerPosition: 8, positionPrice: 750, powerFactor: 1.4, crossConnect: 250,
      remoteHands: { perHour: 150, responseHours: 1 }, certified: true, cages: true, size: "large", visitBooking: true,
    });
    expect(datacenterById("hetzler-park")).toMatchObject({ carriers: 1, exchange: null, feeds: "single", kwPerPosition: 4, positionPrice: 180, powerFactor: 1.1, certified: false, cages: false });
    expect(datacenterById("docklands-data")).toMatchObject({ backup: "ups", green: false, remoteHands: { perHour: 80, responseHours: 8 } });
    expect(datacenterById("arubaba-hub")).toMatchObject({ feeds: "ab", certified: true, cages: false });
    expect(datacenterById("greenchz-lupfig")).toMatchObject({ city: "Zurich", exchange: { name: "SwizzIX", onSite: false }, positionPrice: 550 });
    expect(() => datacenterById("nope")).toThrow();
  });
  it("prices space and racks", () => {
    const fr5 = datacenterById("equinox-fr5");
    expect([1, 2, 3, 4].map((n) => spacePrice(fr5, "positions", n))).toEqual([750, 1500, 2250, 3000]);
    expect(SPACE_SIZES.cage.map((n) => spacePrice(fr5, "cage", n))).toEqual([2550, 4800, 9000]);
    expect(SPACE_SIZES.suite.map((n) => spacePrice(fr5, "suite", n))).toEqual([11250, 21000]);
    expect(LEAD_DAYS).toEqual({ share: 2, positions: 7, cage: 30, suite: 90 });
    expect(RACK_MODELS.map((m) => [m.id, m.units, m.price])).toEqual([["rack-24", 24, 350], ["rack-42", 42, 800], ["rack-47", 47, 1000]]);
    expect(BASEMENT).toEqual({ positions: 1, maxUnits: 24, kw: 3 });
  });
});

describe("addLocation and closeLocation", () => {
  it("rents space with a handoff on the carrier panel, ready after the lead time", () => {
    const s = rich();
    const id = ok(addLocation(s, "equinox-fr5", "cage", 8));
    expect(loc(s, id)).toEqual({ id, dc: "equinox-fr5", city: "Frankfurt", az: "fra2", name: "Equinox FR5", space: "cage", positions: 8, readyAt: 720, extraCircuit: false });
    expect(s.devices.find((d) => d.panel === id)).toMatchObject({ model: "handoff", rackId: null, name: "fra2-gw-01" });
    expect(loc(s, ok(addLocation(s, "tellyhouse-north", "suite", 20))).readyAt).toBe(2160);
    expect(loc(s, ok(addLocation(s, "hetzler-park", "positions", 4))).readyAt).toBe(168);
    expect(s.cash).toBe(1_000_000);
    expect(freePositions(s, id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("rejects unknown datacenters and sizes, missing cages and too little cash", () => {
    const s = rich(749);
    expect(err(addLocation(s, "nope", "positions", 1))).toBe("error.unknownDatacenter");
    expect(err(addLocation(s, "equinox-fr5", "positions", 5))).toBe("error.unknownSize");
    expect(err(addLocation(s, "equinox-fr5", "cage", 2))).toBe("error.unknownSize");
    expect(err(addLocation(s, "hetzler-park", "cage", 4))).toBe("error.noCages");
    expect(err(addLocation(s, "equinox-fr5", "positions", 1))).toBe("error.noCash");
    expect(s.locations).toHaveLength(1);
  });
  it("closes an empty datacenter location but never the basement or one with racks", () => {
    const s = rich();
    const id = ok(addLocation(s, "spree-colo", "positions", 1));
    const r = ok(buyRack(s, id, "rack-42", 1));
    expect(err(closeLocation(s, id))).toBe("error.locationNotEmpty");
    expect(err(closeLocation(s, "loc1"))).toBe("error.cannotClose");
    expect(err(closeLocation(s, "nope"))).toBe("error.unknownLocation");
    ok(sellRack(s, r));
    ok(closeLocation(s, id));
    expect(s.locations.map((l) => l.id)).toEqual(["loc1"]);
    expect(s.devices.some((d) => d.panel === id)).toBe(false);
  });
});

describe("racks", () => {
  it("buys a rack into a free position, even before the location is ready", () => {
    const s = rich(10_000);
    const id = ok(addLocation(s, "interaction-fra", "positions", 2));
    const r = ok(buyRack(s, id, "rack-42", 2));
    expect(rack(s, r)).toEqual({ id: r, model: "rack-42", locationId: id, position: 2, name: "fra2-rack-01", arriveAt: null, price: 800, boughtAt: 0, provided: false, feedB: false, highDensity: false, extraKw: 0, extraKwAt: null });
    expect(s.cash).toBe(9200);
    expect(s.ledger.at(-1)).toMatchObject({ category: "hardware", key: "ledger.hardware", params: { model: "42U rack", device: "fra2-rack-01" }, amount: -800 });
    expect(freePositions(s, id)).toEqual([1]);
    // Devices in a location that is not ready have no power.
    const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, id));
    ok(mountDevice(s, srv, r, 1));
    expect(rackPower(s, r)).toEqual({ watts: 100, limitWatts: 6000, tripped: false });
    ok(connect(s, { device: srv, port: 0 }, { device: handoffOf(s, id), port: 0 }));
    expect(linkStatus(s, srv).online).toBe(false);
    s.hour = 168;
    expect(linkStatus(s, srv).online).toBe(true);
  });
  it("rejects unknown models and locations, taken positions, tall racks in the basement and too little cash", () => {
    const s = rich(999);
    const id = ok(addLocation(s, "spree-colo", "positions", 1));
    expect(err(buyRack(s, id, "rack-99" as never, 1))).toBe("error.unknownRackModel");
    expect(err(buyRack(s, "nope", "rack-24", 1))).toBe("error.unknownLocation");
    expect(err(buyRack(s, "loc1", "rack-42", 1))).toBe("error.rackTooTall");
    expect(err(buyRack(s, "loc1", "rack-24", 1))).toBe("error.positionTaken");
    expect(err(buyRack(s, id, "rack-24", 2))).toBe("error.positionTaken");
    expect(err(buyRack(s, id, "rack-24", 0))).toBe("error.positionTaken");
    expect(err(buyRack(s, id, "rack-47", 1))).toBe("error.noCash");
  });
  it("sells an empty rack at its resale value", () => {
    const s = rich(0);
    expect(err(sellRack(s, "rack2"))).toBe("error.rackNotEmpty");
    ok(unmountDevice(s, "dev3"));
    ok(unmountDevice(s, "dev4"));
    s.hour = 730;
    ok(sellRack(s, "rack2"));
    expect(s.cash).toBe(280);
    expect(s.ledger.at(-1)).toEqual({ hour: 730, category: "sales", key: "ledger.sale", params: { device: "fra1-rack-01" }, amount: 280 });
    expect(freePositions(s, "loc1")).toEqual([1]);
    expect(err(sellRack(s, "rack2"))).toBe("error.unknownRack");
  });
});

describe("resaleValue", () => {
  it("falls to 80% over the first month, then to 20% over 24 months, and stays there", () => {
    const s = withServer(newGame(1));
    const at = (months: number) => {
      s.hour = Math.round(months * 730);
      return resaleValue(s, 1000, 0);
    };
    expect([at(0), at(0.5), at(1), at(13), at(25), at(30)]).toEqual([1000, 900, 800, 500, 200, 200]);
    s.hour = 0;
    expect(resaleValue(s, 1000, 0)).toBe(1000);
  });
});

describe("moveRack", () => {
  it("moves the basement rack to a datacenter: offline in transit, online after arrival once cabled to the handoff", () => {
    const s = rich(10_000);
    const fr5 = ok(addLocation(s, "equinox-fr5", "positions", 1));
    loc(s, fr5).readyAt = 0;
    expect(moveCost(s, "rack2", fr5)).toEqual({ price: 300, hours: 24 });
    ok(moveRack(s, "rack2", fr5, 1));
    expect(rack(s, "rack2")).toMatchObject({ locationId: fr5, position: 1, arriveAt: 24, name: "fra1-rack-01" });
    expect(s.cash).toBe(9700);
    expect(s.ledger.at(-1)).toEqual({ hour: 0, category: "moving", key: "ledger.move", params: { rack: "fra1-rack-01", location: "Equinox FR5" }, amount: -300 });
    // The server-to-switch cable stays inside the rack; the cable to the home router is unplugged.
    expect(s.cables.map((c) => c.id)).toEqual(["cab6"]);
    expect(freePositions(s, "loc1")).toEqual([1]);
    expect(linkStatus(s, "dev3").online).toBe(false);
    expect(rackPower(s, "rack2").watts).toBe(0);
    expect(err(connect(s, { device: "dev4", port: 7 }, { device: handoffOf(s, fr5), port: 0 }))).toBe("error.rackMoving");
    expect(err(mountDevice(s, ok(buyDevice(s, "sw-8", "Sysko", 1, fr5)), "rack2", 10))).toBe("error.rackMoving");
    const events = run(s, 24);
    expect(events).toContainEqual({ app: "Locations", key: "event.rackArrived", params: { rack: "fra1-rack-01", location: "Equinox FR5" } });
    expect(rack(s, "rack2").arriveAt).toBeNull();
    expect(linkStatus(s, "dev3").online).toBe(false);
    ok(connect(s, { device: "dev4", port: 7 }, { device: handoffOf(s, fr5), port: 0 }));
    expect(linkStatus(s, "dev3")).toEqual({ online: true, gbit: 1, warning: null });
    expect(rackPower(s, "rack2")).toEqual({ watts: 108, limitWatts: 8000, tripped: false });
  });
  it("takes three days and €1,200 to another city", () => {
    const s = rich(10_000);
    const lon = ok(addLocation(s, "tellyhouse-north", "positions", 1));
    ok(moveRack(s, "rack2", lon, 1));
    expect([rack(s, "rack2").arriveAt, s.cash]).toEqual([72, 8800]);
    run(s, 71);
    expect(rack(s, "rack2").arriveAt).toBe(72);
    run(s, 1);
    expect(rack(s, "rack2").arriveAt).toBeNull();
  });
  it("rejects unknown racks, racks on their way, taken positions, tall racks for the basement and too little cash", () => {
    const s = rich(10_000);
    const a = ok(addLocation(s, "interaction-fra", "positions", 2));
    const tall = ok(buyRack(s, a, "rack-42", 1));
    expect(err(moveRack(s, "nope", a, 2))).toBe("error.unknownRack");
    expect(err(moveRack(s, "rack2", "nope", 1))).toBe("error.unknownLocation");
    expect(err(moveRack(s, "rack2", a, 1))).toBe("error.positionTaken");
    expect(err(moveRack(s, tall, "loc1", 1))).toBe("error.rackTooTall");
    expect(err(moveRack(s, tall, a, 1))).toBe("error.positionTaken");
    ok(moveRack(s, tall, a, 2));
    expect(err(moveRack(s, tall, a, 1))).toBe("error.rackMoving");
    s.cash = 299;
    expect(err(moveRack(s, "rack2", a, 1))).toBe("error.noCash");
  });
});

describe("breakers", () => {
  it("trips a rack that draws more than its position's limit and takes its devices offline", () => {
    const s = rich();
    ok(buyDevice(s, "g1-compute", "Dwell", 11, "loc1"));
    ok(mountStack(s, "g1-compute", "Dwell", "rack2", 10));
    runServers(s);
    expect(rackPower(s, "rack2")).toEqual({ watts: 2758, limitWatts: 3000, tripped: false });
    ok(mountStack(s, "g1-compute", "Dwell", "rack2", 1));
    runServers(s);
    expect(rackPower(s, "rack2")).toEqual({ watts: 3008, limitWatts: 3000, tripped: true });
    expect(linkStatus(s, "dev3").online).toBe(false);
    expect(linkStatus(s, "dev5").online).toBe(true);
    // Only the home router still draws power.
    expect(powerPerHour(s)).toBeCloseTo(0.01 * 0.09 * 1.6, 10);
    s.workloads = [];
    ok(unmountDevice(s, "dev8"));
    expect(linkStatus(s, "dev3").online).toBe(true);
  });
  it("uses the datacenter's kW per position", () => {
    const s = rich();
    const id = ok(addLocation(s, "hetzler-park", "positions", 1));
    const r = ok(buyRack(s, id, "rack-47", 1));
    ok(buyDevice(s, "g1-compute", "Dwell", 17, id));
    ok(mountStack(s, "g1-compute", "Dwell", r, 16));
    runServers(s);
    expect(rackPower(s, r)).toEqual({ watts: 4000, limitWatts: 4000, tripped: false });
    ok(mountStack(s, "g1-compute", "Dwell", r, 1));
    runServers(s);
    expect(rackPower(s, r).tripped).toBe(true);
  });
});

describe("monthly bills", () => {
  it("bills basement power at the household price and datacenter power at its power factor", () => {
    const s = rich();
    const basement = 0.118 * 0.09 * 1.6;
    expect(powerPerHour(s)).toBeCloseTo(basement, 10);
    const id = ok(addLocation(s, "equinox-fr5", "positions", 1));
    const r = ok(buyRack(s, id, "rack-24", 1));
    ok(mountDevice(s, ok(buyDevice(s, "g1-compute", "Dwell", 1, id)), r, 1));
    expect(powerPerHour(s)).toBeCloseTo(basement, 10);
    loc(s, id).readyAt = 0;
    expect(powerPerHour(s)).toBeCloseTo(basement + 0.1 * 0.09 * 1.4, 10);
  });
  it("pays power, the home line and the rent of every datacenter location on the first of the month", () => {
    const s = withServer(newGame(1));
    ok(addLocation(s, "hetzler-park", "positions", 2));
    const events = run(s, 24 * 31);
    // Idle server 100 W, switch 8 W and home router 10 W for 744 h at 9 ct × 1.6.
    const power = Math.round(0.118 * 744 * 0.09 * 1.6 * 100) / 100;
    expect(power).toBe(12.64);
    // The business DSL line costs €59.
    expect(s.cash).toBe(START_CASH - 2500 - 360 - 59 - power);
    expect(s.powerDue).toBe(0);
    expect(s.ledger.map((l) => [l.category, l.key, l.amount])).toEqual([["power", "ledger.power", -power], ["rent", "ledger.space", -360], ["rent", "ledger.homeLine", -59]]);
    expect(events).toContainEqual({ app: "Finance", key: "event.bills", params: { power, rent: 419, leasing: 0, subscriptions: 0, total: 419 + power } });
  });
});

describe("rack shares", () => {
  it("prices a share per size and comes with a provider rack of the share's units and power", () => {
    const fr5 = datacenterById("equinox-fr5");
    expect(SPACE_SIZES.share.map((n) => spacePrice(fr5, "share", n))).toEqual([150, 263, 450, 825]);
    const s = rich();
    const rows = SPACE_SIZES.share.map((size) => {
      const id = ok(addLocation(s, "equinox-fr5", "share", size));
      const r = s.racks.find((x) => x.locationId === id)!;
      return [loc(s, id).positions, loc(s, id).readyAt, r.provided, r.position, r.price, freeSlots(s, r.id, 1).length, rackPower(s, r.id).limitWatts];
    });
    expect(rows).toEqual([[1, 48, true, 1, 0, 5, 1000], [1, 48, true, 1, 0, 10, 2000], [1, 48, true, 1, 0, 21, 4000], [1, 48, true, 1, 0, 42, 8000]]);
    for (const dc of DATACENTERS) expect(addLocation(rich(), dc.id, "share", 8).ok).toBe(true);
  });
  it("mounts hardware into the provider rack and trips at the share's limit", () => {
    const s = rich();
    const id = ok(addLocation(s, "hetzler-park", "share", 8));
    loc(s, id).readyAt = 0;
    const r = s.racks.find((x) => x.locationId === id)!.id;
    expect(rackPower(s, r).limitWatts).toBe(500);
    ok(buyDevice(s, "g1-compute", "Dwell", 3, id));
    ok(mountStack(s, "g1-compute", "Dwell", r, 2));
    const srv = s.devices.find((d) => d.rackId === r)!;
    expect(srv.name).toBe("fra2-srv-01");
    ok(connect(s, { device: srv.id, port: 0 }, { device: handoffOf(s, id), port: 0 }));
    runServers(s);
    expect(rackPower(s, r)).toEqual({ watts: 500, limitWatts: 500, tripped: false });
    expect(linkStatus(s, srv.id).online).toBe(true);
    ok(mountStack(s, "g1-compute", "Dwell", r, 1));
    runServers(s);
    expect(rackPower(s, r).tripped).toBe(true);
    expect(linkStatus(s, srv.id).online).toBe(false);
    expect(err(mountStack(s, "g1-compute", "Dwell", r, 1))).toBe("error.notInStorage");
  });
  it("rejects moving, selling and buying racks into a share, and closes once the provider rack is empty", () => {
    const s = rich();
    const id = ok(addLocation(s, "spree-colo", "share", 2));
    const r = s.racks.find((x) => x.locationId === id)!.id;
    const other = ok(addLocation(s, "spree-colo", "positions", 1));
    expect(err(moveRack(s, r, other, 1))).toBe("error.providedRack");
    expect(err(sellRack(s, r))).toBe("error.providedRack");
    expect(err(buyRack(s, id, "rack-24", 1))).toBe("error.positionTaken");
    expect(err(buyRack(s, id, "rack-24", 2))).toBe("error.positionTaken");
    expect(err(moveRack(s, "rack2", id, 1))).toBe("error.positionTaken");
    expect(err(addLocation(s, "spree-colo", "share", 3))).toBe("error.unknownSize");
    const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, id));
    ok(mountDevice(s, srv, r, 1));
    expect(err(closeLocation(s, id))).toBe("error.locationNotEmpty");
    ok(sellDevice(s, srv));
    ok(closeLocation(s, id));
    expect(s.racks.some((x) => x.id === r)).toBe(false);
    expect(s.locations.some((l) => l.id === id)).toBe(false);
  });
  it("bills the share each month and fills provided on older racks", () => {
    const s = withServer(newGame(1));
    ok(addLocation(s, "hetzler-park", "share", 4));
    run(s, 24 * 31);
    expect(s.ledger.find((l) => l.key === "ledger.space")!.amount).toBe(-63);
    const raw = JSON.parse(JSON.stringify(withServer(newGame(2))));
    delete raw.racks[0].provided;
    expect(deserialize(JSON.stringify(raw)).racks[0].provided).toBe(false);
  });
});
