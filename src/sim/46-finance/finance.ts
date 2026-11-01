import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import { TAX_RATE } from "../10-catalog/economy";
import { cents, loanAvailable } from "../45-billing/billing";
import { payOf } from "../47-staff/staff";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

export const TAX_MONTH = 3;
export const INSOLVENT_DAYS = 30;

export const yearStart = (year: number): number => hourOf(new Date(Date.UTC(year, 0, 1)));
export const monthStartOf = (hour: number): number => {
  const d = dateOf(hour);
  return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
};

// Loan principal and the owner's capital move cash without being profit; an instalment counts only its interest.
export function profitOf(e: LedgerEntry): number {
  if (e.category === "tax" || e.category === "capital") return 0;
  if (e.category !== "loans") return e.amount;
  if (e.key === "ledger.loanRepayment") return -Number(e.params.interest);
  return e.key === "ledger.loanFee" ? e.amount : 0;
}

export const profitBetween = (s: GameState, from: number, to: number): number =>
  cents(s.ledger.filter((e) => e.hour >= from && e.hour < to).reduce((sum, e) => sum + profitOf(e), 0));

// Average monthly loss of the last three full months, with today's payroll in place of their salaries, plus extra.
export function monthlyBurn(s: GameState, extra = 0): number {
  const start = monthStartOf(s.hour), from = monthStartOf(monthStartOf(monthStartOf(start - 1) - 1) - 1);
  const paid = -s.ledger.filter((l) => l.category === "salaries" && l.hour >= from && l.hour < start).reduce((n, l) => n + l.amount, 0);
  return (-profitBetween(s, from, start) - paid) / 3 + s.staff.reduce((n, e) => n + payOf(s, e), 0) + extra;
}

// Months the cash lasts at that burn; Infinity when the company makes money.
export function runwayMonths(s: GameState, extra = 0): number {
  const burn = monthlyBurn(s, extra);
  return s.cash <= 0 ? 0 : burn > 0 ? s.cash / burn : Infinity;
}

export const monthKey = (hour: number): string => dateOf(hour).toISOString().slice(0, 7);
// The last count month keys up to the current one, oldest first.
export const lastMonths = (s: GameState, count: number): string[] => {
  const now = dateOf(s.hour);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + 1 + i, 1)).toISOString().slice(0, 7));
};

export interface MonthFlow { key: string; inflow: number; outflow: number; end: number }
// Money in and out per month and the balance at each month's end.
export function cashFlow(s: GameState, count: number): MonthFlow[] {
  const keys = lastMonths(s, count);
  const flows = new Map(keys.map((key) => [key, { key, inflow: 0, outflow: 0, end: 0 }]));
  for (const e of s.ledger) {
    const f = flows.get(monthKey(e.hour));
    if (f) { if (e.amount > 0) f.inflow += e.amount; else f.outflow -= e.amount; }
  }
  let end = s.cash;
  for (const key of [...keys].reverse()) {
    const f = flows.get(key)!;
    f.end = end;
    end -= f.inflow - f.outflow;
  }
  return keys.map((k) => flows.get(k)!);
}

export const REVENUE = ["payments", "setup", "sales"];
export interface MonthStats { key: string; customers: number; joined: number; churned: number; revenue: number; lost: number }
// Customers at each month's end, those who joined and left in it, the revenue booked and the sales lost.
export function monthlyStats(s: GameState, count: number): MonthStats[] {
  const real = s.customers.filter((c) => !c.sponsor);
  return lastMonths(s, count).map((key) => {
    const at = (h: number) => monthKey(h) === key, end = (h: number) => monthKey(h) <= key;
    return {
      key,
      customers: real.filter((c) => end(c.since) && (c.churnedAt === null || !end(c.churnedAt))).length,
      joined: real.filter((c) => at(c.since)).length,
      churned: real.filter((c) => c.churnedAt !== null && at(c.churnedAt)).length,
      revenue: cents(s.ledger.filter((e) => REVENUE.includes(e.category) && at(e.hour)).reduce((n, e) => n + e.amount, 0)),
      lost: s.sales.lost.filter((l) => at(l.hour)).length,
    };
  });
}

// Tax on a year's profit after the losses carried from earlier years, and the loss carried on.
export function taxFor(s: GameState, year: number): { profit: number; tax: number; carry: number } {
  const profit = profitBetween(s, yearStart(year), yearStart(year + 1));
  const base = profit - s.taxLoss;
  return base > 0 ? { profit, tax: cents(base * TAX_RATE), carry: 0 } : { profit, tax: 0, carry: cents(-base) };
}

// The next April's tax: last year's until it is paid, then the running year's so far.
export function nextTax(s: GameState): { year: number; dueAt: number; profit: number; tax: number; carry: number } {
  const year = yearOf(s.hour) - (dateOf(s.hour).getUTCMonth() < TAX_MONTH ? 1 : 0);
  return { year, dueAt: hourOf(new Date(Date.UTC(year + 1, TAX_MONTH, 1))), ...taxFor(s, year) };
}

const book = (s: GameState, category: string, key: string, params: LedgerEntry["params"], amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category, key, params, amount }];
};

// The bank still lends enough to bring cash back to zero. Checked once a day after the 30 days.
const rescuable = (s: GameState): boolean => s.hour >= s.loansBlockedUntil && loanAvailable(s) >= -s.cash;

export function financeTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (isMonthStart(s.hour)) {
    if (dateOf(s.hour).getUTCMonth() === TAX_MONTH) {
      const year = yearOf(s.hour) - 1;
      const { profit, tax, carry } = taxFor(s, year);
      s.taxLoss = carry;
      if (tax > 0) {
        book(s, "tax", "ledger.tax", { year }, -tax);
        events.push({ app: "Books", key: "event.tax", params: { year, tax, profit } });
      } else if (profit < 0) events.push({ app: "Books", key: "event.taxLoss", params: { year, carry } });
    }
  }
  // The overdraft keeps the company solvent down to its limit.
  if (s.cash >= -(s.bank?.overdraft ?? 0)) s.brokeSince = null;
  else if (s.brokeSince === null) {
    s.brokeSince = s.hour;
    events.push({ app: "Books", key: "event.cashNegative", params: { days: INSOLVENT_DAYS } });
  } else if (s.gameOver === null && s.hour - s.brokeSince >= INSOLVENT_DAYS * 24 && (s.hour - s.brokeSince) % 24 === 0 && !rescuable(s)) {
    s.gameOver = s.hour;
    events.push({ app: "Books", key: "event.bankrupt", params: { days: INSOLVENT_DAYS } });
  }
  return events;
}
