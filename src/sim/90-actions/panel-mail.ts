// Webmail of the panel mailboxes: sending and reading with the mailbox password.
import { deliver } from "../42-mail/deliver";
import type { GameState } from "../50-state";
import { panelDeliver, panelLogin, panelMessages, panelStore } from "../60-infra/panel-mail";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const ADDRESS = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function sendPanelMail(s: GameState, address: string, password: string, to: string, subject: string, body: string): ActionResult {
  if (!panelLogin(s, address, password)) return fail("panelmail.error.login");
  const dest = to.trim().toLowerCase();
  if (!ADDRESS.test(dest)) return fail("panelmail.error.address");
  panelStore(s, address, { from: address, to: dest, subject, body }, "sent");
  if (!panelDeliver(s, { from: address, to: dest, subject, body })) deliver(s, { to: dest, from: address, kind: "staff", own: { subject, text: body } });
  return { ok: true, id: dest };
}

export function readPanelMail(s: GameState, address: string, password: string, id: string): ActionResult {
  if (!panelLogin(s, address, password)) return fail("panelmail.error.login");
  const a = address.trim().toLowerCase();
  s.panelMail = { ...s.panelMail, [a]: panelMessages(s, a).map((m) => (m.id === id ? { ...m, read: true } : m)) };
  return { ok: true, id };
}
