// Player actions on the bank's website (46-finance/bank.ts).
import { nowMinutes, yearOf } from "../00-core/time";
import { hashRng, rand } from "../00-core/rng";
import { tanMethods, type TanMethod } from "../10-catalog/banks";
import { bankOf, ibanEra, LOCK_HOURS, nextTanIndex, placeTanList, send, spendable, useTan, WRONG_LIMIT, type Draft } from "../46-finance/bank";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function draftError(s: GameState, d: Draft): string | null {
  if (!d.name.trim()) return "error.payeeName";
  if (ibanEra(s) ? !/^DE\d{20}$/.test(d.account.replace(/\s/g, "")) : !/^\d{1,10}$/.test(d.account) || !/^\d{8}$/.test(d.code ?? "")) return "error.payeeAccount";
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
  const want = b.tan === "itan" ? b.tans.codes[p.index!] : b.tan === "mtan" ? p.code : null;
  if (want !== null && tan.trim() !== want) {
    const wrong = b.wrong + 1;
    s.bank = wrong >= WRONG_LIMIT ? { ...b, wrong: 0, lockedUntil: s.hour + LOCK_HOURS, pending: null } : { ...b, wrong };
    return fail(wrong >= WRONG_LIMIT ? "error.bankLocked" : "error.wrongTan");
  }
  if (p.draft.amount > spendable(s)) return fail("error.noCash");
  s.bank = { ...b, wrong: 0, pending: null };
  if (b.tan === "itan") useTan(s, p.index!);
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
