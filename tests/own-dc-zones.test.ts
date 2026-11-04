import { describe, expect, it } from "vitest";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { customerSpots, HALL, hallSpots } from "../src/sim/20-world/properties";
import { businessPowerPrice } from "../src/sim/10-catalog/economy";
import type { HallZone } from "../src/sim/50-state";
import { powerByLocation } from "../src/sim/88-tick/tick";
import { breakerTick, TRIP_HOURS } from "../src/sim/60-infra/power";
import { jackRoles, panelOf } from "../src/sim/60-infra/panels";
import { freePositions, roomPower } from "../src/sim/60-infra/status";
import { thermalTick } from "../src/sim/60-infra/thermal";
import { buyDevice, buyRack, mountDevice } from "../src/sim/90-actions/hardware";
import { buildCarrier, cityCarriers, coloTick, editHallError, goingRate, setColoRate } from "../src/sim/90-actions/hall";
import { orderExchangePort, orderTransit } from "../src/sim/90-actions/network";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { yearOf } from "../src/sim/00-core/time";
import { customer, edit, ok, ownHall, place, rack, zone, type OwnHall } from "./own-dc-hall";

// Gallushof tiles in the old row terms: row A is y = 2 facing s from x = 2, row B is y = 4 facing n from x = 2.
const A = (i: number) => ({ x: 2 + i, y: 2, facing: "s" as const });
const B = (i: number) => ({ x: 2 + i, y: 4, facing: "n" as const });
const paint = (e: OwnHall, kind: HallZone["kind"], t: { x: number; y: number; facing: "n" | "s" }, length: number) => zone(e, kind, t.x, t.y, length, t.facing);
const zoneErr = (e: OwnHall, kind: HallZone["kind"], t: { x: number; y: number; facing: "n" | "s" }, length: number) =>
  editHallError(e.s, e.hallId, { place: [{ kind: "zone", zone: kind, length, ...t }] })?.key;
const month = (e: OwnHall, events = coloTick) => { e.s.hour += 720; return events(e.s); };

