// Player actions on the bank's website (46-finance/bank.ts).
import { nowMinutes, yearOf } from "../00-core/time";
import { hashRng, rand } from "../00-core/rng";
import { banksOpen, tanMethods, type BankId, type TanMethod } from "../10-catalog/banks";
import { APPROVAL_HOURS, bankOf, openWithSavings, hbci, payAll, ibanEra, limitFor, LOCK_HOURS, MIN_CARD_LIMIT, nextTanIndex, placeTanList, send, spendable, useTan, WRONG_LIMIT, type Draft, type Payee } from "../46-finance/bank";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { registerCompany, registrationError } from "./company";

const fail = (error: string): ActionResult => ({ ok: false, error });

function payeeError(s: GameState, d: Omit<Payee, "id">): string | null {
  if (!d.name.trim()) return "error.payeeName";
  if (ibanEra(s) ? !/^DE\d{20}$/.test(d.account.replace(/\s/g, "")) : !/^\d{1,10}$/.test(d.account) || !/^\d{8}$/.test(d.code ?? "")) return "error.payeeAccount";
  return null;
}

function draftError(s: GameState, d: Draft): string | null {
  const payee = payeeError(s, d);
  if (payee) return payee;
  if (!(d.amount > 0) || Math.abs(Math.round(d.amount * 100) - d.amount * 100) > 1e-6) return "error.badAmount";
  if (d.amount > spendable(s)) return "error.noCash";
  return null;
}

// Fills in the transfer form and asks for a TAN the way the account's method does.
export function startTransfer(s: GameState, draft: Draft): ActionResult {
  const b = s.bank;
  if (!b) return fail("error.noBank");
  if (s.hour < b.lockedUntil) return fail("error.bankLocked");
  const error = draftError(s, draft);
  if (error) return fail(error);
  const d = { ...draft, name: draft.name.trim(), account: draft.account.replace(/\s/g, ""), reference: draft.reference.trim() };
  const code = b.tan === "mtan" ? String(100000 + Math.floor(rand(hashRng(s.seed, s.hour, s.minute, s.nextId)) * 900000)) : null;
  s.bank = { ...b, pending: { draft: d, index: b.tan === "itan" ? nextTanIndex(s) : null, code, sendAt: code ? nowMinutes(s) + 1 : null } };
  return { ok: true };
}

// A standing order needs a TAN like a transfer and then runs on its day every month (days 1 to 28).
export function startStandingOrder(s: GameState, draft: Draft, day: number): ActionResult {
  if (!Number.isInteger(day) || day < 1 || day > 28) return fail("error.orderDay");
  const r = startTransfer(s, draft);
  if (r.ok) s.bank = { ...s.bank!, pending: { ...s.bank!.pending!, day } };
  return r;
}

export function deleteStandingOrder(s: GameState, id: string): ActionResult {
  if (!s.bank?.standingOrders.some((o) => o.id === id)) return fail("error.noOrder");
  s.bank = { ...s.bank, standingOrders: s.bank.standingOrders.filter((o) => o.id !== id) };
  return { ok: true };
}

// Saves a payee for the transfer form; one with the same account is replaced.
export function savePayee(s: GameState, payee: Omit<Payee, "id">): ActionResult {
  if (!s.bank) return fail("error.noBank");
  const error = payeeError(s, payee);
  if (error) return fail(error);
  const account = payee.account.replace(/\s/g, ""), code = ibanEra(s) ? undefined : payee.code;
  const kept = (s.bank.payees ?? []).filter((p) => p.account !== account || p.code !== code);
  s.bank = { ...s.bank, payees: [...kept, { id: `payee${s.nextId++}`, name: payee.name.trim(), account, ...(code && { code }) }] };
  return { ok: true };
}

export function deletePayee(s: GameState, id: string): ActionResult {
  if (!s.bank?.payees?.some((p) => p.id === id)) return fail("error.noPayee");
  s.bank = { ...s.bank, payees: s.bank.payees.filter((p) => p.id !== id) };
  return { ok: true };
}

export function cancelTransfer(s: GameState): ActionResult {
  if (!s.bank?.pending) return fail("error.noTransfer");
  s.bank = { ...s.bank, pending: null };
  return { ok: true };
}

