// Pear Mail actions (docs/design/plans/mail-client.md).
import { checkAccount, clientError } from "../43-pear-mail/check";
import { nowMinutes } from "../00-core/time";
import { drop, store } from "../42-mail/deliver";
import { foldersOf, SYS_FOLDERS } from "../42-mail/model";
import { mailBuild, mailHas } from "../10-catalog/pear-mail";
import type { Folder, Message } from "../42-mail/types";
import { autoServers, CHECK_EVERY, draftClient, type AccountInput } from "../43-pear-mail/setup";
import { localFolder, MY_PEAR, PEAR, type ClientAccount } from "../43-pear-mail/state";
import { visibleTo } from "../43-pear-mail/view";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { discardDraft, emptyFolder, moveMessages, saveDraft, sendMessage, type Draft } from "./mailmsg";

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
  checkAccount(s, clientId, false);
  return error ? fail(error) : { ok: true };
}

// The assistant's last step: stores the account and runs its first check. An account whose check fails is kept with its
// error, as Continue does in the real assistant.
export function setupClientAccount(s: GameState, i: AccountInput & { online?: boolean }): ActionResult {
  const address = i.address.trim().toLowerCase();
  if (!address.includes("@")) return fail("error.mailNoBox");
  if (s.pearMail.accounts.some((c) => c.address === address)) return fail("error.mailDuplicate");
  let input: AccountInput = i;
  if (!i.host?.trim()) {
    if (!mailHas(mailBuild(s.os, s.hour), "autoSetup")) return fail("error.mailFeature");
    const found = autoServers(s, address);
    if (!found) return fail("error.mailServer");
    input = { ...i, protocol: found.protocol, host: undefined, smtp: undefined };
  }
  const id = `cl${s.nextId++}`;
  s.pearMail = { ...s.pearMail, accounts: [...s.pearMail.accounts, { ...draftClient(s, id, input), enabled: i.online ?? true }] };
  checkAccount(s, id);
  return { ok: true, id };
}

type AccountEdit = Partial<Pick<ClientAccount, "description" | "fullName" | "password" | "protocol" | "smtp" | "checkEvery" | "popRemove" | "storeSent" | "signature">> & { host?: string | null };

// Account Information in Preferences: a changed password or server clears a refused password and checks again.
export function editClientAccount(s: GameState, clientId: string, e: AccountEdit): ActionResult {
  const c = client(s, clientId);
  if (!c) return fail("error.mailUnknown");
  if (e.checkEvery !== undefined && e.checkEvery !== 0 && !CHECK_EVERY.includes(e.checkEvery)) return fail("error.mailUnknown");
  if (e.signature && !s.pearMail.signatures.some((x) => x.id === e.signature)) return fail("error.mailUnknown");
  const { host, ...rest } = e, recheck = ["password", "protocol", "smtp", "host"].some((k) => k in e);
  const { authFailed: _a, ...kept } = c;
  const server = host === undefined ? c.server : host?.trim() ? { host: host.trim().toLowerCase(), port: (e.protocol ?? c.protocol) === "imap" ? 993 : 995, tls: true } : null;
  s.pearMail = { ...s.pearMail, accounts: s.pearMail.accounts.map((x) => (x.id === clientId ? { ...(recheck ? kept : c), ...rest, server } : x)) };
  if (recheck) checkAccount(s, clientId, false);
  return { ok: true };
}

// A disabled account is not checked and leaves the unified mailboxes.
export function setAccountEnabled(s: GameState, clientId: string, on: boolean): ActionResult {
  if (!client(s, clientId)) return fail("error.mailUnknown");
  s.pearMail = { ...s.pearMail, accounts: s.pearMail.accounts.map((x) => (x.id === clientId ? { ...x, enabled: on } : x)) };
  return { ok: true };
}

