import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { businessPowerPrice } from "../10-catalog/economy";
import { modelById } from "../10-catalog/hardware";
import type { GameState, LedgerEntry } from "../50-state";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

const HOUSEHOLD_FACTOR = 1.6;
const cents = (v: number) => Math.round(v * 100) / 100;

// Euros of power drawn in one hour. Rented racks include power in the rent (economy.md, Hardware, power and failures).
// ponytail: idle draw only and no rented power budget; load-based draw and kW overage come with workloads.
export function powerPerHour(s: GameState): number {
  const basement = new Set(s.locations.filter((l) => l.kind === "basement").map((l) => l.id));
  const racks = new Set(s.racks.filter((r) => basement.has(r.locationId)).map((r) => r.id));
  const watts = s.devices.filter((d) => racks.has(d.rackId)).reduce((sum, d) => sum + modelById(d.model).idleWatts, 0);
  return (watts / 1000) * businessPowerPrice(yearOf(s.hour)) * HOUSEHOLD_FACTOR;
}

export function tick(state: GameState): SimEvent[] {
  state.powerDue += powerPerHour(state);
  state.hour++;
  const events: SimEvent[] = [];
  if (isMonthStart(state.hour)) {
    const d = dateOf(state.hour);
    events.push({ app: "Finance", key: "event.monthStart", params: { month: d.getUTCMonth(), year: d.getUTCFullYear() } });
    const power = cents(state.powerDue);
    const bills: LedgerEntry[] = state.racks.filter((r) => r.rentPerMonth > 0)
      .map((r) => ({ hour: state.hour, category: "rent", key: "ledger.rent", params: { rack: r.name }, amount: -r.rentPerMonth }));
    if (power > 0) bills.unshift({ hour: state.hour, category: "power", key: "ledger.power", params: {}, amount: -power });
    const rent = bills.filter((b) => b.category === "rent").reduce((sum, b) => sum - b.amount, 0);
    state.cash = cents(state.cash - power - rent);
    state.powerDue = 0;
    // The store shallow-copies the state before ticking, so arrays are replaced rather than pushed to.
    state.ledger = [...state.ledger, ...bills];
    if (bills.length) events.push({ app: "Finance", key: "event.bills", params: { power, rent, total: cents(power + rent) } });
  }
  return events;
}