describe("own datacenter: zones", () => {
  it("loading a save renames the hall location in the current language", () => {
    const e = ownHall();
    e.s.locations.find((l) => l.id === e.hallId)!.name = "stale name";
    expect(deserialize(serialize(e.s)).locations.find((l) => l.id === e.hallId)!.name).toBe("Gallushof hall");
  });

  it("refuses overlap, a player rack in a colo zone, a second meet-me zone and a cage before 2015", () => {
    const e = ownHall();
    const z = paint(e, "colo", A(2), 3);
    expect(zoneErr(e, "colo", A(4), 2)).toBe("error.occupied");
    expect(zoneErr(e, "colo", { x: 15, y: 2, facing: "s" }, 2)).toBe("error.wrongRoom");
    expect(editHallError(e.s, e.hallId, { place: [{ kind: "rack", model: "rack-42", ...A(3) }] })?.key).toBe("error.occupied");
    expect(zoneErr(e, "colo", A(0), 3)).toBe("error.occupied");
    expect(freePositions(e.s, e.hallId)).toHaveLength(17);
    paint(e, "meetme", B(0), 2);
    expect(zoneErr(e, "meetme", B(4), 1)).toBe("error.limit");
    expect(zoneErr(e, "cage", B(4), 3)).toBe("error.notYet");
    ok(edit(e, { remove: [`zone:${z}`] }));
    expect(freePositions(e.s, e.hallId)).toHaveLength(18);
  });

  it("a cage needs 2 to 8 positions, costs the fence and refunds half", () => {
    const e = ownHall("gallushof", 2015);
    expect(zoneErr(e, "cage", A(0), 1)).toBe("error.zoneSize");
    expect(zoneErr(e, "cage", A(0), 9)).toBe("error.zoneSize");
    expect(zoneErr(e, "meetme", A(0), 5)).toBe("error.zoneSize");
    const cash = e.s.cash, id = paint(e, "cage", A(0), 4);
    expect(cash - e.s.cash).toBe(4 * HALL.zones.cage.perPosition);
    ok(edit(e, { remove: [`zone:${id}`] }));
    expect(cash - e.s.cash).toBe(2 * HALL.zones.cage.perPosition);
    const m = paint(e, "meetme", A(0), 1), after = e.s.cash;
    ok(edit(e, { remove: [`zone:${m}`] }));
    expect(e.s.cash - after).toBe(HALL.zones.meetme.price * HALL.zones.refund);
  });

  it("an empty zone moves and turns, one that holds a rack does not", () => {
    const e = ownHall();
    const id = paint(e, "colo", A(6), 3);
    ok(edit(e, { move: [{ ref: `zone:${id}`, x: 2, y: 6, facing: "n" }] }));
    expect(e.hall().zones.find((z) => z.id === id)).toMatchObject({ x: 2, y: 6, length: 3, facing: "n" });
    const m = paint(e, "meetme", A(0), 1);
    const r = rack(e, 8, 6, "n");
    ok(edit(e, { move: [{ ref: `rack:${r}`, x: 2, y: 2, facing: "n" }] }));
    expect(e.s.racks.find((x) => x.id === r)!.tile).toMatchObject({ x: 2, y: 2, facing: "s" });
    expect(editHallError(e.s, e.hallId, { move: [{ ref: `zone:${m}`, x: 6, y: 2, facing: "s" }] })?.key).toBe("error.locked");
  });

  it("an old save with customers and a carrier loads with a colo zone under each customer and a meet-me zone under the uplink rack", () => {
    const e = ownHall();
    const { s, hallId } = e;
    s.unlocks = ["network"];
    s.player = { ...s.player, at: hallId };
    paint(e, "meetme", A(0), 1);
    const id = ok(buyRack(s, hallId, "rack-42", freePositions(s, hallId)[0]));
    ok(edit(e, { place: [{ kind: "rack", rackId: id, ...A(0) }] }));
    s.racks.find((r) => r.id === id)!.arriveAt = null;
    ok(mountDevice(s, ok(buyDevice(s, "edge-m", "Sysko", 1, hallId)), id, 1));
    const carrier = cityCarriers("Frankfurt")[0].id;
    ok(buildCarrier(s, hallId, carrier));
    ok(mountDevice(s, ok(buyDevice(s, "patch-24f", "Pandoot", 1, hallId)), id, 3));
    ok(orderTransit(s, hallId, carrier, 1, 0.2));
    const old = JSON.parse(serialize(s));
    const h = old.properties.find((p: { hall?: unknown }) => p.hall).hall;
    Object.assign(h, { rows: [{ id: "row1", x: 2, y: 2, length: 10, facing: "s" }, { id: "row2", x: 2, y: 4, length: 10, facing: "n" }], coolers: [], transformers: 0, feedB: false, ups: false, generator: false, customers: [{ id: "c1", name: "K", position: 5, monthly: 100, since: 0 }] });
    delete h.items; delete h.zones; delete h.xconnects; delete h.exchange; delete h.outage; delete h.noc;
    const loaded = deserialize(JSON.stringify(old)).properties.find((p) => p.hall)!.hall!;
    expect(loaded.customers[0]).toMatchObject({ kw: 3, zoneId: "zone-c1", tile: { x: 6, y: 2, facing: "s" } });
    expect(loaded.zones.map((z) => [z.kind, z.x, z.y, z.length])).toEqual([["colo", 6, 2, 1], ["meetme", 2, 2, 1]]);
    expect(loaded).toMatchObject({ xconnects: [], exchange: null, outage: false, noc: false });
  });
});

