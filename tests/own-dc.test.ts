import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { customerTiles, fixtures, freeRackTiles, officePlan, rackTiles, wallTiles } from "../src/sim/20-world/layout";
import { placeOf } from "../src/sim/20-world/places";
import { HALL, HALL_POSITIONS, hallBackup, hallKw, listingsIn, REFIT } from "../src/sim/20-world/properties";
import type { GameState } from "../src/sim/50-state";
import type { Workload } from "../src/sim/60-infra/cluster";
import { breakerTick, TRIP_HOURS } from "../src/sim/60-infra/power";
import { roomTemperature } from "../src/sim/60-infra/sensors";
import { freePositions, roomPower } from "../src/sim/60-infra/status";
import { thermalTick } from "../src/sim/60-infra/thermal";
import { panelOf } from "../src/sim/60-infra/panels";
import { buyDevice, buyRack, mountDevice, resetBreaker, setFeed } from "../src/sim/90-actions/hardware";
import { orderExchangePort, orderTransit } from "../src/sim/90-actions/network";
import { addCooling, buildCarrier, buyHallUpgrade, cityCarriers, coloTick, goingRate, layRow, removeRow, setColoRate, signChance } from "../src/sim/90-actions/hall";
import { hands } from "../src/sim/90-actions/presence";
import { buyBuilding, propertyBills, refitSection } from "../src/sim/90-actions/properties";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const SEED = 7;
const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// An owned Gallushof (2 floors × 2 sections; seed 7 leaves floor 1 free and floor 2 taken) or the Halle, with floor 1 fitted as a hall and the refit done.
export function ownHall(building = "gallushof", year = 2013): { s: GameState; propertyId: string; hallId: string } {
  const s = newGame(SEED);
  s.cash = 10_000_000;
  s.hour = at(year, 3, 2, 10);
  const propertyId = ok(buyBuilding(s, building));
  const p = s.properties.find((x) => x.id === propertyId)!;
  const hallId = ok(refitSection(s, propertyId, p.sections.find((x) => x.floor === 1)!.id, "hall"));
  s.hour += 24 * REFIT.hall.days;
  return { s, propertyId, hallId };
}

describe("own datacenter: hall refit and the Halle", () => {
  it("a hall refit takes the floor and opens a hall location with its positions", () => {
    const { s, propertyId, hallId } = ownHall();
    const p = s.properties.find((x) => x.id === propertyId)!, loc = s.locations.find((l) => l.id === hallId)!;
    expect(loc).toMatchObject({ space: "hall", dc: null, positions: HALL_POSITIONS.office });
    expect(p.hall!.rows.reduce((n, r) => n + r.length, 0)).toBe(HALL_POSITIONS.office);
    expect(p.sections.filter((x) => x.fit === "hall").length).toBe(2);
    expect(s.ledger.some((e) => e.key === "ledger.refit" && e.amount === -REFIT.hall.cost)).toBe(true);
    expect(wallTiles(loc, officePlan(s, loc))).toHaveLength(HALL_POSITIONS.office);
    expect(deserialize(serialize(s)).properties.find((x) => x.id === propertyId)!.hall).toEqual(p.hall);
  });

  it("refuses a hall on a floor other tenants share, and a section back out of a hall", () => {
    const s = newGame(SEED);
    s.cash = 10_000_000;
    s.hour = at(2013, 3, 2, 10);
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
    const { s, hallId } = ownHall();
    const rackId = ok(buyRack(s, hallId, "rack-42", 1));
    expect(panelOf(s, rackId)).toBeUndefined();
    expect(hands(s, hallId)).toBe("none");
  });
});

