import { LEVELS } from "./10-catalog/economy";
import type { GameState } from "./50-state";
import { resaleValue } from "./60-infra/status";

const HOURS_PER_YEAR = 24 * 365;
const HOURS_PER_MONTH = 730;

// Recurring revenue of every running contract per month: hourly prices × 730, yearly ones ÷ 12.
export const mrr = (s: GameState): number =>
  Math.round(s.services.filter((v) => v.endedAt === null).reduce((sum, v) => sum + (v.period === "hour" ? v.price * HOURS_PER_MONTH : v.price / 12), 0) * 100) / 100;

// Book value of owned hardware: devices and racks at their resale value; leased devices belong to the lessor.
export const hardwareValue = (s: GameState): number =>
  [...s.devices.filter((d) => !d.lease), ...s.racks.filter((r) => !r.provided)].reduce((sum, x) => sum + resaleValue(s, x.price, x.boughtAt), 0);

export function metrics(s: GameState) {
  const revenue = mrr(s), hardware = hardwareValue(s);
  const customers = s.customers.filter((c) => c.churnedAt === null).length;
  const openTickets = s.tickets.filter((t) => t.status === "open").length;
  const debt = s.loans.reduce((sum, l) => sum + l.balance, 0);
  const netWorth = s.cash - debt + hardware + 24 * revenue;
  const years = s.hour / HOURS_PER_YEAR;
  const level = LEVELS.filter((l) => netWorth >= l.netWorth && years >= l.years).at(-1) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.level === level.level + 1);
  return { cash: s.cash, mrr: revenue, customers, openTickets, netWorth, level, next, progress: next ? Math.min(1, Math.max(0, netWorth / next.netWorth)) : 1 };
}
