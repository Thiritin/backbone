import { binomial, rand } from "../00-core/rng";
import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { businessPowerPrice } from "../10-catalog/economy";
import { billingTick } from "../45-billing/billing";
import { modelById } from "../10-catalog/hardware";
import { lessorName } from "../10-catalog/leasing";
import { capacityAt, DATACENTERS, datacenterById, HOUSEHOLD_FACTOR } from "../20-world/datacenters";
import type { GameState, LedgerEntry } from "../50-state";
import { supportTick } from "../40-support/tick";
import { dcAvailability, fits, locationOf, locationRent, powered } from "../60-infra/status";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

const cents = (v: number) => Math.round(v * 100) / 100;

// Drops the lease and makes its devices owned.
export function endLease(s: GameState, leaseId: string) {
  s.leases = s.leases.filter((l) => l.id !== leaseId);
  s.devices = s.devices.map((d) => (d.lease === leaseId ? { ...d, lease: null } : d));
}

// Euros of power drawn in one hour: every powered device at the business price × the datacenter's power factor, or the household price in the basement.
export function powerPerHour(s: GameState): number {
  const price = businessPowerPrice(yearOf(s.hour));
  return s.devices.filter((d) => powered(s, d.id)).reduce((sum, d) => {
    const loc = locationOf(s, d)!;
    return sum + (modelById(d.model).watts / 1000) * price * (loc.dc ? datacenterById(loc.dc).powerFactor : HOUSEHOLD_FACTOR);
  }, 0);
}

export const CANCEL_CHANCE = 0.015;
export const FREE_TARGET = 0.04;
export const HOLD_HOURS = 7 * 24;

const setOthers = (s: GameState, id: string, others: number) => {
  s.dcs = { ...s.dcs, [id]: { others } };
};

// Every competitor position cancels with a small chance each month.
function competitorsCancel(s: GameState) {
  for (const dc of DATACENTERS) setOthers(s, dc.id, s.dcs[dc.id].others - binomial(s.rng, s.dcs[dc.id].others, CANCEL_CHANCE));
}

// In the first 3 months of an expansion phase competitors take a sixth of the new positions a month; otherwise they fill
// free space down to a random level between 0% and 4% of capacity. Held and player space is never taken.
function competitorsTake(s: GameState) {
  const year = yearOf(s.hour), month = dateOf(s.hour).getUTCMonth();
  for (const dc of DATACENTERS) {
    const { capacity, free } = dcAvailability(s, dc.id);
    const phase = capacity - capacityAt(dc, year - 1);
    const take = phase > 0 && month < 3 ? Math.round(phase / 6) : free - Math.floor(rand(s.rng) * FREE_TARGET * capacity);
    if (take > 0) setOthers(s, dc.id, s.dcs[dc.id].others + Math.min(free, take));
  }
}

// Expired holds are released; waiting entries whose space is free get it held, in the order they joined.
function updateHolds(s: GameState, events: SimEvent[]) {
  for (const w of s.waitlist) {
    const name = datacenterById(w.dc).name;
    if (w.heldUntil !== null && w.heldUntil <= s.hour) {
      s.waitlist = s.waitlist.filter((x) => x.id !== w.id);
      events.push({ app: "Locations", key: "event.holdExpired", params: { datacenter: name } });
    } else if (w.heldUntil === null && fits(s, w.dc, w.space, w.size)) {
      s.waitlist = s.waitlist.map((x) => (x.id === w.id ? { ...x, heldUntil: s.hour + HOLD_HOURS } : x));
      events.push({ app: "Locations", key: "event.spaceHeld", params: { datacenter: name, days: HOLD_HOURS / 24 } });
    }
  }
}

export function tick(state: GameState): SimEvent[] {
  state.powerDue += powerPerHour(state);
  state.hour++;
  const events: SimEvent[] = [];
  // The store shallow-copies the state before ticking, so arrays and their items are replaced rather than changed.
  if (state.racks.some((r) => r.arriveAt !== null && r.arriveAt <= state.hour)) {
    state.racks = state.racks.map((r) => {
      if (r.arriveAt === null || r.arriveAt > state.hour) return r;
      const loc = state.locations.find((l) => l.id === r.locationId)!;
      events.push({ app: "Locations", key: "event.rackArrived", params: { rack: r.name, location: loc.name } });
      return { ...r, arriveAt: null };
    });
  }
  if (state.devices.some((d) => d.arriveAt !== null && d.arriveAt <= state.hour)) {
    const arrived = new Map<string, number>();
    state.devices = state.devices.map((d) => {
      if (d.arriveAt === null || d.arriveAt > state.hour) return d;
      arrived.set(d.transitTo!, (arrived.get(d.transitTo!) ?? 0) + 1);
      return { ...d, store: d.transitTo, transitTo: null, arriveAt: null };
    });
    for (const [id, count] of arrived) {
      events.push({ app: "Locations", key: "event.stockArrived", params: { count, location: state.locations.find((l) => l.id === id)!.name } });
    }
  }
  const monthStart = isMonthStart(state.hour);
  if (monthStart) {
    state.rng = { ...state.rng };
    competitorsCancel(state);
  }
  if (state.waitlist.length) updateHolds(state, events);
  if (monthStart) competitorsTake(state);
  if (monthStart) {
    const d = dateOf(state.hour);
    events.push({ app: "Finance", key: "event.monthStart", params: { month: d.getUTCMonth(), year: d.getUTCFullYear() } });
    const power = cents(state.powerDue);
    const bills: LedgerEntry[] = state.locations.filter((l) => l.dc)
      .map((l) => ({ hour: state.hour, category: "rent", key: "ledger.space", params: { location: l.name }, amount: -locationRent(state, l) }));
    const leases = state.leases.map((l) => ({ ...l, paid: l.paid + 1 }));
    for (const l of leases) bills.push({ hour: state.hour, category: "leasing", key: "ledger.lease", params: { lessor: lessorName(l.lessor), paid: l.paid, months: l.months }, amount: -l.monthly });
    state.leases = leases;
    for (const l of leases.filter((x) => x.paid >= x.months)) endLease(state, l.id);
    if (power > 0) bills.unshift({ hour: state.hour, category: "power", key: "ledger.power", params: {}, amount: -power });
    const rent = bills.filter((b) => b.category === "rent").reduce((sum, b) => sum - b.amount, 0);
    const leasing = bills.filter((b) => b.category === "leasing").reduce((sum, b) => sum - b.amount, 0);
    state.cash = cents(state.cash - power - rent - leasing);
    state.powerDue = 0;
    state.ledger = [...state.ledger, ...bills];
    if (bills.length) events.push({ app: "Finance", key: "event.bills", params: { power, rent, leasing: cents(leasing), total: cents(power + rent + leasing) } });
  }
  events.push(...billingTick(state));
  events.push(...supportTick(state));
  return events;
}
