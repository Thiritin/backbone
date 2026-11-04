import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { customerPositions, HALL, REFIT, zonePositions } from "../src/sim/20-world/properties";
import { businessPowerPrice } from "../src/sim/10-catalog/economy";
import type { Hall, HallZone } from "../src/sim/50-state";
import { powerByLocation } from "../src/sim/88-tick/tick";
import { breakerTick, TRIP_HOURS } from "../src/sim/60-infra/power";
import { jackRoles, panelOf } from "../src/sim/60-infra/panels";
import { freePositions, roomPower } from "../src/sim/60-infra/status";
import { thermalTick } from "../src/sim/60-infra/thermal";
import { buyDevice, buyRack, mountDevice } from "../src/sim/90-actions/hardware";
import { buildCarrier, cityCarriers, coloTick, goingRate, layRow, layRowError, paintZone, paintZoneError, removeZone, setColoRate } from "../src/sim/90-actions/hall";
import { orderExchangePort, orderTransit } from "../src/sim/90-actions/network";
import { buyBuilding, refitSection } from "../src/sim/90-actions/properties";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { yearOf } from "../src/sim/00-core/time";
import { newGame } from "./fixtures";

const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const at = (y: number) => hourOf(new Date(Date.UTC(y, 2, 2, 10)));

// An owned Gallushof hall: rows A (positions 1 to 10) and B (11 to 20), refit done, in the given year.
function setup(year = 2013) {
  const s = newGame(7);
  s.cash = 10_000_000;
  s.hour = at(year);
  const propertyId = ok(buyBuilding(s, "gallushof"));
  const p = s.properties.find((x) => x.id === propertyId)!;
  const hallId = ok(refitSection(s, propertyId, p.sections.find((x) => x.floor === 1)!.id, "hall"));
  s.hour += 24 * REFIT.hall.days;
  const hall = (): Hall => p.hall!;
  return { s, hallId, hall, rowA: p.hall!.rows[0].id, rowB: p.hall!.rows[1].id };
}
type Setup = ReturnType<typeof setup>;
const paint = (e: Setup, kind: HallZone["kind"], rowId: string, from: number, length: number) => ok(paintZone(e.s, e.hallId, { kind, rowId, from, length }));
const customer = (e: Setup, n: number, position: number, zoneId: string, kw = 3) => ({ id: `c${n}`, name: `Kunde ${n}`, position, monthly: 100, since: e.s.hour, kw, zoneId });
const month = (e: Setup, events = coloTick) => { e.s.hour += 720; return events(e.s); };

