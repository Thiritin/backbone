import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import { TAX_RATE } from "../10-catalog/economy";
import { COMPONENTS } from "../10-catalog/hardware";
import { cents, loanAvailable } from "../45-billing/billing";
import type { Component, GameState, LedgerEntry } from "../50-state";
import { HOURS_PER_YEAR } from "../60-infra/status";
import { failureChance, type SimEvent } from "../88-tick/tick";

export interface Policy { id: "hardware"; since: number }

export const TAX_MONTH = 3;
export const INSOLVENT_DAYS = 30;
export const PREMIUM_MARKUP = 1.5;
export const MIN_PREMIUM = 1;

export const yearStart = (year: number): number => hourOf(new Date(Date.UTC(year, 0, 1)));
export const monthStartOf = (hour: number): number => {
  const d = dateOf(hour);
  return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
};

// Loan principal moves cash without being profit; an instalment counts only its interest.
export function profitOf(e: LedgerEntry): number {
  if (e.category === "tax") return 0;
  if (e.category !== "loans") return e.amount;
  if (e.key === "ledger.loanRepayment") return -Number(e.params.interest);
  return e.key === "ledger.loanFee" ? e.amount : 0;
}

export const profitBetween = (s: GameState, from: number, to: number): number =>
  cents(s.ledger.filter((e) => e.hour >= from && e.hour < to).reduce((sum, e) => sum + profitOf(e), 0));

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

// Normal wear and tear is not covered: only failures within the component's life expectancy.
const withinLife = (c: Component, at: number) => at - c.installedAt < COMPONENTS[c.kind].life * HOURS_PER_YEAR;

// A month's hardware premium: the expected cost of spare parts for every covered component at its current failure rate, with the insurer's markup.
export function hardwarePremium(s: GameState): number {
  const yearly = s.devices.reduce((sum, d) => sum + d.components.filter((c) => c.failedAt === null && withinLife(c, s.hour))
    .reduce((a, c) => a + failureChance(s, d, c) * HOURS_PER_YEAR * COMPONENTS[c.kind].price, 0), 0);
  return Math.max(MIN_PREMIUM, cents((yearly * PREMIUM_MARKUP) / 12));
}

const book = (s: GameState, category: string, key: string, params: LedgerEntry["params"], amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category, key, params, amount }];
};

// The hardware policy pays the spare part and the remote hands for a component that failed while insured and within its life expectancy.
export function claimRepair(s: GameState, device: string, c: Component, part: number, hands: number): void {
  const policy = s.insurance.find((p) => p.id === "hardware");
  if (!policy || c.failedAt === null || c.failedAt < policy.since || !withinLife(c, c.failedAt)) return;
  book(s, "insurance", "ledger.insuranceClaim", { device, component: c.kind }, cents(part + hands));
}

export const chargePremium = (s: GameState): number => {
  const premium = hardwarePremium(s);
  book(s, "insurance", "ledger.insurancePremium", { policy: "hardware" }, -premium);
  return premium;
};

// The bank still lends enough to bring cash back to zero. Checked once a day after the 30 days.
const rescuable = (s: GameState): boolean => s.hour >= s.loansBlockedUntil && loanAvailable(s) >= -s.cash;

export function financeTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (isMonthStart(s.hour)) {
    if (s.insurance.length) chargePremium(s);
    if (dateOf(s.hour).getUTCMonth() === TAX_MONTH) {
      const year = yearOf(s.hour) - 1;
      const { profit, tax, carry } = taxFor(s, year);
      s.taxLoss = carry;
      if (tax > 0) {
        book(s, "tax", "ledger.tax", { year }, -tax);
        events.push({ app: "Finance", key: "event.tax", params: { year, tax, profit } });
      } else if (profit < 0) events.push({ app: "Finance", key: "event.taxLoss", params: { year, carry } });
    }
  }
  if (s.cash >= 0) s.brokeSince = null;
  else if (s.brokeSince === null) {
    s.brokeSince = s.hour;
    events.push({ app: "Finance", key: "event.cashNegative", params: { days: INSOLVENT_DAYS } });
  } else if (s.gameOver === null && s.hour - s.brokeSince >= INSOLVENT_DAYS * 24 && (s.hour - s.brokeSince) % 24 === 0 && !rescuable(s)) {
    s.gameOver = s.hour;
    events.push({ app: "Finance", key: "event.bankrupt", params: { days: INSOLVENT_DAYS } });
  }
  return events;
}
