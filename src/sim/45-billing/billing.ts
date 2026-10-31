import { chance, hashRng, rand, type Rng } from "../00-core/rng";
import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import type { Budget } from "../10-catalog/economy";
import { CYCLE_MONTHS } from "../10-catalog/cycles";
import { SLAS } from "../10-catalog/products";
import type { PaymentHabit, Profile, Service } from "../30-customers/customers";
import { bump, cancelCustomer, createTicket, profileStats } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { metrics } from "../metrics";
import { logActivity } from "../47-staff/activity";
import { mailDelay } from "../80-business/mail";
import { sweepGroups } from "../60-infra/status";

// A draft waits in Books until it is sent; it is not due and never pays.
export type InvoiceStatus = "draft" | "open" | "overdue" | "paid" | "writtenOff";
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
  // ponytail: suspension takes the services offline for support only; milestone 3 stops the workloads and their billed hours.
  suspended: boolean;
  // Hour the latest suspension started; auto-suspend acts on an invoice that was never suspended or whose extension ran out.
  suspendedAt: number | null;
  // Rolled once at issue: 0 pays on time, n pays after the nth dunning step, 4 never pays.
  payStep: number;
  // Hour the money arrives, set once the step that moves the customer is sent.
  payAt: number | null;
  paidAt: number | null;
  // Sent from Books: the customer pays by bank transfer, which the player matches.
  bank?: true;
  // What matched partial payments have covered so far.
  received?: number;
  // Hour the payment extension granted on a suspension appeal runs out.
  extendedUntil: number | null;
}
// A payment in the bank account. reference and params are the purpose line as an i18n key; invoiceId is the invoice the
// player matched it to. forInvoice is the invoice the customer meant, never shown.
export interface Transfer { id: string; hour: number; from: string; reference: string; params: Record<string, string>; amount: number; invoiceId: string | null; matchedAt: number | null; forInvoice: string }
// rate is yearly; left counts the instalments still to pay.
export interface Loan { id: string; amount: number; rate: number; months: number; left: number; payment: number; balance: number; takenAt: number; missed: number }

const DAY = 24;
export const YEAR_HOURS = 8760;
const MONTH_HOURS = YEAR_HOURS / 12;
// A renewal goes out at the month start before the term ends, whichever length that month has.
const LONGEST_MONTH = 744;
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

// economy.md, Suspension.
export interface BillingRules { autoRemind: boolean; autoSuspendDays: 0 | 7 | 14 | 30; autoCollectDays: 0 | 42 | 60 | 90 }
export const AUTO_SUSPEND_DAYS = [0, 7, 14, 30] as const;
export const AUTO_COLLECT_DAYS = [0, 42, 60, 90] as const;
// High-budget customers run their business on the services, so suspension hits harder and they pay faster.
export const SUSPEND_HAPPINESS: Record<Budget, number> = { low: 15, medium: 15, high: 30 };
export const SUSPENDED_PAY_ODDS: Record<PaymentHabit, number> = { prompt: 0.35, late: 0.35, bad: 0.2, friend: 1 };
export const SUSPENDED_PAY_ODDS_HIGH = 0.6;
export const APPEAL_CHANCE = 0.6;
export const EXTENSION_DAYS = 7;
export const EXTENSION_PAY_CHANCE = 0.85;
export const UNSUSPEND_HAPPINESS = 15;
// economy.md, Happiness and churn: a month in which every service kept its SLA uptime.
export const SLA_KEPT_HAPPINESS = 2;
export const KEEP_SUSPENDED_HAPPINESS = -15;
export const SUSPEND_CHURN_DAYS = 14;
export const SUSPEND_CHURN_CHANCE = 0.5;