describe("own datacenter: customers", () => {
  it("sign only into colo zones, never onto the player's free tiles", () => {
    const e = ownHall();
    ok(setColoRate(e.s, e.hallId, Math.round(goingRate("Frankfurt") / 2)));
    paint(e, "colo", A(0), 3);
    for (let i = 0; i < 24; i++) month(e);
    expect(e.hall().customers.length).toBeGreaterThan(0);
    for (const c of e.hall().customers) expect([2, 3, 4]).toContain(c.tile!.x);
    expect(e.hall().customers[0].kw).toBeGreaterThanOrEqual(HALL.colo.kw.min);
    expect(e.hall().customers[0].kw).toBeLessThanOrEqual(HALL.colo.kw.max);
    expect(freePositions(e.s, e.hallId)).toHaveLength(17);
  });

  it("an empty cage signs a cage customer who pays 1.1 times length times the rate", () => {
    const e = ownHall("gallushof", 2016);
    const rate = Math.round(goingRate("Frankfurt") / 2);
    ok(setColoRate(e.s, e.hallId, rate));
    const z = paint(e, "cage", A(0), 3);
    const events: string[] = [];
    for (let i = 0; i < 24 && !e.hall().customers.length; i++) events.push(...month(e).map((v) => v.key));
    expect(events).toContain("event.cageSigned");
    const c = e.hall().customers[0];
    expect(c).toMatchObject({ zoneId: z, tile: null, monthly: Math.round(3 * rate * HALL.colo.cageMarkup) });
    expect(customerSpots(e.hall(), c).map((t) => t.x)).toEqual([2, 3, 4]);
    expect(freePositions(e.s, e.hallId)).toHaveLength(17);
  });

  it("their kW trip the breaker with the racks, warm the hall, and a trip month raises leaving to the outage rate", () => {
    const e = ownHall();
    const z = paint(e, "colo", A(0), 10);
    e.hall().customers.push(customer(e, 1, A(0), z, 60), customer(e, 2, A(1), z, 60));
    const loc = () => e.s.locations.find((l) => l.id === e.hallId)!;
    expect(roomPower(e.s, loc())).toMatchObject({ watts: 120_000, over: true });
    breakerTick(e.s);
    e.s.hour += TRIP_HOURS;
    breakerTick(e.s);
    expect(loc().tripped).toBe(true);
    expect(e.hall().outage).toBe(true);

    // Heat grows with the customers' draw and nothing cooling it.
    const warm = ownHall(), cold = ownHall();
    warm.hall().customers.push(customer(warm, 1, A(0), paint(warm, "colo", A(0), 10), 20));
    for (const h of [warm, cold]) thermalTick(h.s, 60);
    expect(warm.s.ops.heat[warm.hallId]).toBeGreaterThan(0);
    expect(cold.s.ops.heat[cold.hallId]).toBeUndefined();

    // Over many months a tripped one loses about a quarter of the customers, a quiet one about 4%.
    const lost = (outage: boolean) => {
      let n = 0;
      for (let h = 0; h < 100; h++) {
        const t = ownHall();
        const z2 = paint(t, "colo", A(0), 10);
        for (let i = 0; i < 10; i++) t.hall().customers.push(customer(t, i, A(i), z2, 0));
        t.hall().outage = outage;
        t.s.hour += h * 720;
        coloTick(t.s);
        n += 10 - t.hall().customers.length;
      }
      return n;
    };
    expect(lost(true)).toBeGreaterThan(150);
    expect(lost(false)).toBeLessThan(80);
  });

  it("a hall kWh costs less than a datacenter share's at the same draw", () => {
    const e = ownHall();
    e.hall().customers.push(customer(e, 1, A(0), paint(e, "colo", A(0), 1), 4));
    const use = powerByLocation(e.s)[e.hallId];
    expect(use.kwh).toBe(4);
    const perKwh = use.eur / use.kwh, dc = businessPowerPrice(yearOf(e.s.hour)) * datacenterById("equinox-fr5").powerFactor;
    expect(perKwh).toBeCloseTo(businessPowerPrice(yearOf(e.s.hour)) * HALL.powerFactor * HALL.pue, 6);
    expect(perKwh).toBeLessThan(dc);
  });
});

