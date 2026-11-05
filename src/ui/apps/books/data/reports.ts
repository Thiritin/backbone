import { dateOf } from "../../../../sim/00-core/time";
import { monthKey, monthStartOf, profitBetween, profitOf, REVENUE, runwayMonths } from "../../../../sim/46-finance/finance";
import type { GameState } from "../../../../sim/50-state";
import { metrics } from "../../../../sim/metrics";

// Profit and loss for one year, by month up to the current month for the running year.
export function profitLoss(s: GameState, year: number) {
  const last = year === dateOf(s.hour).getUTCFullYear() ? dateOf(s.hour).getUTCMonth() : 11;
  const keys = Array.from({ length: last + 1 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}`);
  const sums = new Map<string, number[]>();
  for (const e of s.ledger) {
    const m = keys.indexOf(monthKey(e.hour));
    if (m < 0) continue;
    const row = sums.get(e.category) ?? Array<number>(keys.length).fill(0);
    row[m] += e.category === "tax" ? e.amount : profitOf(e);
    sums.set(e.category, row);
  }
  const cats = [...sums.keys()].filter((c) => c !== "tax" && sums.get(c)!.some((v) => v !== 0));
  const total = (list: string[]) => keys.map((_, m) => list.reduce((sum, c) => sum + (sums.get(c)?.[m] ?? 0), 0));
  const revenue = cats.filter((c) => REVENUE.includes(c)), costs = cats.filter((c) => !REVENUE.includes(c));
  const before = total(cats), tax = total(["tax"]), net = keys.map((_, m) => before[m] + tax[m]);
  return { keys, sums, revenue, costs, total, before, tax, net };
}

// The headline figures: cash, recurring revenue, last month's profit (and its month key) and runway.
export function overview(s: GameState) {
  const start = monthStartOf(s.hour), prev = monthStartOf(start - 1);
  return { cash: s.cash, mrr: metrics(s).mrr, prevMonth: monthKey(prev), lastMonth: profitBetween(s, prev, start), runway: runwayMonths(s) };
}