describe("own datacenter: rows", () => {
  it("positions equal the rows' lengths as rows are laid, resized and removed", () => {
    const { s, propertyId, hallId } = ownHall();
    const hall = () => s.properties.find((x) => x.id === propertyId)!.hall!, loc = () => s.locations.find((l) => l.id === hallId)!;
    const [a, b] = hall().rows;
    expect(removeRow(s, hallId, b.id).ok).toBe(true);
    expect(loc().positions).toBe(a.length);
    expect(layRow(s, hallId, { x: 3, y: 4, length: 6, facing: "n" }).ok).toBe(true);
    expect(loc().positions).toBe(a.length + 6);
    expect(layRow(s, hallId, { x: 10, y: 4, length: 5, facing: "s" })).toEqual({ ok: false, error: "error.rowsFull" });
    expect(layRow(s, hallId, { x: 3, y: 2, length: 4, facing: "s" })).toEqual({ ok: false, error: "error.rowOverlap" });
    expect(layRow(s, hallId, { x: 0, y: 6, length: 4, facing: "s" })).toEqual({ ok: false, error: "error.rowOutside" });
    expect(layRow(s, hallId, { x: 14, y: 2, length: 3, facing: "w" }).ok).toBe(true);
    expect(loc().positions).toBe(hall().rows.reduce((n, r) => n + r.length, 0));
    expect(wallTiles(loc(), officePlan(s, loc())).filter((t) => t.facing === "w")).toHaveLength(3);
  });

  it("a row with racks cannot be removed, moves with its racks, and racks keep their tile when an earlier row goes", () => {
    const { s, propertyId, hallId } = ownHall();
    const [a, b] = s.properties.find((x) => x.id === propertyId)!.hall!.rows, loc = () => s.locations.find((l) => l.id === hallId)!;
    const rackId = ok(buyRack(s, hallId, "rack-42", a.length + 2));
    const tile = rackTiles(loc(), s.racks, officePlan(s, loc()))[rackId];
    expect(tile).toMatchObject({ y: b.y, facing: b.facing });
    expect(removeRow(s, hallId, b.id)).toEqual({ ok: false, error: "error.rowInUse" });
    expect(layRow(s, hallId, { ...b, x: 4 }).ok).toBe(true);
    expect(removeRow(s, hallId, a.id).ok).toBe(true);
    expect(s.racks.find((r) => r.id === rackId)!.position).toBe(2);
    expect(rackTiles(loc(), s.racks, officePlan(s, loc()))[rackId]).toEqual({ ...tile, x: tile.x + 1 });
  });

  it("rack tiles are distinct", () => {
    const { s, hallId } = ownHall();
    for (let i = 1; i <= 8; i++) ok(buyRack(s, hallId, "rack-42", i * 2));
    const loc = s.locations.find((l) => l.id === hallId)!;
    const tiles = Object.values(rackTiles(loc, s.racks, officePlan(s, loc))).map((t) => `${t.x},${t.y}`);
    expect(new Set(tiles).size).toBe(8);
  });
});

describe("own datacenter: cooling and power", () => {
  // Racks in the first positions, each carrying a load of kw as a workload.
  const load = (s: GameState, hallId: string, racks: number, kw: number) => {
    for (let i = 1; i <= racks; i++) {
      const rackId = ok(buyRack(s, hallId, "rack-42", i));
      s.workloads.push({ id: `w${i}`, rackId, watts: kw * 1000 } as unknown as Workload);
    }
  };

  it("positions beyond the cooled count run hot and raise the temperature", () => {
    const warm = ownHall(), cool = ownHall();
    for (const h of [warm, cool]) load(h.s, h.hallId, 12, 4);
    // 48 kW: one unit cools 40 kW, two cool it all.
    ok(addCooling(warm.s, warm.hallId));
    ok(addCooling(cool.s, cool.hallId)); ok(addCooling(cool.s, cool.hallId));
    for (const h of [warm, cool]) thermalTick(h.s, 60);
    const temp = (h: typeof warm) => roomTemperature(h.s, h.s.locations.find((l) => l.id === h.hallId)!);
    expect(warm.s.ops.heat[warm.hallId]).toBeGreaterThan(0);
    expect(cool.s.ops.heat[cool.hallId]).toBeUndefined();
    expect(temp(warm)).toBeGreaterThan(temp(cool));
    expect(cool.s.ledger.filter((e) => e.key === "ledger.hallCooling")).toHaveLength(2);
  });

  it("the transformer's limit trips the main breaker and only the player resets it", () => {
    const { s, propertyId, hallId } = ownHall();
    const limit = hallKw(s.properties.find((p) => p.id === propertyId)!);
    load(s, hallId, 20, (limit + 10) / 20);
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

  it("upgrades bill once and monthly, feed B opens the rack feed, and a generator needs the UPS", () => {
    const { s, propertyId, hallId } = ownHall();
    const rackId = ok(buyRack(s, hallId, "rack-42", 1));
    expect(setFeed(s, rackId, "b", true)).toEqual({ ok: false, error: "error.noFeeds" });
    expect(buyHallUpgrade(s, hallId, "generator")).toEqual({ ok: false, error: "error.needsUps" });
    for (const k of ["feedB", "ups", "generator"] as const) ok(buyHallUpgrade(s, hallId, k));
    expect(setFeed(s, rackId, "b", true).ok).toBe(true);
    const paid = s.ledger.filter((e) => e.key.startsWith("ledger.hall.")).reduce((n, e) => n + e.amount, 0);
    expect(paid).toBe(-(HALL.upgrades.feedB.price + HALL.upgrades.ups.price + HALL.upgrades.generator.price));
    const hall = s.properties.find((p) => p.id === propertyId)!.hall!;
    expect(hallBackup(hall)).toBe("ups+generator");
    const bill = propertyBills(s).find((b) => b.key === "ledger.hallUpkeep")!;
    expect(bill.amount).toBe(-(HALL.upgrades.feedB.monthly + HALL.upgrades.ups.monthly + HALL.upgrades.generator.monthly));
  });
});

describe("own datacenter: carriers", () => {
  it("transit books onto the player's fiber panel only after the carrier has built into the hall", () => {
    const { s, hallId } = ownHall();
    s.unlocks = ["network"];
    s.player = { ...s.player, at: hallId };
    const rack = ok(buyRack(s, hallId, "rack-42", 1));
    ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), rack, 1));
    const carrier = cityCarriers("Frankfurt")[0].id;
    expect(orderTransit(s, hallId, carrier, 1, 0.2)).toEqual({ ok: false, error: "error.carrierNotBuilt" });
    ok(buildCarrier(s, hallId, carrier));
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.carrierBuild", amount: -HALL.carrierFee });
    expect(orderTransit(s, hallId, carrier, 1, 0.2)).toEqual({ ok: false, error: "error.noRouterPort" });
    const panel = ok(buyDevice(s, "patch-24f", "Pandoot", 1, hallId));
    ok(mountDevice(s, panel, rack, 3));
    ok(orderTransit(s, hallId, carrier, 1, 0.2));
    expect(s.network.uplinks.at(-1)!.links[0].jack).toEqual({ device: panel, port: 0 });
    expect(orderExchangePort(s, hallId, 1)).toEqual({ ok: false, error: "error.noExchange" });
  });
});

