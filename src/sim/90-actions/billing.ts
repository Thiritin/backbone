import {
  annuity, AUTO_SUSPEND_DAYS, cents, dueStep, isUnpaid, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate, sendStep, suspend, type BillingRules,
} from "../45-billing/billing";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const unpaidInvoice = (s: GameState, id: string) => s.invoices.find((i) => i.id === id && isUnpaid(i));

// Sends whichever dunning step is due; the last one hands the debt to collections and the customer leaves.
export function sendReminder(s: GameState, invoiceId: string): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  const i = dueStep(inv, s.hour);
  if (i === null) return fail("error.stepNotDue");
  sendStep(s, inv, i);
  return { ok: true };
}

export function suspendServices(s: GameState, invoiceId: string, suspended = true): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  if (inv.status !== "overdue") return fail("error.notOverdue");
  if (suspended && !inv.suspended) suspend(s, inv);
  else inv.suspended = suspended;
  return { ok: true };
}

export function setBillingRules(s: GameState, rules: Partial<BillingRules>): ActionResult {
  if (rules.autoSuspendDays !== undefined && !AUTO_SUSPEND_DAYS.includes(rules.autoSuspendDays)) return fail("error.billingRule");
  s.billingRules = { ...s.billingRules, ...rules };
  return { ok: true };
}

export function writeOff(s: GameState, invoiceId: string): ActionResult {
  const inv = unpaidInvoice(s, invoiceId);
  if (!inv) return fail("error.invoiceSettled");
  Object.assign(inv, { status: "writtenOff", suspended: false, payAt: null });
  return { ok: true };
}

export function takeLoan(s: GameState, amount: number, years: number): ActionResult {
  if (s.hour < s.loansBlockedUntil) return fail("error.loanBlocked");
  if (!LOAN_YEARS.includes(years)) return fail("error.loanTerm");
  if (!LOAN_AMOUNTS.includes(amount) || amount > loanAvailable(s)) return fail("error.loanLimit");
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
