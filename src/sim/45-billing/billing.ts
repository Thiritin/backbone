import { rand, type Rng } from "../00-core/rng";
import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import type { PaymentHabit } from "../30-customers/customers";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { metrics } from "../metrics";

export type InvoiceStatus = "open" | "overdue" | "paid" | "writtenOff";
// key and params are an i18n line text; serviceId is null for fees.
export interface InvoiceLine { serviceId: string | null; key: string; params: Record<string, string | number>; amount: number }
export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  lines: InvoiceLine[];
  issuedAt: number;
  dueAt: number;
  status: InvoiceStatus;
  // Hour each dunning step was sent, in STEPS order.
  reminders: number[];
  // ponytail: suspension is only a flag; milestone 3 stops the customer's workloads and their billed hours.
  suspended: boolean;
  // Rolled once at issue: 0 pays on time, n pays after the nth dunning step, 4 never pays.
  payStep: number;
  // Hour the money arrives, set once the step that moves the customer is sent.
  payAt: number | null;
  paidAt: number | null;
}
// rate is yearly; left counts the instalments still to pay.
export interface Loan { id: string; amount: number; rate: number; months: number; left: number; payment: number; balance: number; takenAt: number; missed: number }

const DAY = 24;
export const YEAR_HOURS = 8760;
const MONTH_HOURS = YEAR_HOURS / 12;
export const DUE_DAYS = 14;
export const cents = (v: number) => Math.round(v * 100) / 100;

// economy.md, Billing and payment habits. days count from the due date.
export const STEPS = [
  { key: "reminder", days: 7, fee: 0 },
  { key: "dunning", days: 14, fee: 5 },
  { key: "final", days: 28, fee: 10 },
  { key: "collections", days: 42, fee: 0 },
] as const;
export const COLLECTIONS_SHARE = 0.3;
export const COLLECTIONS_DAYS = 30;

// Odds of paying on time, after the reminder, the dunning notice, the final notice, or never.
// The doc's budget rows map onto habits: prompt is medium, late is high, bad is low.
export const PAY_ODDS: Record<PaymentHabit, number[]> = {
  prompt: [0.9, 0.06, 0.02, 0.01, 0.01],
  late: [0.65, 0.3, 0.04, 0.01, 0],
  bad: [0.82, 0.1, 0.04, 0.02, 0.02],
};

export function rollPayStep(r: Rng, habit: PaymentHabit): number {
  let x = rand(r);
  const odds = PAY_ODDS[habit];
  for (let i = 0; i < odds.length; i++) {
    if (x < odds[i]) return i;
    x -= odds[i];
  }
  return odds.length - 1;
}

// A moved customer pays 1 to 5 days after the step.
export const payDelay = (r: Rng): number => DAY * (1 + Math.floor(rand(r) * 5));

export const invoiceTotal = (inv: Invoice): number => cents(inv.lines.reduce((sum, l) => sum + l.amount, 0));
export const isUnpaid = (inv: Invoice): boolean => inv.status === "open" || inv.status === "overdue";

// Index into STEPS of the dunning step that is due now, or null.
export function dueStep(inv: Invoice, hour: number): number | null {
  const i = inv.reminders.length;
  if (!isUnpaid(inv) || i >= STEPS.length) return null;
  return hour >= inv.dueAt + STEPS[i].days * DAY ? i : null;
}

export const isSuspended = (s: GameState, customerId: string): boolean =>
  s.invoices.some((i) => i.customerId === customerId && i.suspended && isUnpaid(i));

const customerName = (s: GameState, id: string) => s.customers.find((c) => c.id === id)?.name ?? id;

// Bank: economy.md, Bank, insurance and tax.
const BASE_RATE: [number, number][] = [[2005, 4], [2009, 2.5], [2015, 1], [2021, 1], [2023, 4.5], [2026, 4]];
const RISK_PREMIUM = [6, 4, 3, 2, 1, 0.5];
const MIN_LIMIT = [10_000, 25_000, 100_000, 500_000, 3_000_000, 20_000_000];
export const LOAN_AMOUNTS = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000, 10_000_000, 20_000_000];
export const LOAN_YEARS = [1, 2, 3, 5, 10];
export const MISSED_FEE = 100;
export const MISSED_RATE = 0.02;
export const MISSED_LIMIT = 3;

export function baseRate(year: number): number {
  const y = Math.min(Math.max(year, BASE_RATE[0][0]), BASE_RATE.at(-1)![0]);
  const i = Math.max(1, BASE_RATE.findIndex(([ky]) => ky >= y));
  const [y0, r0] = BASE_RATE[i - 1], [y1, r1] = BASE_RATE[i];
  return (r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)) / 100;
}

export const loanRate = (s: GameState): number => baseRate(yearOf(s.hour)) + RISK_PREMIUM[metrics(s).level.level - 1] / 100;
export const debt = (s: GameState): number => cents(s.loans.reduce((sum, l) => sum + l.balance, 0));