// Odds of paying on time, after the reminder, the dunning notice, the final notice, or never.
// The doc's budget rows map onto habits: prompt is medium, late is high, bad is low.
export const PAY_ODDS: Record<PaymentHabit, number[]> = {
  prompt: [0.9, 0.06, 0.02, 0.01, 0.01],
  late: [0.65, 0.3, 0.04, 0.01, 0],
  bad: [0.82, 0.1, 0.04, 0.02, 0.02],
  friend: [1, 0, 0, 0, 0],
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

// Sends a draft the caller owns: it is issued now, due in DUE_DAYS, and the customer's habit decides when the money comes.
export function issue(s: GameState, inv: Invoice, payDays = DUE_DAYS - 1): void {
  const payStep = rollPayStep(s.rng, s.customers.find((c) => c.id === inv.customerId)?.habit ?? "prompt");
  Object.assign(inv, {
    status: "open", issuedAt: s.hour, dueAt: s.hour + DUE_DAYS * DAY, payStep, bank: true,
    payAt: payStep === 0 ? s.hour + DAY + Math.floor(rand(s.rng) * payDays * DAY) + mailDelay(s) : null,
  });
}

// How customers fill in a transfer: the share who write a bare word or their name instead of the invoice number, by profile,
// and the share of low-budget payers who send a few cents short or a rounded-down amount.
export const BARE_REFERENCE: Record<Profile, number> = { private: 0.3, gamer: 0.35, hobbyDev: 0.2, soleProp: 0.1, smallBiz: 0.05, agency: 0.03, office: 0.05, onlineShop: 0.03, enterprise: 0.01 };
export const SHORT_PAY = 0.15;
const BARE_WORDS = ["hosting", "server", "domain"];
// A reminder on an invoice whose payment sits unmatched in the bank.
export const ALREADY_PAID_HAPPINESS = 5;

// A moved customer pays 1 to 5 days after the step.
export const payDelay = (r: Rng): number => DAY * (1 + Math.floor(rand(r) * 5));

export const invoiceTotal = (inv: Invoice): number => cents(inv.lines.reduce((sum, l) => sum + l.amount, 0));
export const isUnpaid = (inv: Invoice): boolean => inv.status === "open" || inv.status === "overdue";
export const owed = (inv: Invoice): number => cents(invoiceTotal(inv) - (inv.received ?? 0));
export const pendingTransfer = (s: GameState, inv: Invoice): Transfer | undefined => s.transfers.find((t) => t.forInvoice === inv.id && t.invoiceId === null);
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];

// The customer's transfer for what is left of an invoice; only the first may carry an odd reference or amount.
function transferFor(s: GameState, inv: Invoice): Transfer {
  const c = s.customers.find((x) => x.id === inv.customerId), a = c?.address;
  const r = hashRng(s.seed, Number(inv.id.slice(3)) || 0, s.hour, 251), first = !inv.received;
  const from = a?.company ?? (a ? `${a.contact[0]}. ${a.contact.split(" ").slice(1).join(" ")}` : c?.name ?? "");
  let amount = owed(inv);
  if (first && c && profileStats(c.profile).budget === "low" && chance(r, SHORT_PAY)) {
    amount = amount % 1 === 0 || chance(r, 0.5) ? cents(amount - (1 + Math.floor(rand(r) * 9)) / 100) : Math.floor(amount);
  }
  const bare = first && !!c && chance(r, BARE_REFERENCE[c.profile]);
  const [reference, params]: [string, Record<string, string>] = !bare ? ["books.ref.invoice", { number: inv.number }]
    : chance(r, 0.5) ? [`books.ref.${pick(r, BARE_WORDS)}`, {}] : ["books.ref.name", { name: a?.contact ?? c!.name }];
  return { id: `trf${s.nextId++}`, hour: s.hour, from, reference, params, amount, invoiceId: null, matchedAt: null, forInvoice: inv.id };
}

// Index into STEPS of the dunning step that is due now, or null.
export function dueStep(inv: Invoice, hour: number): number | null {
  const i = inv.reminders.length;
  if (!isUnpaid(inv) || i >= STEPS.length) return null;
  return hour >= inv.dueAt + STEPS[i].days * DAY ? i : null;
}