describe("own datacenter: colocation customers", () => {
  it("a customer takes a spare position at the listed rate, pays monthly, and leaving frees it", () => {
    const { s, propertyId, hallId } = ownHall();
    const hall = () => s.properties.find((p) => p.id === propertyId)!.hall!;
    expect(setColoRate(s, hallId, -5)).toEqual({ ok: false, error: "error.badRate" });
    const going = goingRate("Frankfurt");
    expect(going).toBeGreaterThan(0);
    expect(signChance(going, going)).toBe(HALL.colo.signs);
    expect(signChance(2 * going, going)).toBe(0);
    ok(buyRack(s, hallId, "rack-42", 1));
    // Half the going rate signs a customer in most months.
    ok(setColoRate(s, hallId, Math.round(going / 2)));
    let months = 0;
    while (!hall().customers.length && months++ < 12) coloTick(s);
    const c = hall().customers[0];
    expect(c).toMatchObject({ position: 2, monthly: Math.round(going / 2) });
    expect(freePositions(s, hallId)).not.toContain(2);
    const cash = s.cash;
    ok(setColoRate(s, hallId, null));
    coloTick(s);
    expect(s.ledger.some((e) => e.key === "ledger.colo" && e.amount === c.monthly)).toBe(true);
    expect(s.cash).toBe(cash + c.monthly);
    while (hall().customers.length && months++ < 600) { s.hour += 1; coloTick(s); }
    expect(hall().customers).toHaveLength(0);
    expect(freePositions(s, hallId)).toContain(2);
  });
});

describe("own datacenter: the room", () => {
  it("stands at its building, draws a cooling unit per unit bought and the customers on their positions", () => {
    const { s, propertyId, hallId } = ownHall();
    const loc = () => s.locations.find((l) => l.id === hallId)!;
    expect(placeOf(s, hallId)?.id).toBe("gallushof");
    ok(addCooling(s, hallId)); ok(addCooling(s, hallId));
    expect(Object.values(fixtures(loc(), officePlan(s, loc()))).filter((f) => f.kind === "cooling")).toHaveLength(2);
    expect(fixtures(loc(), officePlan(s, loc())).meetme).toBeDefined();
    s.properties.find((p) => p.id === propertyId)!.hall!.customers.push({ id: "c1", name: "Mainbit", position: 3, monthly: 300, since: s.hour });
    expect(customerTiles(loc(), officePlan(s, loc()))[0].tile).toEqual(wallTiles(loc(), officePlan(s, loc()))[2]);
    expect(freeRackTiles(loc(), s.racks, officePlan(s, loc()))).toHaveLength(HALL_POSITIONS.office - 1);
    const { s: big, hallId: halle } = ownHall("fechenhalle");
    const room = big.locations.find((l) => l.id === halle)!, plan = officePlan(big, room)!;
    expect(fixtures(room, plan).dock).toBeDefined();
    for (let i = 0; i < 14; i++) ok(addCooling(big, halle));
    expect(addCooling(big, halle)).toEqual({ ok: false, error: "error.wallsFull" });
  });
});