// The higher of the level's minimum and 12x the average monthly gross profit of the last 6 months, less current debt.
export function loanAvailable(s: GameState): number {
  const since = s.hour - 6 * MONTH_HOURS;
  const profit = s.ledger.filter((e) => e.hour > since && e.category !== "loans").reduce((sum, e) => sum + e.amount, 0) / 6;
  return Math.max(0, Math.max(MIN_LIMIT[metrics(s).level.level - 1], 12 * profit) - debt(s));
}

export function annuity(amount: number, rate: number, months: number): number {
  const r = rate / 12;
  return cents(r === 0 ? amount / months : (amount * r) / (1 - (1 + r) ** -months));
}

export function billingTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const booked: LedgerEntry[] = [];
  const book = (category: string, key: string, params: LedgerEntry["params"], amount: number) => {
    booked.push({ hour: s.hour, category, key, params, amount });
    s.cash = cents(s.cash + amount);
  };

  // The store shallow-copies the state before ticking, so changed records are copied rather than edited.
  let changed = false;
  const invoices = s.invoices.map((inv) => {
    if (inv.payAt !== null && s.hour >= inv.payAt) {
      changed = true;
      const collected = inv.status === "writtenOff";
      const params = { invoice: inv.number, customer: customerName(s, inv.customerId) };
      book("payments", collected ? "ledger.collections" : "ledger.payment", params, cents(invoiceTotal(inv) * (collected ? COLLECTIONS_SHARE : 1)));
      return { ...inv, payAt: null, status: collected ? inv.status : "paid", paidAt: s.hour } satisfies Invoice;
    }
    if (inv.status === "open" && s.hour >= inv.dueAt) {
      changed = true;
      return { ...inv, status: "overdue" } satisfies Invoice;
    }
    return inv;
  });

  const lines = new Map<string, InvoiceLine[]>();
  const add = (customerId: string, line: InvoiceLine) => lines.set(customerId, [...(lines.get(customerId) ?? []), line]);
  const monthStart = isMonthStart(s.hour);
  if (monthStart) {
    const d = dateOf(s.hour);
    const from = hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
    for (const v of s.services) {
      if (v.period !== "hour") continue;
      const hours = Math.min(v.endedAt ?? s.hour, s.hour) - Math.max(v.startedAt, from);
      if (hours > 0) add(v.customerId, { serviceId: v.id, key: "invoice.line.hours", params: { label: v.label, hours }, amount: cents(hours * v.price) });
    }
  }
  let billed = s.yearlyBilledUntil;
  for (const v of s.services) {
    if (v.period !== "year" || v.endedAt !== null) continue;
    const until = billed[v.id] ?? v.startedAt;
    if (s.hour < until) continue;
    billed = { ...billed, [v.id]: until + YEAR_HOURS };
    add(v.customerId, { serviceId: v.id, key: "invoice.line.year", params: { label: v.label }, amount: v.price });
  }
  s.yearlyBilledUntil = billed;

  const issued: Invoice[] = [];
  for (const [customerId, ls] of lines) {
    const payStep = rollPayStep(s.rng, s.customers.find((c) => c.id === customerId)?.habit ?? "prompt");
    issued.push({
      id: `inv${s.nextId++}`, number: `${yearOf(s.hour)}-${String(invoices.length + issued.length + 1).padStart(4, "0")}`,
      customerId, lines: ls, issuedAt: s.hour, dueAt: s.hour + DUE_DAYS * DAY, status: "open", reminders: [], suspended: false,
      payStep, payAt: payStep === 0 ? s.hour + DAY + Math.floor(rand(s.rng) * (DUE_DAYS - 1) * DAY) : null, paidAt: null,
    });
  }
  if (changed || issued.length) s.invoices = [...invoices, ...issued];
  if (monthStart && issued.length) {
    events.push({ app: "Billing", key: "event.invoices", params: { count: issued.length, total: cents(issued.reduce((sum, i) => sum + invoiceTotal(i), 0)) } });
  }

  if (monthStart && s.loans.length) {
    s.loans = s.loans.flatMap((l) => {
      const interest = cents((l.balance * l.rate) / 12);
      const due = Math.min(l.payment, cents(l.balance + interest));
      if (s.cash >= due) {
        book("loans", "ledger.loanRepayment", { amount: l.amount, interest }, -due);
        const balance = cents(l.balance + interest - due);
        return balance > 0 ? [{ ...l, balance, left: Math.max(1, l.left - 1), missed: 0 }] : [];
      }
      book("loans", "ledger.loanFee", { amount: l.amount }, -MISSED_FEE);
      s.loansBlockedUntil = s.hour + YEAR_HOURS;
      if (l.missed + 1 >= MISSED_LIMIT) {
        book("loans", "ledger.loanCalled", { amount: l.amount }, -cents(l.balance + interest));
        events.push({ app: "Bank", key: "event.loanCalled", params: { amount: l.amount } });
        return [];
      }
      events.push({ app: "Bank", key: "event.loanMissed", params: { amount: l.amount, fee: MISSED_FEE } });
      const balance = cents(l.balance + interest), rate = l.rate + MISSED_RATE;
      return [{ ...l, balance, rate, payment: annuity(balance, rate, l.left), missed: l.missed + 1 }];
    });
  }

  if (booked.length) s.ledger = [...s.ledger, ...booked];
  return events;
}
