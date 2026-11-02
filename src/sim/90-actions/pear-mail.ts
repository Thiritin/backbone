// Pear Mail actions (docs/design/plans/mail-client.md).
import { checkAccount, clientError } from "../43-pear-mail/check";
import type { Message } from "../42-mail/types";
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

// Marks POP downloads and On My Pear mail; a ticket's read state follows, as on the server.
export function markPearMessages(s: GameState, ids: string[], f: { read?: boolean; star?: boolean }): ActionResult {
  const want = new Set(ids), local = s.pearMail.local.messages;
  if (!local.some((m) => want.has(m.id))) return fail("error.mailUnknown");
  const set = (m: Message, k: "read" | "star", v: boolean | undefined): Message => {
    if (v === undefined) return m;
    const { [k]: _old, ...rest } = m;
    return v ? { ...rest, [k]: true } : rest;
  };
  s.pearMail = { ...s.pearMail, local: { ...s.pearMail.local, messages: local.map((m) => (want.has(m.id) ? set(set(m, "read", f.read), "star", f.star) : m)) } };
  const tickets = new Set(local.filter((m) => want.has(m.id) && m.ticket).map((m) => m.ticket!));
  if (f.read !== undefined && tickets.size) s.tickets = s.tickets.map((t) => (tickets.has(t.id) ? { ...t, unread: !f.read } : t));
  return { ok: true };
}
