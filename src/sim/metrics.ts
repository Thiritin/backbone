import { LEVELS } from "./10-catalog/economy";
import type { GameState } from "./50-state";

const HOURS_PER_YEAR = 24 * 365;

export function metrics(s: GameState) {
  // ponytail: revenue and hardware read zero until billing and hardware value land in metrics.
  const mrr = 0, hardware = 0;
  const customers = s.customers.filter((c) => c.churnedAt === null).length;
  const openTickets = s.tickets.filter((t) => t.status === "open").length;
  const debt = s.loans.reduce((sum, l) => sum + l.balance, 0);
  const netWorth = s.cash - debt + hardware + 24 * mrr;
  const years = s.hour / HOURS_PER_YEAR;
  const level = LEVELS.filter((l) => netWorth >= l.netWorth && years >= l.years).at(-1)!;
  const next = LEVELS.find((l) => l.level === level.level + 1);
  return { cash: s.cash, mrr, customers, openTickets, netWorth, level, next, progress: next ? Math.min(1, netWorth / next.netWorth) : 1 };
}
