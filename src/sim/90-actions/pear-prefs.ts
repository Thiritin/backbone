// Pear Mail Preferences, signatures and the What's new sheet (docs/design/plans/mail-client.md, Preferences and the account lifecycle).
import { mailBuild } from "../10-catalog/pear-mail";
import { FONT_SIZES, type PearMailPrefs, type Signature } from "../43-pear-mail/state";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const SIGNATURE_MAX = 2000;
const fail = (error: string): ActionResult => ({ ok: false, error });

export function setPearPref(s: GameState, p: Partial<PearMailPrefs>): ActionResult {
  if ([p.listSize, p.msgSize].some((x) => x !== undefined && !FONT_SIZES.includes(x))) return fail("error.mailUnknown");
  if (p.defaultFrom && !s.pearMail.accounts.some((c) => c.id === p.defaultFrom)) return fail("error.mailUnknown");
  s.pearMail = { ...s.pearMail, prefs: { ...s.pearMail.prefs, ...p } };
  return { ok: true };
}

// Adds a signature, or replaces the one with the given id; returns its id.
export function saveSignature(s: GameState, sig: Omit<Signature, "id"> & { id?: string }): ActionResult {
  const id = sig.id ?? `sg${s.nextId++}`, next = { id, name: sig.name.slice(0, 100), text: sig.text.slice(0, SIGNATURE_MAX) };
  const list = s.pearMail.signatures;
  if (sig.id && !list.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.pearMail = { ...s.pearMail, signatures: sig.id ? list.map((x) => (x.id === id ? next : x)) : [...list, next] };
  return { ok: true, id };
}

// Accounts that used it as their default fall back to none.
export function removeSignature(s: GameState, id: string): ActionResult {
  if (!s.pearMail.signatures.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.pearMail = {
    ...s.pearMail, signatures: s.pearMail.signatures.filter((x) => x.id !== id),
    accounts: s.pearMail.accounts.map((c) => (c.signature === id ? { ...c, signature: null } : c)),
  };
  return { ok: true };
}

// Continue on the What's new sheet.
export function seePearBuild(s: GameState): ActionResult {
  s.pearMail = { ...s.pearMail, seenBuild: mailBuild(s.os, s.hour).version };
  return { ok: true };
}
