import { describe, expect, it } from "vitest";
import { customerTiles, fixtures, freeRackTiles, officePlan, rackTiles, wallTiles } from "../src/sim/20-world/layout";
import { placeOf } from "../src/sim/20-world/places";
import { HALL, HALL_POSITIONS, hallBackup, hallKw, listingsIn, REFIT } from "../src/sim/20-world/properties";
import type { Workload } from "../src/sim/60-infra/cluster";
import { breakerTick, TRIP_HOURS } from "../src/sim/60-infra/power";
import { roomTemperature } from "../src/sim/60-infra/sensors";
import { freePositions, roomPower } from "../src/sim/60-infra/status";
import { thermalTick } from "../src/sim/60-infra/thermal";
import { panelOf } from "../src/sim/60-infra/panels";
import { buyDevice, buyRack, mountDevice, resetBreaker, setFeed } from "../src/sim/90-actions/hardware";
import { orderExchangePort, orderTransit } from "../src/sim/90-actions/network";
import { buildCarrier, cityCarriers, coloTick, goingRate, setColoRate, signChance } from "../src/sim/90-actions/hall";
import { hands } from "../src/sim/90-actions/presence";
import { buyBuilding, propertyBills, refitSection } from "../src/sim/90-actions/properties";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";
import { at, customer, edit, item, ok, ownHall, place, rack, zone } from "./own-dc-hall";

describe("own datacenter: hall refit and the Halle", () => {
  it("a hall refit takes the floor and opens a hall location with its capacity, a transformer and a NOC desk", () => {
    const { s, propertyId, hallId } = ownHall();
    const p = s.properties.find((x) => x.id === propertyId)!, loc = s.locations.find((l) => l.id === hallId)!;
    expect(loc).toMatchObject({ space: "hall", dc: null, positions: HALL_POSITIONS.office });
    expect(p.hall!.items.map((i) => i.kind).sort()).toEqual(["nocdesk", "transformer"]);
    expect(p.hall!.items.every((i) => i.price === 0)).toBe(true);
    expect(hallKw(p)).toBe(100);
    expect(p.sections.filter((x) => x.fit === "hall").length).toBe(2);
    expect(s.ledger.some((e) => e.key === "ledger.refit" && e.amount === -REFIT.hall.cost)).toBe(true);
    expect(wallTiles(loc, officePlan(s, loc)).length).toBeGreaterThan(HALL_POSITIONS.office);
    expect(deserialize(serialize(s)).properties.find((x) => x.id === propertyId)!.hall).toEqual(p.hall);
  });

  it("refuses a hall on a floor other tenants share, and a section back out of a hall", () => {
    const s = newGame(7);
    s.cash = 10_000_000;
    s.hour = at(2013);
    const id = ok(buyBuilding(s, "ostendkontor"));
    expect(refitSection(s, id, "2.2", "hall")).toEqual({ ok: false, error: "error.floorTaken" });
  });

  it("refuses a section back out of a hall", () => {
    const { s, propertyId } = ownHall();
    const p = s.properties.find((x) => x.id === propertyId)!, x = p.sections.find((k) => k.fit === "hall")!;
    expect(refitSection(s, propertyId, x.id, "desks")).toEqual({ ok: false, error: "error.hallFloor" });
    expect(refitSection(s, propertyId, x.id, "hall")).toEqual({ ok: false, error: "error.sameFit" });
  });

  it("lists the Halle from 2012, for purchase only, with 60 positions", () => {
    expect(listingsIn("Frankfurt", 2005).some((l) => l.kind === "halle")).toBe(false);
    expect(listingsIn("Frankfurt", 2012).some((l) => l.kind === "halle")).toBe(true);
    const { s, hallId } = ownHall("fechenhalle");
    expect(s.locations.find((l) => l.id === hallId)!.positions).toBe(HALL_POSITIONS.halle);
    const loc = s.locations.find((l) => l.id === hallId)!;
    expect(officePlan(s, loc)!.dock).toBe(true);
  });

  it("a Halle may be bought beside an office", () => {
    const { s } = ownHall();
    expect(buyBuilding(s, "fechenhalle").ok).toBe(true);
  });

  it("has no provider: no panel on a rack, no remote hands", () => {
    const e = ownHall();
    const rackId = rack(e, 5, 2);
    expect(panelOf(e.s, rackId)).toBeUndefined();
    expect(hands(e.s, e.hallId)).toBe("none");
  });
});