export const isSuspended = (s: GameState, customerId: string): boolean => {
  if (s.heldCustomers.includes(customerId)) return true;
  const suspended = sweepGroups(s, "suspended", () => s.invoices.filter((i) => i.suspended && isUnpaid(i)), (i) => i.customerId);
  return suspended ? suspended.has(customerId) : s.invoices.some((i) => i.customerId === customerId && i.suspended && isUnpaid(i));
};

export type HoldReason = "payment" | "abuse" | "manual";

// A service is held when it was suspended on its own or its customer is suspended.
export const serviceHeld = (s: GameState, v: Service): boolean => !!s.heldServices[v.id] || isSuspended(s, v.customerId);

export function holdReason(s: GameState, v: Service): HoldReason | null {
  if (s.heldServices[v.id]) return s.heldServices[v.id];
  if (s.invoices.some((i) => i.customerId === v.customerId && i.suspended && isUnpaid(i))) return "payment";
  return s.heldCustomers.includes(v.customerId) ? "manual" : null;
}

const customerName = (s: GameState, id: string) => s.customers.find((c) => c.id === id)?.name ?? id;

// Overdue invoices of customers who are still served: who they are and what they owe.
export function freeRiding(s: GameState): { customers: string[]; owed: number } {
  const held = new Set(s.invoices.filter((i) => i.suspended && isUnpaid(i)).map((i) => i.customerId));
  const active = new Set(s.customers.filter((c) => c.churnedAt === null && !held.has(c.id)).map((c) => c.id));
  const owed = new Map<string, number>();
  for (const i of s.invoices) if (i.status === "overdue" && active.has(i.customerId)) owed.set(i.customerId, (owed.get(i.customerId) ?? 0) + invoiceTotal(i));
  return { customers: [...owed.keys()], owed: cents([...owed.values()].reduce((a, b) => a + b, 0)) };
}

// Callers pass records they own (a copied invoice in the tick, a cloned state in actions); the customer and
// tickets are copied here so the tick never edits the previous state.
function ownCustomer(s: GameState, id: string) {
  s.customers = s.customers.map((c) => (c.id === id ? { ...c } : c));
  return s.customers.find((c) => c.id === id);
}

// The first suspension of a customer costs happiness and brings a ticket; further invoices only add to it.
// A high-budget customer may appeal instead, once per invoice. Returns whether the services were running until now.
export function suspend(s: GameState, inv: Invoice): boolean {
  const first = !isSuspended(s, inv.customerId);
  const appealed = inv.extendedUntil !== null;
  Object.assign(inv, { suspended: true, suspendedAt: s.hour });
  const c = ownCustomer(s, inv.customerId);
  if (!first || !c) return false;
  const { budget } = profileStats(c.profile);
  bump(c, -SUSPEND_HAPPINESS[budget]);
  if (budget === "high" && !appealed && chance(s.rng, APPEAL_CHANCE)) createTicket(s, c, "appeal");
  else createTicket(s, c, "billing").topic = "suspended";
  return true;
}

// A granted appeal: the customer's suspended invoices go back online with a payment extension.
export function grantExtension(s: GameState, customerId: string): void {
  s.invoices = s.invoices.map((inv) => {
    if (inv.customerId !== customerId || !inv.suspended || !isUnpaid(inv)) return inv;
    const payAt = inv.payAt ?? (!pendingTransfer(s, inv) && chance(s.rng, EXTENSION_PAY_CHANCE) ? s.hour + payDelay(s.rng) : null);
    return { ...inv, suspended: false, extendedUntil: s.hour + EXTENSION_DAYS * DAY, payAt };
  });
}

// The debt goes to a collection agency and the customer leaves.
function toCollections(s: GameState, inv: Invoice): void {
  Object.assign(inv, { status: "writtenOff", suspended: false, payAt: s.hour + COLLECTIONS_DAYS * DAY });
  const c = ownCustomer(s, inv.customerId);
  s.tickets = s.tickets.map((t) => ({ ...t }));
  if (c) cancelCustomer(s, c);
}

