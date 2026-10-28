import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { businessPowerPrice } from "../10-catalog/economy";
import { modelById } from "../10-catalog/hardware";
import { datacenterById, HOUSEHOLD_FACTOR, spacePrice } from "../20-world/datacenters";
import type { GameState, LedgerEntry, SpaceKind } from "../50-state";
import { locationOf, powered } from "../60-infra/status";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

const cents = (v: number) => Math.round(v * 100) / 100;

// Euros of power drawn in one hour: every powered device at the business price × the datacenter's power factor, or the household price in the basement.
export function powerPerHour(s: GameState): number {
  const price = businessPowerPrice(yearOf(s.hour));
  return s.devices.filter((d) => powered(s, d.id)).reduce((sum, d) => {
    const loc = locationOf(s, d)!;
    return sum + (modelById(d.model).watts / 1000) * price * (loc.dc ? datacenterById(loc.dc).powerFactor : HOUSEHOLD_FACTOR);
  }, 0);
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
  if (isMonthStart(state.hour)) {
    const d = dateOf(state.hour);
    events.push({ app: "Finance", key: "event.monthStart", params: { month: d.getUTCMonth(), year: d.getUTCFullYear() } });
    const power = cents(state.powerDue);
    const bills: LedgerEntry[] = state.locations.filter((l) => l.dc)
      .map((l) => ({ hour: state.hour, category: "rent", key: "ledger.space", params: { location: l.name }, amount: -spacePrice(datacenterById(l.dc!), l.space as Exclude<SpaceKind, "basement">, l.positions) }));
    if (power > 0) bills.unshift({ hour: state.hour, category: "power", key: "ledger.power", params: {}, amount: -power });
    const rent = bills.filter((b) => b.category === "rent").reduce((sum, b) => sum - b.amount, 0);
    state.cash = cents(state.cash - power - rent);
    state.powerDue = 0;
    state.ledger = [...state.ledger, ...bills];
    if (bills.length) events.push({ app: "Finance", key: "event.bills", params: { power, rent, total: cents(power + rent) } });
  }
  return events;
}
