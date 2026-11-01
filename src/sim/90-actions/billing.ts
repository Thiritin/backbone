import { sendOrderInvoice } from "../30-market/manual";
import {
  annuity, AUTO_COLLECT_DAYS, bookTransfer, issue, AUTO_SUSPEND_DAYS, cents, dueStep, isUnpaid, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate, sendStep, STEPS, suspend, type BillingRules, type Invoice,
} from "../45-billing/billing";
import { bankById } from "../10-catalog/banks";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { ACTION_MINUTES, logActivity } from "../47-staff/activity";

const fail = (error: string): ActionResult => ({ ok: false, error });
const unpaidInvoice = (s: GameState, id: string) => s.invoices.find((i) => i.id === id && isUnpaid(i));
const log = (s: GameState, inv: Invoice, key: keyof typeof ACTION_MINUTES | "writeOff") =>
  logActivity(s, { customerId: inv.customerId, serviceId: null, by: null, key: `activity.${key}`, params: { invoice: inv.number }, minutes: key === "writeOff" ? 0 : ACTION_MINUTES[key] });

// Emails a draft invoice as PDF.
export function sendInvoice(s: GameState, invoiceId: string): ActionResult {
  const inv = s.invoices.find((x) => x.id === invoiceId && x.status === "draft");
  if (!inv) return fail("error.invoiceSent");
  // An order's first invoice is its confirmation.
  if (!sendOrderInvoice(s, inv)) issue(s, inv);
  log(s, inv, "sendInvoice");
  return { ok: true };
}

// Books a bank transfer against an invoice; settle writes off what a smaller amount leaves open.
export function matchTransfer(s: GameState, transferId: string, invoiceId: string, settle = false): ActionResult {
  const tr = s.transfers.find((x) => x.id === transferId && x.matchedAt === null);
  if (!tr) return fail("error.transferMatched");
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  bookTransfer(s, tr, inv, settle);
  log(s, inv, "matchTransfer");
  return { ok: true };
}

// Sends whichever dunning step is due; the last one hands the debt to collections and the customer leaves.
export function sendReminder(s: GameState, invoiceId: string): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  const i = dueStep(inv, s.hour);
  if (i === null) return fail("error.stepNotDue");
  sendStep(s, inv, i);
  log(s, inv, STEPS[i].key);
  return { ok: true };
}

export function suspendServices(s: GameState, invoiceId: string, suspended = true): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  if (inv.status !== "overdue") return fail("error.notOverdue");
  if (suspended === inv.suspended) return { ok: true };
  if (suspended) suspend(s, inv);
  else inv.suspended = false;
  log(s, inv, suspended ? "suspend" : "unsuspend");
  return { ok: true };
}

export function setBillingRules(s: GameState, rules: Partial<BillingRules>): ActionResult {
  if (rules.autoSuspendDays !== undefined && !AUTO_SUSPEND_DAYS.includes(rules.autoSuspendDays)) return fail("error.billingRule");
  if (rules.autoCollectDays !== undefined && !AUTO_COLLECT_DAYS.includes(rules.autoCollectDays)) return fail("error.billingRule");
  s.billingRules = { ...s.billingRules, ...rules };
  return { ok: true };
}

export function writeOff(s: GameState, invoiceId: string): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  Object.assign(inv, { status: "writtenOff", suspended: false, payAt: null });
  log(s, inv, "writeOff");
  return { ok: true };
}

export function takeLoan(s: GameState, amount: number, years: number): ActionResult {
  if (s.hour < s.loansBlockedUntil) return fail("error.loanBlocked");
  if (!LOAN_YEARS.includes(years)) return fail("error.loanTerm");
  const available = loanAvailable(s);
  // A preset amount, or the whole remaining limit in euros.
  if (!(LOAN_AMOUNTS.includes(amount) || (amount > 0 && amount === Math.floor(available))) || amount > available) return fail("error.loanLimit");
  if (amount < (s.bank ? bankById(s.bank.id)?.loans.min ?? 0 : 0)) return fail("error.loanMin");
  const rate = loanRate(s), months = years * 12;
  const id = `loan${s.nextId++}`;
  s.loans.push({ id, amount, rate, months, left: months, payment: annuity(amount, rate, months), balance: amount, takenAt: s.hour, missed: 0 });
  s.cash = cents(s.cash + amount);
  s.ledger.push({ hour: s.hour, category: "loans", key: "ledger.loanTaken", params: { amount }, amount });
  return { ok: true, id };
}

// Pays off the whole remaining balance.
export function repayLoan(s: GameState, loanId: string): ActionResult {
  const loan = s.loans.find((l) => l.id === loanId);
  if (!loan) return fail("error.unknownLoan");
  if (s.cash < loan.balance) return fail("error.noCash");
  s.cash = cents(s.cash - loan.balance);
  s.ledger.push({ hour: s.hour, category: "loans", key: "ledger.loanPayoff", params: { amount: loan.amount }, amount: -loan.balance });
  s.loans = s.loans.filter((l) => l !== loan);
  return { ok: true };
}