// Sends dunning step i of an invoice the caller owns.
export function sendStep(s: GameState, inv: Invoice, i: number): void {
  const step = STEPS[i];
  inv.reminders = [...inv.reminders, s.hour];
  if (step.fee) inv.lines = [...inv.lines, { serviceId: null, key: `invoice.line.${step.key}Fee`, params: {}, amount: step.fee }];
  const paid = step.key !== "collections" && pendingTransfer(s, inv);
  if (paid) {
    const c = ownCustomer(s, inv.customerId);
    if (c) {
      bump(c, -ALREADY_PAID_HAPPINESS);
      createTicket(s, c, "billing", null, "alreadyPaid");
    }
  }
  if (step.key === "collections") toCollections(s, inv);
  else if (inv.payStep === i + 1 || (!paid && inv.received && inv.payAt === null)) inv.payAt = s.hour + payDelay(s.rng) + mailDelay(s);
}

// Before the Automation research, staff carry out the billing rules in their work hours; after it the rules run by themselves.
export const rulesAutomated = (s: GameState): boolean => s.unlocks.includes("automation");

// The dunning step the rules send now: notices with auto reminders, collections once its days have passed.
export function ruleStep(s: GameState, inv: Invoice): number | null {
  const i = dueStep(inv, s.hour);
  if (i === null) return null;
  if (STEPS[i].key !== "collections") return s.billingRules.autoRemind ? i : null;
  const days = s.billingRules.autoCollectDays;
  return days && s.hour >= inv.dueAt + days * DAY ? i : null;
}

// Hour the suspend rule acts on an invoice: days after the due date, or again when an appeal's extension runs out.
export function ruleSuspendsAt(s: GameState, inv: Invoice): number | null {
  const days = s.billingRules.autoSuspendDays;
  if (!days || inv.status !== "overdue" || inv.suspended) return null;
  if (inv.suspendedAt === null) return inv.dueAt + days * DAY;
  return inv.extendedUntil !== null && inv.suspendedAt < inv.extendedUntil ? inv.extendedUntil : null;
}

const automated = (s: GameState, inv: Invoice, key: string) =>
  logActivity(s, { customerId: inv.customerId, serviceId: null, by: "Automation", key: `activity.${key}`, params: { invoice: inv.number }, minutes: 0 });

// Automated billing rules and suspended customers, once per hour for each unpaid invoice the caller owns.
function chase(s: GameState, inv: Invoice, events: SimEvent[]): void {
  const c = s.customers.find((x) => x.id === inv.customerId);
  const auto = rulesAutomated(s);
  const i = auto ? ruleStep(s, inv) : null;
  if (i !== null) {
    sendStep(s, inv, i);
    automated(s, inv, STEPS[i].key);
  }
  if (inv.status === "writtenOff") {
    if (c) events.push({ app: "Books", key: "event.collected", params: { customer: c.name, invoice: inv.number } });
    return;
  }
  const at = auto ? ruleSuspendsAt(s, inv) : null;
  if (at !== null && c?.churnedAt === null && s.hour >= at) {
    if (suspend(s, inv)) events.push({ app: "Books", key: "event.suspended", params: { customer: c.name, invoice: inv.number } });
    automated(s, inv, "suspend");
  }
  if (!inv.suspended || inv.suspendedAt === null || inv.payAt !== null || !c || pendingTransfer(s, inv)) return;
  const since = s.hour - inv.suspendedAt;
  if (since <= 0 || since % DAY) return;
  const high = profileStats(c.profile).budget === "high";
  if (c.habit === "bad" && since === SUSPEND_CHURN_DAYS * DAY && chance(s.rng, SUSPEND_CHURN_CHANCE)) {
    toCollections(s, inv);
    events.push({ app: "Books", key: "event.suspendedLeft", params: { customer: c.name, invoice: inv.number } });
  } else if (chance(s.rng, high ? SUSPENDED_PAY_ODDS_HIGH : SUSPENDED_PAY_ODDS[c.habit])) inv.payAt = s.hour + 1;
}

