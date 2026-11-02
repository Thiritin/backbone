// Pear Mail actions (docs/design/plans/mail-client.md).
import { checkAccount, clientError } from "../43-pear-mail/check";
import { nowMinutes } from "../00-core/time";
import { drop } from "../42-mail/deliver";
import { SYS_FOLDERS } from "../42-mail/model";
import type { Message } from "../42-mail/types";
import { localFolder } from "../43-pear-mail/state";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { discardDraft, saveDraft, sendMessage, type Draft } from "./mailmsg";

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

const local = (s: GameState) => s.pearMail.local.messages;
const setLocal = (s: GameState, messages: Message[]): void => { s.pearMail = { ...s.pearMail, local: { ...s.pearMail.local, messages } }; };
// "pear:<client id>:<folder>" of a downloaded message.
const partsOf = (m: Message): [string, string] => { const [, c, f] = m.folder.split(":"); return [c, f]; };
const client = (s: GameState, id: string) => s.pearMail.accounts.find((c) => c.id === id);

// Moves downloaded mail between the system folders of its POP account.
export function movePearMessages(s: GameState, ids: string[], folder: string): ActionResult {
  if (!(SYS_FOLDERS as string[]).includes(folder)) return fail("error.mailNoFolder");
  const want = new Set(ids);
  if (!local(s).some((m) => want.has(m.id))) return fail("error.mailUnknown");
  setLocal(s, local(s).map((m) => {
    if (!want.has(m.id)) return m;
    const [c, f] = partsOf(m);
    return { ...m, folder: localFolder(c, folder), ...(folder === "trash" && f !== "trash" && { prev: f }) };
  }));
  return { ok: true };
}

// Outside Trash a delete moves to Trash; in Trash it removes for good.
export function deletePearMessages(s: GameState, ids: string[]): ActionResult {
  const want = new Set(ids), gone = new Set(local(s).filter((m) => want.has(m.id) && partsOf(m)[1] === "trash").map((m) => m.id));
  if (!local(s).some((m) => want.has(m.id))) return fail("error.mailUnknown");
  setLocal(s, local(s).filter((m) => !gone.has(m.id)));
  return movePearMessages(s, ids.filter((id) => !gone.has(id)), "trash");
}

// A draft of a client account: on the server for IMAP, in the local Drafts for POP.
export function savePearDraft(s: GameState, clientId: string, d: Draft & { id?: string }): ActionResult {
  const c = client(s, clientId);
  if (!c) return fail("error.mailUnknown");
  if (c.protocol === "imap") return saveDraft(s, c.accountId, d);
  const id = d.id && local(s).some((m) => m.id === d.id && m.draft) ? d.id : `msg${s.nextId++}`;
  const list = (xs: string[] | undefined) => (xs ?? []).flatMap((x) => x.split(",")).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const cc = list(d.cc), bcc = list(d.bcc);
  const m: Message = {
    id, thread: id, folder: localFolder(c.id, "drafts"), from: `acct:${c.accountId}`, to: list(d.to).join(", "), ...(cc.length && { cc }), ...(bcc.length && { bcc }),
    kind: "reply", topic: "", own: { subject: d.subject.trim().slice(0, 200), text: d.text.slice(0, 2000) }, ...(d.att?.length && { att: d.att }), ...(d.re && { re: d.re }),
    draft: true, read: true, at: nowMinutes(s), kb: 2, origin: c.id,
  };
  setLocal(s, [...local(s).filter((x) => x.id !== id), m]);
  return { ok: true, id };
}

export function discardPearDraft(s: GameState, clientId: string, id: string): ActionResult {
  const c = client(s, clientId);
  if (!c) return fail("error.mailUnknown");
  if (c.protocol === "imap") return discardDraft(s, c.accountId, id);
  if (!local(s).some((m) => m.id === id && m.draft)) return fail("error.mailUnknown");
  setLocal(s, local(s).filter((m) => m.id !== id));
  return { ok: true };
}

// Sends through the account's mailbox. A POP account keeps its Sent copy and its replied mark locally.
export function sendPearMessage(s: GameState, clientId: string, d: Draft & { from: string; draftId?: string; draftOf?: string }): ActionResult {
  const c = client(s, clientId);
  if (!c) return fail("error.mailUnknown");
  const pop = c.protocol === "pop", { draftOf, ...m } = d;
  const r = sendMessage(s, c.accountId, { ...m, re: pop ? undefined : m.re, draftId: draftOf === clientId && !pop ? m.draftId : undefined });
  if (!r.ok) return r;
  if (m.draftId && draftOf) discardPearDraft(s, draftOf, m.draftId);
  if (!pop) return r;
  if (m.re) setLocal(s, local(s).map((x) => (x.id === m.re ? { ...x, ans: true } : x)));
  const sent = r.id ? (s.mail.msgs[c.accountId] ?? []).find((x) => x.id === r.id) : undefined;
  if (!sent) return r;
  drop(s, c.accountId, new Set([sent.id]));
  setLocal(s, [...local(s), { ...sent, folder: localFolder(c.id, "sent"), origin: c.id }]);
  return r;
}