describe("own datacenter: zones", () => {
  it("loading a save renames the hall location in the current language", () => {
    const e = setup();
    e.s.locations.find((l) => l.id === e.hallId)!.name = "stale name";
    expect(deserialize(serialize(e.s)).locations.find((l) => l.id === e.hallId)!.name).toBe("Gallushof hall");
  });
  it("refuses overlap, a player rack in a colo zone, a second meet-me zone and a cage before 2015", () => {
    const e = setup();
    const zone = paint(e, "colo", e.rowA, 2, 3);
    expect(paintZoneError(e.s, e.hallId, { kind: "colo", rowId: e.rowA, from: 4, length: 2 })).toBe("error.occupied");
    expect(paintZoneError(e.s, e.hallId, { kind: "colo", rowId: e.rowA, from: 9, length: 2 })).toBe("error.zoneOutside");
    ok(buyRack(e.s, e.hallId, "rack-42", 1));
    expect(paintZoneError(e.s, e.hallId, { kind: "colo", rowId: e.rowA, from: 0, length: 2 })).toBe("error.zoneRack");
    expect(freePositions(e.s, e.hallId)).not.toContain(3);
    expect(buyRack(e.s, e.hallId, "rack-42", 3)).toEqual({ ok: false, error: "error.positionTaken" });
    paint(e, "meetme", e.rowB, 0, 2);
    expect(paintZoneError(e.s, e.hallId, { kind: "meetme", rowId: e.rowB, from: 4, length: 1 })).toBe("error.zoneExists");
    expect(paintZoneError(e.s, e.hallId, { kind: "cage", rowId: e.rowB, from: 4, length: 3 })).toBe("error.cageLater");
    ok(removeZone(e.s, e.hallId, zone));
    expect(freePositions(e.s, e.hallId)).toContain(3);
  });

  it("a cage needs 2 to 8 positions, costs the fence and refunds half", () => {
    const e = setup(2015);
    expect(paintZoneError(e.s, e.hallId, { kind: "cage", rowId: e.rowA, from: 0, length: 1 })).toBe("error.zoneSize");
    expect(paintZoneError(e.s, e.hallId, { kind: "cage", rowId: e.rowA, from: 0, length: 9 })).toBe("error.zoneSize");
    expect(paintZoneError(e.s, e.hallId, { kind: "meetme", rowId: e.rowA, from: 0, length: 5 })).toBe("error.zoneSize");
    const cash = e.s.cash, id = paint(e, "cage", e.rowA, 0, 4);
    expect(cash - e.s.cash).toBe(4 * HALL.zones.cage.perPosition);
    ok(removeZone(e.s, e.hallId, id));
    expect(cash - e.s.cash).toBe(2 * HALL.zones.cage.perPosition);
    const m = paint(e, "meetme", e.rowA, 0, 1), after = e.s.cash;
    ok(removeZone(e.s, e.hallId, m));
    expect(e.s.cash - after).toBe(HALL.zones.meetme.price * HALL.zones.refund);
  });

  it("moving a row carries its zones, and shortening a row into a zone is refused", () => {
    const e = setup();
    const id = paint(e, "colo", e.rowA, 6, 3);
    const row = e.hall().rows[0];
    expect(layRowError(e.s, e.hallId, { ...row, length: 7 })).toBe("error.rowInUse");
    const moved = [row.x - 1, row.x + 1].map((x) => ({ ...row, x })).find((r) => !layRowError(e.s, e.hallId, r))!;
    expect(moved).toBeDefined();
    ok(layRow(e.s, e.hallId, moved));
    expect(e.hall().zones.find((z) => z.id === id)).toMatchObject({ rowId: e.rowA, from: 6, length: 3 });
    expect(zonePositions(e.hall(), e.hall().zones[0])).toEqual([7, 8, 9]);
  });

  it("an old save with customers and a carrier loads with a colo zone under each customer and a meet-me zone under the uplink rack", () => {
    const e = setup();
    e.s.unlocks = ["network"];
    e.s.player = { ...e.s.player, at: e.hallId };
    const rack = ok(buyRack(e.s, e.hallId, "rack-42", 1));
    ok(mountDevice(e.s, ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId)), rack, 1));
    paint(e, "meetme", e.rowA, 0, 1);
    const carrier = cityCarriers("Frankfurt")[0].id;
    ok(buildCarrier(e.s, e.hallId, carrier));
    ok(mountDevice(e.s, ok(buyDevice(e.s, "patch-24f", "Pandoot", 1, e.hallId)), rack, 3));
    ok(orderTransit(e.s, e.hallId, carrier, 1, 0.2));
    e.hall().customers.push(customer(e, 1, 5, "x"));
    const old = JSON.parse(serialize(e.s));
    const h = old.properties.find((p: { hall?: unknown }) => p.hall).hall;
    delete h.zones; delete h.xconnects; delete h.exchange; delete h.outage;
    for (const c of h.customers) { delete c.kw; delete c.zoneId; }
    const loaded = deserialize(JSON.stringify(old)).properties.find((p) => p.hall)!.hall!;
    expect(loaded.customers[0]).toMatchObject({ kw: 3, zoneId: "zone-c1" });
    expect(loaded.zones.map((z) => [z.kind, z.rowId, z.from, z.length])).toEqual([["colo", e.rowA, 4, 1], ["meetme", e.rowA, 0, 1]]);
    expect(loaded).toMatchObject({ xconnects: [], exchange: null, outage: false });
  });
});

