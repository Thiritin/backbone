// docs/design/plans/webmail-server.md, sections 3.3, 3.4 and 4.4: what an account keeps at a webmail front end, and the
// mailbox verbs that follow its preferences.
import { nowMinutes } from "../00-core/time";
import { matchesConditions } from "../42-mail/deliver";
import { foldersOf, listFolder } from "../42-mail/model";
import type { GameState } from "../50-state";
import { webmailOf, webmailUser, type Contact, type Identity, type WebmailUser } from "../80-business/webmail";
import type { ActionResult } from "./hardware";
import { specialFolder } from "../80-business/webmail-view";
import { deleteMessages, expungeMessages, moveMessages, saveDraft, sendMessage, type Draft } from "./mailmsg";

const fail = (error: string): ActionResult => ({ ok: false, error });

// What a signed-in account keeps at a front end (section 4.4).
function user(s: GameState, clusterId: string, accountId: string, fn: (u: WebmailUser) => WebmailUser | string): ActionResult {
  if (!s.clusters.some((c) => c.id === clusterId && c.kind === "mailweb") || !s.mail.accounts.some((a) => a.id === accountId)) return fail("error.mailUnknown");
  const next = fn(webmailUser(s, clusterId, accountId));
  if (typeof next === "string") return fail(next);
  s.webmail = { ...s.webmail, users: { ...s.webmail.users, [clusterId]: { ...s.webmail.users[clusterId], [accountId]: next } } };
  return { ok: true };
}
const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const setWebmailPref = (s: GameState, clusterId: string, accountId: string, key: string, value: string | number | boolean): ActionResult =>
  user(s, clusterId, accountId, (u) => ({ ...u, prefs: { ...u.prefs, [key]: value } }));

// index null adds an identity; the first one is the default and cannot be removed.
export const saveIdentity = (s: GameState, clusterId: string, accountId: string, index: number | null, id: Identity): ActionResult =>
  user(s, clusterId, accountId, (u) => {
    if (!ADDRESS.test(id.email.trim())) return "error.mailAddress";
    const clean = { name: id.name.trim(), email: id.email.trim().toLowerCase(), replyTo: id.replyTo.trim(), signature: id.signature.slice(0, 1000) };
    return { ...u, identities: index === null ? [...u.identities, clean] : u.identities.map((x, i) => (i === index ? clean : x)) };
  });
export const removeIdentity = (s: GameState, clusterId: string, accountId: string, index: number): ActionResult =>
  user(s, clusterId, accountId, (u) => (index > 0 ? { ...u, identities: u.identities.filter((_, i) => i !== index) } : "error.mailUnknown"));

// A contact is keyed by its nickname; saving an existing nickname replaces it.
export const saveContact = (s: GameState, clusterId: string, accountId: string, c: Contact): ActionResult =>
  user(s, clusterId, accountId, (u) => {
    const nick = c.nick.trim();
    if (!nick || !ADDRESS.test(c.email.trim())) return "error.mailAddress";
    return { ...u, contacts: [...u.contacts.filter((x) => x.nick !== nick), { nick, name: c.name.trim(), email: c.email.trim().toLowerCase(), info: c.info.trim() }] };
  });
export const removeContact = (s: GameState, clusterId: string, accountId: string, nick: string): ActionResult =>
  user(s, clusterId, accountId, (u) => ({ ...u, contacts: u.contacts.filter((x) => x.nick !== nick) }));

// Message Filters (section 3.4): "<field> contains <text>, move to <folder>", kept in the front end.
export const saveLocalFilter = (s: GameState, clusterId: string, accountId: string, f: { field: "from" | "to" | "subject"; text: string; folder: string }): ActionResult =>
  user(s, clusterId, accountId, (u) => {
    if (!f.text.trim() || !foldersOf(s, accountId).some((x) => x.id === f.folder)) return "error.mailNoFolder";
    const id = `lf${s.nextId++}`;
    return { ...u, localFilters: [...u.localFilters, { id, name: id, on: true, match: "all", conds: [{ field: f.field, op: "contains", value: f.text.trim() }], acts: [{ do: "move", folder: f.folder }] }] };
  });
export const deleteLocalFilter = (s: GameState, clusterId: string, accountId: string, id: string): ActionResult =>
  user(s, clusterId, accountId, (u) => ({ ...u, localFilters: u.localFilters.filter((x) => x.id !== id) }));

// Run when the Inbox is opened: the first matching rule moves each message that arrived since the last run.
export function runLocalFilters(s: GameState, clusterId: string, accountId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || !webmailOf(s, c).plugins.includes("filters")) return fail("error.webmailConfig");
  const u = webmailUser(s, clusterId, accountId);
  for (const m of listFolder(s, accountId, "inbox").filter((x) => x.at > u.filteredAt).reverse()) {
    const rule = u.localFilters.find((r) => matchesConditions(s, m, r.match, r.conds));
    const act = rule?.acts[0];
    if (act?.do === "move") moveMessages(s, accountId, [m.id], act.folder);
  }
  return user(s, clusterId, accountId, (x) => ({ ...x, filteredAt: nowMinutes(s) }));
}

// A delete moves to the Trash the account picked, or removes the mail when it uses no Trash or deletes inside it.
export function deleteWebmailMessages(s: GameState, clusterId: string, accountId: string, ids: string[]): ActionResult {
  const trash = specialFolder(s, clusterId, accountId, "trash");
  const inTrash = (s.mail.msgs[accountId] ?? []).some((m) => ids.includes(m.id) && m.folder === trash);
  if (!trash || inTrash) return expungeMessages(s, accountId, ids);
  return trash === "trash" ? deleteMessages(s, accountId, ids) : moveMessages(s, accountId, ids, trash);
}

export function setFolderSubscribed(s: GameState, accountId: string, folderId: string, on: boolean): ActionResult {
  if (!s.mail.folders.some((f) => f.id === folderId && f.accountId === accountId)) return fail("error.mailNoFolder");
  const now = (s.webmail.subs[accountId] ?? []).filter((x) => x !== folderId);
  s.webmail = { ...s.webmail, subs: { ...s.webmail.subs, [accountId]: on ? now : [...now, folderId] } };
  return { ok: true };
}

// Squarecube's Special Folders: a saved draft and the Sent copy move to the folders the account picked.
export function saveWebmailDraft(s: GameState, clusterId: string, accountId: string, d: Draft & { id?: string }): ActionResult {
  const r = saveDraft(s, accountId, d), to = specialFolder(s, clusterId, accountId, "drafts");
  if (r.ok && r.id && to !== "drafts") moveMessages(s, accountId, [r.id], to);
  return r;
}
export function sendWebmailMessage(s: GameState, clusterId: string, accountId: string, m: Parameters<typeof sendMessage>[2]): ActionResult {
  const first = s.nextId, r = sendMessage(s, accountId, m), to = specialFolder(s, clusterId, accountId, "sent");
  const copy = (s.mail.msgs[accountId] ?? []).filter((x) => x.folder === "sent" && Number(x.id.slice(3)) >= first).map((x) => x.id);
  if (r.ok && to !== "sent" && copy.length) moveMessages(s, accountId, copy, to);
  return r;
}