describe("own datacenter: meet-me, cross-connects and the hub", () => {
  // A router and a fiber panel in a rack on the meet-me zone's first tile, a built carrier.
  function meetMe(model = "patch-24f") {
    const e = ownHall();
    e.s.unlocks = ["network"];
    e.s.player = { ...e.s.player, at: e.hallId };
    paint(e, "meetme", B(0), 2);
    const id = ok(buyRack(e.s, e.hallId, "rack-42", freePositions(e.s, e.hallId)[0]));
    ok(edit(e, { place: [{ kind: "rack", rackId: id, ...B(0) }] }));
    e.s.racks.find((r) => r.id === id)!.arriveAt = null;
    ok(mountDevice(e.s, ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId)), id, 1));
    const panel = ok(buyDevice(e.s, model, "Pandoot", 1, e.hallId));
    ok(mountDevice(e.s, panel, id, 3));
    const carrier = cityCarriers("Frankfurt")[0].id;
    ok(buildCarrier(e.s, e.hallId, carrier));
    return { ...e, rack: id, panel, carrier };
  }

  it("uplinks land only on panels in the zone, and a 48-jack panel gives 48 jacks", () => {
    const m = meetMe("patch-48f");
    const outside = rack(m, 8, 2);
    ok(mountDevice(m.s, ok(buyDevice(m.s, "patch-24f", "Pandoot", 1, m.hallId)), outside, 3));
    expect(panelOf(m.s, outside)).toBeUndefined();
    expect(panelOf(m.s, m.rack)?.id).toBe(m.panel);
    expect(jackRoles(m.s, m.panel)).toHaveLength(48);
    ok(orderTransit(m.s, m.hallId, m.carrier, 1, 0.2));
    expect(m.s.network.uplinks.at(-1)!.links[0].jack).toEqual({ device: m.panel, port: 0 });
  });

  it("a customer orders a cross-connect onto a customer jack, pays monthly, and leaving frees the jack", () => {
    const m = meetMe();
    const z = paint(m, "colo", A(0), 4);
    const reset = () => { m.hall().customers = [0, 1, 2, 3].map((n) => customer(m, n, A(n), z)); m.hall().xconnects = []; };
    reset();
    for (let i = 0; i < 80 && !m.hall().xconnects.length; i++) { reset(); month(m); }
    const x = m.hall().xconnects[0];
    expect(x).toBeDefined();
    expect(jackRoles(m.s, m.panel)[x.jack.port]).toBe("customer");
    expect(m.hall().carriers).toContain(x.carrierId);
    const before = m.s.ledger.length;
    m.s.hour += 1;
    m.hall().outage = false;
    coloTick(m.s);
    expect(m.s.ledger.slice(before).some((l) => l.key === "ledger.xconnect" && l.amount === HALL.xconnect.monthly)).toBe(true);
    m.hall().customers = [];
    coloTick(m.s);
    expect(m.hall().xconnects).toEqual([]);
    expect(jackRoles(m.s, m.panel)[x.jack.port]).toBe("free");
  });

  it("a full panel gives no order, the no-jack event and an unhappy customer", () => {
    const m = meetMe();
    const z = paint(m, "colo", A(0), 10);
    const jacks = jackRoles(m.s, m.panel).length;
    const reset = () => {
      m.hall().customers = Array.from({ length: 10 }, (_, n) => customer(m, n, A(n), z));
      m.hall().xconnects = Array.from({ length: jacks }, (_, n) => ({ id: `xc${n}`, customerId: `c${Math.floor(n / 3)}`, carrierId: m.carrier, jack: { device: m.panel, port: n } }));
    };
    let seen = false;
    for (let i = 0; i < 200 && !seen; i++) {
      reset();
      m.s.hour += 720;
      seen = coloTick(m.s).some((v) => v.key === "event.xconnectNoJack");
      expect(m.hall().xconnects.length).toBeLessThanOrEqual(jacks);
    }
    expect(seen).toBe(true);
  });

  it("8 customers bring a free carrier", () => {
    const m = meetMe();
    const z = paint(m, "colo", A(0), 8);
    const built = m.hall().carriers.length, cash = m.s.ledger.length;
    let arrived = false;
    for (let i = 0; i < 120 && !arrived; i++) {
      m.hall().customers = Array.from({ length: 8 }, (_, n) => customer(m, n, A(n), z));
      m.hall().xconnects = [];
      arrived = month(m).some((v) => v.key === "event.carrierArrived");
    }
    expect(arrived).toBe(true);
    expect(m.hall().carriers.length).toBeGreaterThan(built);
    expect(m.s.ledger.slice(cash).some((l) => l.key === "ledger.carrierBuild")).toBe(false);
  });

  it("3 carriers and 12 customers bring the exchange onto a free meet-me tile, and a full zone makes it wait", () => {
    const m = meetMe();
    const a = paint(m, "colo", A(0), 10), b = paint(m, "colo", B(4), 2);
    const fill = () => {
      m.hall().customers = [...Array.from({ length: 10 }, (_, n) => customer(m, n, A(n), a)), customer(m, 10, B(4), b), customer(m, 11, B(5), b)];
      m.hall().carriers = cityCarriers("Frankfurt").slice(0, 3).map((c) => c.id);
      m.hall().xconnects = [];
    };
    // The zone holds B(0) and B(1); the rack stands on B(0), so the exchange takes B(1).
    const events: string[] = [];
    for (let i = 0; i < 80 && !m.hall().exchange; i++) { fill(); events.push(...month(m).map((v) => v.key)); }
    expect(m.hall().exchange?.tile).toMatchObject({ x: 3, y: 4 });
    expect(events).toContain("event.exchangeOpened");
    expect(hallSpots(m.hall(), Object.fromEntries(m.s.racks.filter((r) => r.locationId === m.hallId).map((r) => [r.id, r.tile ?? null])))).toBe(m.hall().zones.reduce((n, z) => n + z.length, 0));
    m.s.network.asn = 64512;
    m.s.network.memberships = [m.hall().exchange!.id];
    ok(orderExchangePort(m.s, m.hallId, 1));

    const full = meetMe();
    paint(full, "colo", A(0), 10);
    place(full, { kind: "rack", model: "rack-42", ...B(1) });
    const fillFull = () => {
      const z1 = full.hall().zones.find((z) => z.kind === "colo")!.id, z2 = full.hall().zones.find((z) => z.kind === "colo" && z.y === 4)?.id ?? paint(full, "colo", B(4), 2);
      full.hall().customers = [...Array.from({ length: 10 }, (_, n) => customer(full, n, A(n), z1)), customer(full, 10, B(4), z2), customer(full, 11, B(5), z2)];
      full.hall().carriers = cityCarriers("Frankfurt").slice(0, 3).map((c) => c.id);
    };
    const waiting: string[] = [];
    for (let i = 0; i < 40; i++) { fillFull(); waiting.push(...month(full).map((v) => v.key)); }
    expect(full.hall().exchange?.tile).toBeNull();
    expect(waiting.filter((k) => k === "event.exchangeComing")).toHaveLength(1);
    expect(waiting).not.toContain("event.exchangeOpened");
  });
});