const needsChase = (s: GameState, inv: Invoice): boolean =>
  isUnpaid(inv) && (inv.suspended || (rulesAutomated(s) && (ruleStep(s, inv) !== null || ruleSuspendsAt(s, inv) !== null)));

// Bank: economy.md, Bank, insurance and tax.
const BASE_RATE: [number, number][] = [[2005, 4], [2009, 2.5], [2015, 1], [2021, 1], [2023, 4.5], [2026, 4]];
export const RISK_PREMIUM = [6, 4, 3, 2, 1, 0.5];
export const MIN_LIMIT = [10_000, 25_000, 100_000, 500_000, 3_000_000, 20_000_000];
export const LOAN_AMOUNTS = [2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000, 10_000_000, 20_000_000];
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

// A paid renewal line extends the service's term by the months it bought.
export function renewTerms(s: GameState, inv: Invoice): void {
  const bought = new Map(inv.lines.filter((l) => l.key === "invoice.line.renewal" && l.serviceId).map((l) => [l.serviceId!, Number(l.params.months)]));
  if (!bought.size) return;
  s.services = s.services.map((v) => {
    const months = bought.get(v.id);
    return months && v.termEnd !== undefined ? { ...v, termEnd: v.termEnd + MONTH_HOURS * months, prepaidUntil: v.termEnd + MONTH_HOURS * months } : v;
  });
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
  const arrived: Transfer[] = [];
  const invoices = s.invoices.map((inv) => {
    if (inv.payAt !== null && s.hour >= inv.payAt) {
      changed = true;
      // The money reaches the account; the invoice stays open until the player matches it.
      if (inv.bank && inv.status !== "writtenOff") {
        const tr = transferFor(s, inv);
        arrived.push(tr);
        book("payments", "ledger.transfer", { from: tr.from }, tr.amount);
        return { ...inv, payAt: null };
      }
      const collected = inv.status === "writtenOff";
      const params = { invoice: inv.number, customer: customerName(s, inv.customerId) };
      const share = collected ? COLLECTIONS_SHARE : 1;
      const setup = cents(inv.lines.filter((l) => l.key === "invoice.line.setupFee").reduce((sum, l) => sum + l.amount, 0) * share);
      const total = cents(invoiceTotal(inv) * share);
      if (setup !== 0) book("setup", "ledger.setup", params, setup);
      book("payments", collected ? "ledger.collections" : "ledger.payment", params, cents(total - setup));
      if (!collected) renewTerms(s, inv);
      return { ...inv, payAt: null, status: collected ? inv.status : "paid", suspended: false, paidAt: s.hour } satisfies Invoice;
    }
    const due = inv.status === "open" && s.hour >= inv.dueAt;
    if (!due && !needsChase(s, inv)) return inv;
    changed = true;
    const copy: Invoice = { ...inv, status: due ? "overdue" : inv.status };
    chase(s, copy, events);
    return copy;
  });

  const lines = new Map<string, InvoiceLine[]>();
  const free = new Set(s.customers.filter((c) => c.sponsor).map((c) => c.id));
  const add = (customerId: string, line: InvoiceLine) => !free.has(customerId) && lines.set(customerId, [...(lines.get(customerId) ?? []), line]);
  const monthStart = isMonthStart(s.hour);
  if (monthStart) {
    const d = dateOf(s.hour);
    const from = hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
    for (const v of s.services) {
      // A prepaid cycle bills through its renewal invoices instead.
      if (v.period !== "hour" || v.cycle) continue;
      const hours = Math.min(v.endedAt ?? s.hour, s.hour) - Math.max(v.startedAt, from, v.prepaidUntil ?? 0);
      if (hours <= 0) continue;
      // Hours down are not billed; a missed SLA credits its share of what is billed.
      const billed = hours - Math.min(hours, s.downHours[v.id] ?? 0), sla = SLAS[v.sla], rate = Math.min(v.price, v.held ?? v.price);
      if (billed > 0) add(v.customerId, { serviceId: v.id, key: "invoice.line.hours", params: { label: v.label, hours: billed }, amount: cents(billed * rate) });
      if (billed > 0 && sla.credit && billed / hours < sla.uptime) {
        add(v.customerId, { serviceId: v.id, key: "invoice.line.slaCredit", params: { label: v.label }, amount: -cents(sla.credit * billed * rate) });
      }
    }
    // Renewal of every term that ends before the next month start, unless one is already waiting to be paid.
    const renewing = new Set(s.invoices.filter((i) => i.status !== "paid" && i.status !== "writtenOff").flatMap((i) => i.lines.filter((l) => l.key === "invoice.line.renewal").map((l) => l.serviceId)));
    for (const v of s.services) {
      if (v.endedAt !== null || !v.cycle || v.termEnd === undefined || v.termEnd > s.hour + LONGEST_MONTH || renewing.has(v.id)) continue;
      const months = CYCLE_MONTHS[v.cycle];
      add(v.customerId, { serviceId: v.id, key: "invoice.line.renewal", params: { label: v.label, months }, amount: cents(v.price * MONTH_HOURS * months) });
    }
    if (s.services.some((v) => v.held !== undefined)) s.services = s.services.map(({ held: _, ...v }) => v);
    const missed = new Set<string>(), kept = new Set<string>();
    for (const v of s.services) {
      const hours = Math.min(v.endedAt ?? s.hour, s.hour) - Math.max(v.startedAt, from);
      if (hours <= 0) continue;
      (1 - Math.min(hours, s.downHours[v.id] ?? 0) / hours < SLAS[v.sla].uptime ? missed : kept).add(v.customerId);
    }
    for (const id of kept) {
      if (missed.has(id) || isSuspended(s, id)) continue;
      const c = ownCustomer(s, id);
      if (c && c.churnedAt === null) bump(c, SLA_KEPT_HAPPINESS);
    }
    s.downHours = {};
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
    // A credit note takes off what is billed, never more.
    const owner = s.customers.find((c) => c.id === customerId);
    const take = owner ? Math.min(owner.credit, cents(ls.reduce((sum, l) => sum + l.amount, 0))) : 0;
    if (owner && take > 0) {
      ls.push({ serviceId: null, key: "invoice.line.credit", params: {}, amount: -take });
      s.customers = s.customers.map((c) => (c === owner ? { ...c, credit: cents(c.credit - take) } : c));
    }
    issued.push({
      id: `inv${s.nextId++}`, number: `${yearOf(s.hour)}-${String(invoices.length + issued.length + 1).padStart(4, "0")}`,
      customerId, lines: ls, issuedAt: s.hour, dueAt: s.hour, status: "draft", reminders: [], suspended: false, suspendedAt: null, extendedUntil: null,
      payStep: 0, payAt: null, paidAt: null,
    });
  }
  if (changed || issued.length) s.invoices = [...invoices, ...issued];
  if (arrived.length) s.transfers = [...s.transfers, ...arrived];
  if (monthStart && issued.length) {
    events.push({ app: "Books", key: "event.invoices", params: { count: issued.length, total: cents(issued.reduce((sum, i) => sum + invoiceTotal(i), 0)) } });
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
        events.push({ app: "Finance", key: "event.loanCalled", params: { amount: l.amount } });
        return [];
      }
      events.push({ app: "Finance", key: "event.loanMissed", params: { amount: l.amount, fee: MISSED_FEE } });
      const balance = cents(l.balance + interest), rate = l.rate + MISSED_RATE;
      return [{ ...l, balance, rate, payment: annuity(balance, rate, l.left), missed: l.missed + 1 }];
    });
  }

  if (booked.length) s.ledger = [...s.ledger, ...booked];
  return events;
}