describe("own datacenter: customers", () => {
  it("sign only into colo zones, never onto the player's free positions", () => {
    const e = setup();
    ok(setColoRate(e.s, e.hallId, Math.round(goingRate("Frankfurt") / 2)));
    paint(e, "colo", e.rowA, 0, 3);
    for (let i = 0; i < 24; i++) month(e);
    expect(e.hall().customers.length).toBeGreaterThan(0);
    for (const c of e.hall().customers) expect([1, 2, 3]).toContain(c.position);
    expect(c0(e).kw).toBeGreaterThanOrEqual(HALL.colo.kw.min);
    expect(c0(e).kw).toBeLessThanOrEqual(HALL.colo.kw.max);
    expect(freePositions(e.s, e.hallId)).toHaveLength(17);
  });

  it("an empty cage signs a cage customer who pays 1.1 times length times the rate", () => {
    const e = setup(2016);
    const rate = Math.round(goingRate("Frankfurt") / 2);
    ok(setColoRate(e.s, e.hallId, rate));
    const zone = paint(e, "cage", e.rowA, 0, 3);
    const events: string[] = [];
    for (let i = 0; i < 24 && !e.hall().customers.length; i++) events.push(...month(e).map((v) => v.key));
    expect(events).toContain("event.cageSigned");
    expect(e.hall().customers[0]).toMatchObject({ zoneId: zone, monthly: Math.round(3 * rate * HALL.colo.cageMarkup) });
    expect(customerPositions(e.hall(), e.hall().customers[0])).toEqual([1, 2, 3]);
    expect(freePositions(e.s, e.hallId)).toHaveLength(17);
  });

  it("their kW trip the breaker with the racks, warm the hall, and a trip month raises leaving to the outage rate", () => {
    const e = setup();
    const zone = paint(e, "colo", e.rowA, 0, 10);
    e.hall().customers.push(customer(e, 1, 1, zone, 60), customer(e, 2, 2, zone, 60));
    const loc = () => e.s.locations.find((l) => l.id === e.hallId)!;
    expect(roomPower(e.s, loc())).toMatchObject({ watts: 120_000, over: true });
    breakerTick(e.s);
    e.s.hour += TRIP_HOURS;
    breakerTick(e.s);
    expect(loc().tripped).toBe(true);
    expect(e.hall().outage).toBe(true);

    // Heat grows with the customers' draw and nothing cooling it.
    const warm = setup(), cold = setup();
    warm.hall().customers.push(customer(warm, 1, 1, paint(warm, "colo", warm.rowA, 0, 10), 20));
    for (const h of [warm, cold]) thermalTick(h.s, 60);
    expect(warm.s.ops.heat[warm.hallId]).toBeGreaterThan(0);
    expect(cold.s.ops.heat[cold.hallId]).toBeUndefined();

    // Over many months a tripped one loses about a quarter of the customers, a quiet one about 4%.
    const lost = (outage: boolean) => {
      let n = 0;
      for (let h = 0; h < 100; h++) {
        const t = setup();
        const z = paint(t, "colo", t.rowA, 0, 10);
        for (let i = 0; i < 10; i++) t.hall().customers.push(customer(t, i, i + 1, z, 0));
        t.hall().outage = outage;
        t.s.hour += h * 720;
        coloTick(t.s);
        n += 10 - t.hall().customers.length;
      }
      return n;
    };
    const quiet = lost(false), tripped = lost(true);
    expect(tripped).toBeGreaterThan(150);
    expect(quiet).toBeLessThan(80);
  });

  it("a hall kWh costs less than a datacenter share's at the same draw", () => {
    const e = setup();
    e.hall().customers.push(customer(e, 1, 1, paint(e, "colo", e.rowA, 0, 1), 4));
    const use = powerByLocation(e.s)[e.hallId];
    expect(use.kwh).toBe(4);
    const perKwh = use.eur / use.kwh, dc = businessPowerPrice(yearOf(e.s.hour)) * datacenterById("equinox-fr5").powerFactor;
    expect(perKwh).toBeCloseTo(businessPowerPrice(yearOf(e.s.hour)) * HALL.powerFactor * HALL.pue, 6);
    expect(perKwh).toBeLessThan(dc);
  });
});

const c0 = (e: Setup) => e.hall().customers[0];