describe("own datacenter: cooling and power", () => {
  // Two rows of ten racks facing each other across one aisle, the first `racks` carrying kw each as a workload.
  const load = (e: ReturnType<typeof ownHall>, racks: number, kw: number) => {
    const ids = [...Array.from({ length: 10 }, (_, i) => rack(e, 2 + i, 2, "s")), ...Array.from({ length: 10 }, (_, i) => rack(e, 2 + i, 4, "n"))];
    ids.slice(0, racks).forEach((rackId, i) => e.s.workloads.push({ id: `w${i}`, rackId, watts: kw * 1000 } as unknown as Workload));
  };

  it("cooling units each shed 40 kW: a hall with too few warms up", () => {
    const warm = ownHall(), cool = ownHall();
    for (const h of [warm, cool]) load(h, 12, 4);
    // 48 kW: one unit cools 40 kW, two cool it all.
    place(warm, { kind: "crac", x: 3, y: 0, facing: "s", area: "hall" });
    place(cool, { kind: "crac", x: 3, y: 0, facing: "s", area: "hall" }, { kind: "crac", x: 6, y: 0, facing: "s", area: "hall" });
    for (const h of [warm, cool]) thermalTick(h.s, 60);
    const temp = (h: typeof warm) => roomTemperature(h.s, h.s.locations.find((l) => l.id === h.hallId)!);
    expect(warm.s.ops.heat[warm.hallId]).toBeGreaterThan(0);
    expect(cool.s.ops.heat[cool.hallId]).toBeUndefined();
    expect(temp(warm)).toBeGreaterThan(temp(cool));
    expect(cool.s.ledger.filter((x) => x.key === "ledger.hallItem")).toHaveLength(2);
  });

  it("the transformer's limit trips the main breaker and only the player resets it", () => {
    const e = ownHall();
    const { s, hallId } = e, limit = hallKw(s.properties.find((p) => p.id === e.propertyId)!);
    load(e, 20, (limit + 10) / 20);
    const loc = () => s.locations.find((l) => l.id === hallId)!;
    expect(roomPower(s, loc())).toMatchObject({ limitWatts: limit * 1000, over: true });
    breakerTick(s);
    s.hour += TRIP_HOURS;
    breakerTick(s);
    expect(loc().tripped).toBe(true);
    s.hour += 48;
    breakerTick(s);
    expect(loc().tripped).toBe(true);
    s.workloads = s.workloads.slice(5);
    expect(resetBreaker(s, hallId).ok).toBe(true);
    expect(loc().tripped).toBe(false);
  });

  it("items bill once and monthly, switchgear opens feed B, and a second transformer lifts the limit", () => {
    const e = ownHall("fechenhalle");
    const { s, hallId } = e, rackId = rack(e, 5, 2);
    expect(setFeed(s, rackId, "b", true)).toEqual({ ok: false, error: "error.noFeeds" });
    item(e, "switchgear", "xfmr");
    expect(setFeed(s, rackId, "b", true).ok).toBe(true);
    item(e, "transformer", "xfmr");
    item(e, "ups", "battery");
    item(e, "generator", "xfmr");
    const paid = s.ledger.filter((x) => x.key === "ledger.hallItem").reduce((n, x) => n + x.amount, 0);
    const items = HALL.items;
    expect(paid).toBe(-(items.switchgear.price + items.transformer.price + items.ups.price + items.generator.price));
    expect(hallKw(s.properties.find((p) => p.id === e.propertyId)!)).toBe(600);
    expect(hallBackup(e.hall())).toBe("ups+generator");
    const bill = propertyBills(s).find((b) => b.key === "ledger.hallUpkeep")!;
    expect(bill.amount).toBe(-(items.switchgear.monthly + items.transformer.monthly + items.ups.monthly + items.generator.monthly));
    expect(hallId).toBeDefined();
  });
});