// The server is untouched. A POP account's downloads go with it unless keepCopy files them in an On My Pear mailbox
// named after it.
export function removeClientAccount(s: GameState, clientId: string, keepCopy: boolean): ActionResult {
  const c = client(s, clientId);
  if (!c) return fail("error.mailUnknown");
  const own = (m: Message) => m.folder.startsWith(localFolder(clientId, ""));
  let { folders, messages } = s.pearMail.local;
  if (keepCopy && messages.some(own)) {
    const f: Folder = { id: `pf${s.nextId++}`, accountId: PEAR, name: c.description, parent: null };
    folders = [...folders, f];
    messages = messages.map((m) => (own(m) ? { ...m, folder: localFolder(MY_PEAR, f.id) } : m));
  } else messages = messages.filter((m) => !own(m));
  s.pearMail = {
    ...s.pearMail, accounts: s.pearMail.accounts.filter((x) => x.id !== clientId), rules: s.pearMail.rules.filter((r) => r.clientId !== clientId),
    local: { folders, messages }, prefs: { ...s.pearMail.prefs, defaultFrom: s.pearMail.prefs.defaultFrom === clientId ? null : s.pearMail.prefs.defaultFrom },
  };
  return { ok: true };
}

// The welcome also counts as having seen the current build, so What's new waits for the next one.
export function dismissPearWelcome(s: GameState): ActionResult {
  s.pearMail = { ...s.pearMail, welcomed: true, seenBuild: mailBuild(s.os, s.hour).version };
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

// On My Pear mailboxes: local.folders, nested three deep like a server's, their mail in localFolder(MY_PEAR, id).
const PEAR_DEPTH = 3;
const mine = (s: GameState) => s.pearMail.local.folders;
const myFolder = (s: GameState, id: string | null) => (id === null ? undefined : mine(s).find((f) => f.id === id));
const mySubtree = (s: GameState, id: string): string[] => [id, ...mine(s).filter((f) => f.parent === id).flatMap((f) => mySubtree(s, f.id))];
const myDepth = (s: GameState, id: string | null): number => (id === null ? 0 : 1 + myDepth(s, myFolder(s, id)?.parent ?? null));
const myHeight = (s: GameState, id: string): number => 1 + Math.max(0, ...mine(s).filter((f) => f.parent === id).map((f) => myHeight(s, f.id)));
const myTaken = (s: GameState, parent: string | null, name: string, except?: string) =>
  mine(s).some((f) => f.parent === parent && f.id !== except && f.name.toLowerCase() === name.toLowerCase());
const setMine = (s: GameState, folders: Folder[]): void => { s.pearMail = { ...s.pearMail, local: { ...s.pearMail.local, folders } }; };

export function createPearFolder(s: GameState, name: string, parent: string | null = null): ActionResult {
  const n = name.trim();
  if (parent !== null && !myFolder(s, parent)) return fail("error.mailNoFolder");
  if (!n || n.length > 40 || myTaken(s, parent, n)) return fail("error.mailFolderName");
  if (myDepth(s, parent) + 1 > PEAR_DEPTH) return fail("error.mailFolderDepth");
  const f: Folder = { id: `pf${s.nextId++}`, accountId: PEAR, name: n, parent };
  setMine(s, [...mine(s), f]);
  return { ok: true, id: f.id };
}

export function renamePearFolder(s: GameState, id: string, name: string): ActionResult {
  const f = myFolder(s, id), n = name.trim();
  if (!f) return fail("error.mailNoFolder");
  if (!n || n.length > 40 || myTaken(s, f.parent, n, id)) return fail("error.mailFolderName");
  setMine(s, mine(s).map((x) => (x.id === id ? { ...x, name: n } : x)));
  return { ok: true };
}

export function movePearFolder(s: GameState, id: string, parent: string | null): ActionResult {
  const f = myFolder(s, id);
  if (!f || (parent !== null && (!myFolder(s, parent) || mySubtree(s, id).includes(parent)))) return fail("error.mailNoFolder");
  if (myTaken(s, parent, f.name, id)) return fail("error.mailFolderName");
  if (myDepth(s, parent) + myHeight(s, id) > PEAR_DEPTH) return fail("error.mailFolderDepth");
  setMine(s, mine(s).map((x) => (x.id === id ? { ...x, parent } : x)));
  return { ok: true };
}

// The mailbox and the ones inside it go; their mail moves to the On My Pear Trash.
export function deletePearFolder(s: GameState, id: string): ActionResult {
  if (!myFolder(s, id)) return fail("error.mailNoFolder");
  const gone = new Set(mySubtree(s, id).map((f) => localFolder(MY_PEAR, f)));
  setLocal(s, local(s).map((m) => (gone.has(m.folder) ? { ...m, folder: localFolder(MY_PEAR, "trash") } : m)));
  setMine(s, mine(s).filter((f) => !gone.has(localFolder(MY_PEAR, f.id))));
  return { ok: true };
}

// Move to and drag and drop: within one account, or between an account and On My Pear. A move into On My Pear takes the
// server copy away; a copy (Option held) leaves the original and files a new message.
export function transferMessages(s: GameState, from: string, ids: string[], to: string, folder: string, copy = false): ActionResult {
  const src = from === MY_PEAR ? null : client(s, from), dst = to === MY_PEAR ? null : client(s, to);
  if ((from !== MY_PEAR && !src) || (to !== MY_PEAR && !dst)) return fail("error.mailUnknown");
  if (src && dst && src.id !== dst.id) return fail("error.mailCrossAccount");
  const sys = (SYS_FOLDERS as string[]).includes(folder);
  if (!dst ? !sys && !myFolder(s, folder) : dst.protocol === "pop" && !sys) return fail("error.mailNoFolder");
  const want = new Set(ids);
  const picked = src?.protocol === "imap" ? (s.mail.msgs[src.accountId] ?? []).filter((m) => want.has(m.id) && visibleTo(src, m)) : local(s).filter((m) => want.has(m.id));
  if (!picked.length) return fail("error.mailUnknown");
  const fresh = (m: Message): Message => (copy ? { ...m, id: `msg${s.nextId++}` } : m);
  const filed = (m: Message, at: string): Message => {
    const { prev: _p, ...rest } = m;
    return folder === "trash" && m.folder !== at ? { ...rest, folder: at, prev: m.folder.split(":").pop()! } : { ...rest, folder: at };
  };
  if (dst?.protocol === "imap") {
    if (src && !copy) return moveMessages(s, dst.accountId, ids, folder);
    const box = () => s.mail.accounts.find((a) => a.id === dst.accountId && a.closedAt === null);
    if (!box()) return fail("error.mailUnknown");
    if (!foldersOf(s, dst.accountId).some((f) => f.id === folder)) return fail("error.mailNoFolder");
    // A copy on the server, or an upload from On My Pear.
    for (const m of picked) { const { origin: _o, ...up } = fresh(m); store(s, box()!, filed(up, folder)); }
    if (!src && !copy) setLocal(s, local(s).filter((m) => !want.has(m.id)));
    return { ok: true };
  }
  const at = localFolder(dst ? dst.id : MY_PEAR, folder);
  const moved = picked.map((m) => filed(fresh(m), at));
  if (src?.protocol === "imap") {
    if (!copy) drop(s, src.accountId, want);
    setLocal(s, [...local(s), ...moved]);
  } else setLocal(s, copy ? [...local(s), ...moved] : local(s).map((m) => moved.find((x) => x.id === m.id) ?? m));
  return { ok: true };
}

// Erase Deleted Messages and Erase Junk Mail, for one account, On My Pear, or every account and On My Pear.
export function erasePearMailbox(s: GameState, folder: "trash" | "junk", clientId?: string): ActionResult {
  const cs = s.pearMail.accounts.filter((c) => !clientId || c.id === clientId);
  if (clientId && clientId !== MY_PEAR && !cs.length) return fail("error.mailUnknown");
  for (const c of cs.filter((x) => x.protocol === "imap")) emptyFolder(s, c.accountId, folder);
  const ids = new Set([...cs.filter((c) => c.protocol === "pop").map((c) => c.id), ...(!clientId || clientId === MY_PEAR ? [MY_PEAR] : [])]);
  setLocal(s, local(s).filter((m) => { const [c, f] = partsOf(m); return !(ids.has(c) && f === folder); }));
  return { ok: true };
}