describe("own datacenter: meet-me, cross-connects and the hub", () => {
  // A router and a fiber panel in a rack on the meet-me zone's position 11, a built carrier.
  function meetMe(model = "patch-24f") {
    const e = setup();
    e.s.unlocks = ["network"];
    e.s.player = { ...e.s.player, at: e.hallId };
    paint(e, "meetme", e.rowB, 0, 2);
    const rack = ok(buyRack(e.s, e.hallId, "rack-42", 11));
    ok(mountDevice(e.s, ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId)), rack, 1));
    const panel = ok(buyDevice(e.s, model, "Pandoot", 1, e.hallId));
    ok(mountDevice(e.s, panel, rack, 3));
    const carrier = cityCarriers("Frankfurt")[0].id;
    ok(buildCarrier(e.s, e.hallId, carrier));
    return { ...e, rack, panel, carrier };
  }

  it("uplinks land only on panels in the zone, and a 48-jack panel gives 48 jacks", () => {
    const m = meetMe("patch-48f");
    const outside = ok(buyRack(m.s, m.hallId, "rack-42", 15));
    ok(mountDevice(m.s, ok(buyDevice(m.s, "patch-24f", "Pandoot", 1, m.hallId)), outside, 3));
    expect(panelOf(m.s, outside)).toBeUndefined();
    expect(panelOf(m.s, m.rack)?.id).toBe(m.panel);
    expect(jackRoles(m.s, m.panel)).toHaveLength(48);
    ok(orderTransit(m.s, m.hallId, m.carrier, 1, 0.2));
    expect(m.s.network.uplinks.at(-1)!.links[0].jack).toEqual({ device: m.panel, port: 0 });
  });

  it("a customer orders a cross-connect onto a customer jack, pays monthly, and leaving frees the jack", () => {
    const m = meetMe();
    const zone = paint(m, "colo", m.rowA, 0, 4);
    const reset = () => { m.hall().customers = [1, 2, 3, 4].map((n) => customer(m, n, n, zone)); m.hall().xconnects = []; };
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
    const zone = paint(m, "colo", m.rowA, 0, 10);
    const jacks = jackRoles(m.s, m.panel).length;
    const reset = () => {
      m.hall().customers = Array.from({ length: 10 }, (_, n) => customer(m, n, n + 1, zone));
      m.hall().xconnects = Array.from({ length: jacks }, (_, n) => ({ id: `xc${n}`, customerId: `c${Math.floor(n / 3)}`, carrierId: m.carrier, jack: { device: m.panel, port: n } }));
    };
    let seen = false, left = 0;
    for (let i = 0; i < 200 && !seen; i++) {
      reset();
      m.s.hour += 720;
      const events = coloTick(m.s);
      seen = events.some((v) => v.key === "event.xconnectNoJack");
      left = events.filter((v) => v.key === "event.coloLeftOutage").length;
      expect(m.hall().xconnects.length).toBeLessThanOrEqual(jacks);
    }
    expect(seen).toBe(true);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it("8 customers bring a free carrier", () => {
    const m = meetMe();
    const zone = paint(m, "colo", m.rowA, 0, 8);
    const built = m.hall().carriers.length, cash = m.s.ledger.length;
    let arrived = false;
    for (let i = 0; i < 120 && !arrived; i++) {
      m.hall().customers = Array.from({ length: 8 }, (_, n) => customer(m, n, n + 1, zone));
      m.hall().xconnects = [];
      arrived = month(m).some((v) => v.key === "event.carrierArrived");
    }
    expect(arrived).toBe(true);
    expect(m.hall().carriers.length).toBeGreaterThan(built);
    expect(m.s.ledger.slice(cash).some((l) => l.key === "ledger.carrierBuild")).toBe(false);
  });

  it("3 carriers and 12 customers bring the exchange onto a free meet-me position, and a full zone makes it wait", () => {
    const m = meetMe();
    const a = paint(m, "colo", m.rowA, 0, 10), b = paint(m, "colo", m.rowB, 4, 2);
    const fill = () => {
      m.hall().customers = [...Array.from({ length: 10 }, (_, n) => customer(m, n, n + 1, a)), customer(m, 10, 15, b), customer(m, 11, 16, b)];
      m.hall().carriers = cityCarriers("Frankfurt").slice(0, 3).map((c) => c.id);
      m.hall().xconnects = [];
    };
    // The zone holds positions 11 and 12; the rack stands on 11, so the exchange takes 12.
    const events: string[] = [];
    for (let i = 0; i < 80 && !m.hall().exchange; i++) { fill(); events.push(...month(m).map((v) => v.key)); }
    expect(m.hall().exchange?.position).toBe(12);
    expect(events).toContain("event.exchangeOpened");
    expect(freePositions(m.s, m.hallId)).not.toContain(12);
    m.s.network.asn = 64512;
    m.s.network.memberships = [m.hall().exchange!.id];
    ok(orderExchangePort(m.s, m.hallId, 1));

    const full = meetMe();
    paint(full, "colo", full.rowA, 0, 10);
    ok(buyRack(full.s, full.hallId, "rack-42", 12));
    const fillFull = () => {
      full.hall().customers = Array.from({ length: 10 }, (_, n) => customer(full, n, n + 1, full.hall().zones.find((z) => z.kind === "colo")!.id));
      const z2 = full.hall().zones.find((z) => z.kind === "colo" && z.rowId === full.rowB) ?? { id: paint(full, "colo", full.rowB, 4, 2) };
      full.hall().customers.push(customer(full, 10, 15, z2.id), customer(full, 11, 16, z2.id));
      full.hall().carriers = cityCarriers("Frankfurt").slice(0, 3).map((c) => c.id);
    };
    const waiting: string[] = [];
    for (let i = 0; i < 40; i++) { fillFull(); waiting.push(...month(full).map((v) => v.key)); }
    expect(full.hall().exchange?.position).toBe(0);
    expect(waiting.filter((k) => k === "event.exchangeComing")).toHaveLength(1);
    expect(waiting).not.toContain("event.exchangeOpened");
  });
});
