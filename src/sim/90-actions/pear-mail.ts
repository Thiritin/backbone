// Pear Mail actions (docs/design/plans/mail-client.md).
import { checkAccount, clientError } from "../43-pear-mail/check";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Get Mail: checks every enabled account now, or the one given.
export function getMail(s: GameState, clientId?: string): ActionResult {
  const due = s.pearMail.accounts.filter((c) => (clientId ? c.id === clientId : c.enabled));
  if (clientId && !due.length) return fail("error.mailUnknown");
  for (const c of due) checkAccount(s, c.id);
  return { ok: true };
}

// The password prompt of an account the server refused: stores the new one and checks again.
export function setClientPassword(s: GameState, clientId: string, password: string): ActionResult {
  const c = s.pearMail.accounts.find((x) => x.id === clientId);
  if (!c) return fail("error.mailUnknown");
  const { authFailed: _a, ...rest } = c, next = { ...rest, password };
  s.pearMail = { ...s.pearMail, accounts: s.pearMail.accounts.map((x) => (x.id === clientId ? next : x)) };
  const error = clientError(s, next);
  checkAccount(s, clientId);
  return error ? fail(error) : { ok: true };
}

export function dismissPearWelcome(s: GameState): ActionResult {
  s.pearMail = { ...s.pearMail, welcomed: true };
  return { ok: true };
}