describe("own datacenter: carriers", () => {
  it("transit books onto the player's fiber panel only after the carrier has built into the hall", () => {
    const e = ownHall();
    const { s, hallId } = e;
    s.unlocks = ["network"];
    s.player = { ...s.player, at: hallId };
    zone(e, "meetme", 2, 2, 1);
    const id = ok(buyRack(s, hallId, "rack-42", freePositions(s, hallId)[0]));
    ok(edit(e, { place: [{ kind: "rack", rackId: id, x: 2, y: 2, facing: "s" }] }));
    s.racks.find((r) => r.id === id)!.arriveAt = null;
    ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), id, 1));
    const carrier = cityCarriers("Frankfurt")[0].id;
    expect(orderTransit(s, hallId, carrier, 1, 0.2)).toEqual({ ok: false, error: "error.carrierNotBuilt" });
    ok(buildCarrier(s, hallId, carrier));
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.carrierBuild", amount: -HALL.carrierFee });
    expect(orderTransit(s, hallId, carrier, 1, 0.2)).toEqual({ ok: false, error: "error.noRouterPort" });
    const panel = ok(buyDevice(s, "patch-24f", "Pandoot", 1, hallId));
    ok(mountDevice(s, panel, id, 3));
    ok(orderTransit(s, hallId, carrier, 1, 0.2));
    expect(s.network.uplinks.at(-1)!.links[0].jack).toEqual({ device: panel, port: 0 });
    expect(orderExchangePort(s, hallId, 1)).toEqual({ ok: false, error: "error.noExchange" });
  });

  it("builds no carrier without a meet-me area", () => {
    const e = ownHall();
    expect(buildCarrier(e.s, e.hallId, cityCarriers("Frankfurt")[0].id)).toEqual({ ok: false, error: "error.noMeetMe" });
  });
});

describe("own datacenter: colocation customers", () => {
  it("a customer takes a spare tile at the listed rate, pays monthly, and leaving frees it", () => {
    const e = ownHall();
    const { s, hallId } = e;
    expect(setColoRate(s, hallId, -5)).toEqual({ ok: false, error: "error.badRate" });
    const going = goingRate("Frankfurt");
    expect(going).toBeGreaterThan(0);
    expect(signChance(going, going)).toBe(HALL.colo.signs);
    expect(signChance(2 * going, going)).toBe(0);
    rack(e, 2, 2);
    const z = zone(e, "colo", 3, 2, 3);
    ok(setColoRate(s, hallId, Math.round(going / 2)));
    let months = 0;
    while (!e.hall().customers.length && months++ < 12) { s.hour += 720; coloTick(s); }
    const c = e.hall().customers[0];
    expect(c).toMatchObject({ tile: { x: 3, y: 2, facing: "s" }, monthly: Math.round(going / 2) });
    const cash = s.cash;
    ok(setColoRate(s, hallId, null));
    coloTick(s);
    expect(s.ledger.some((x) => x.key === "ledger.colo" && x.amount === c.monthly)).toBe(true);
    expect(s.cash).toBe(cash + c.monthly);
    while (e.hall().customers.length && months++ < 600) { s.hour += 1; coloTick(s); }
    expect(e.hall().customers).toHaveLength(0);
    ok(edit(e, { remove: [`zone:${z}`] }));
    expect(freePositions(s, hallId)).toHaveLength(19);
  });
});

describe("own datacenter: the room", () => {
  it("stands at its building, draws a cooling unit per unit bought and the customers on their tiles", () => {
    const e = ownHall();
    const { s, hallId } = e, loc = () => s.locations.find((l) => l.id === hallId)!;
    expect(placeOf(s, hallId)?.id).toBe("gallushof");
    place(e, { kind: "crac", x: 3, y: 0, facing: "s", area: "hall" }, { kind: "crac", x: 6, y: 0, facing: "s", area: "hall" });
    expect(Object.values(fixtures(loc(), officePlan(s, loc()))).filter((f) => f.kind === "cooling")).toHaveLength(2);
    expect(fixtures(loc(), officePlan(s, loc())).meetme).toBeDefined();
    expect(fixtures(loc(), officePlan(s, loc())).mainboard).toBeDefined();
    expect(fixtures(loc(), officePlan(s, loc())).transformer).toBeUndefined();
    const z = zone(e, "colo", 4, 4, 2, "n");
    e.hall().customers.push(customer(e, 1, { x: 4, y: 4, facing: "n" }, z));
    expect(customerTiles(loc(), officePlan(s, loc()))[0].tile).toEqual({ x: 4, y: 4, facing: "n" });
    expect(freeRackTiles(loc(), s.racks, officePlan(s, loc())).some((t) => t.x === 4 && t.y === 4)).toBe(false);
    rack(e, 8, 2);
    expect(Object.values(rackTiles(loc(), s.racks, officePlan(s, loc())))).toHaveLength(1);
    const { s: big, hallId: halle } = ownHall("fechenhalle");
    const room = big.locations.find((l) => l.id === halle)!;
    expect(fixtures(room, officePlan(big, room)!).dock).toBeDefined();
  });
});