// Sends the pending transfer when the TAN is right; three wrong ones lock online banking for a day.
export function confirmTransfer(s: GameState, tan = ""): ActionResult {
  const b = s.bank, p = b?.pending;
  if (!b || !p) return fail("error.noTransfer");
  if (s.hour < b.lockedUntil) return fail("error.bankLocked");
  const reg = p.draft.registration, refused = reg && registrationError(s, reg.name, reg.owner, reg.form);
  if (refused) return fail(refused);
  const want = b.tan === "itan" ? b.tans.codes[p.index!] : b.tan === "mtan" ? p.code : null;
  if (want !== null && tan.trim() !== want) {
    const wrong = b.wrong + 1;
    s.bank = wrong >= WRONG_LIMIT ? { ...b, wrong: 0, lockedUntil: s.hour + LOCK_HOURS, pending: null } : { ...b, wrong };
    return fail(wrong >= WRONG_LIMIT ? "error.bankLocked" : "error.wrongTan");
  }
  if (p.draft.amount > spendable(s)) return fail("error.noCash");
  s.bank = { ...b, wrong: 0, pending: null };
  if (b.tan === "itan") useTan(s, p.index!);
  if (p.day !== undefined) {
    const id = `so${s.nextId++}`, d = p.draft;
    s.bank = { ...s.bank, standingOrders: [...s.bank.standingOrders, { id, name: d.name, account: d.account, amount: d.amount, reference: d.reference, day: p.day }] };
    return { ok: true, id };
  }
  if (reg) return registerCompany(s, reg.name, reg.owner, reg.form);
  return { ok: true, id: send(s, p.draft).id };
}

// Switches to another TAN method the bank offers this year; the TAN list stays on the desktop only for iTAN.
export function setTanMethod(s: GameState, method: TanMethod): ActionResult {
  const bank = bankOf(s);
  if (!bank || !s.bank) return fail("error.noBank");
  if (!tanMethods(bank, yearOf(s.hour)).some((x) => x.method === method)) return fail("error.tanMethod");
  s.bank = { ...s.bank, tan: method, pending: null };
  if (method === "itan") placeTanList(s);
  else s.docs = s.docs.filter((d) => d.id !== "tans");
  return { ok: true };
}

// The bank decides on a card after a few days, with a limit from the account's income.
export function applyCard(s: GameState): ActionResult {
  const bank = bankOf(s);
  if (!bank || !s.bank) return fail("error.noBank");
  if (s.bank.card) return fail("error.hasCard");
  const readyAt = s.hour + APPROVAL_HOURS;
  s.bank = { ...s.bank, card: { appliedAt: s.hour, readyAt, limit: limitFor(s, bank.card.factor, MIN_CARD_LIMIT), spent: [], feeAt: readyAt } };
  return { ok: true };
}

export function applyOverdraft(s: GameState): ActionResult {
  const bank = bankOf(s);
  if (!bank || !s.bank) return fail("error.noBank");
  if (bank.overdraft === null) return fail("error.noOverdraft");
  if (s.bank.overdraftAt !== null) return fail("error.applied");
  s.bank = { ...s.bank, overdraftAt: s.hour + APPROVAL_HOURS };
  return { ok: true };
}

// A direct debit mandate for one supplier, set up or cancelled on the supplier's portal; its next invoices debit themselves.
export function setMandate(s: GameState, name: string, on: boolean): ActionResult {
  if (!s.bank) return fail("error.noBank");
  if (!s.payables.some((p) => p.name === name)) return fail("error.unknownSupplier");
  const rest = s.bank.mandates.filter((x) => x !== name);
  s.bank = { ...s.bank, mandates: on ? [...rest, name] : rest };
  return { ok: true };
}

export function payAllDue(s: GameState): ActionResult {
  if (!s.bank) return fail("error.noBank");
  if (!hbci(s)) return fail("error.noHbci");
  payAll(s);
  return { ok: true };
}

export function setAutoPay(s: GameState, on: boolean): ActionResult {
  if (!s.bank) return fail("error.noBank");
  if (!hbci(s)) return fail("error.noHbci");
  s.bank = { ...s.bank, autoPay: on };
  return { ok: true };
}

// Opens the company's account on the bank's site; the player's savings arrive as its first booking.
export function openBankAccount(s: GameState, id: BankId): ActionResult {
  if (s.bank) return fail("error.hasBank");
  if (!banksOpen(yearOf(s.hour)).some((b) => b.id === id)) return fail("error.unknownBank");
  openWithSavings(s, id);
  return { ok: true };
}
