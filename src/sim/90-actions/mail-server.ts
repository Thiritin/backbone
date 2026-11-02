// docs/design/plans/webmail-server.md: setting up the webmail front ends of the own mail server.
import type { GameState } from "../50-state";
import type { Cluster } from "../60-infra/cluster";
import {
  frontOf, mailClusterAt, webmailClusters, webmailDefaults, webmailOf, webmailUser, WEBMAIL_PLUGINS, type Contact, type Identity, type WebmailInstall, type WebmailUser,
} from "../80-business/webmail";
import { nowMinutes } from "../00-core/time";
import { matchesConditions } from "../42-mail/deliver";
import { foldersOf, listFolder } from "../42-mail/model";
import { deleteMessages, expungeMessages, moveMessages } from "./mailmsg";
import type { ActionResult } from "./hardware";
import type { MailRole } from "../42-mail/types";
import { MAIL_OPTIONS, MAIL_SOFTWARE, type MailOption } from "../80-business/mail-software";
import type { SelfMailSoftware } from "../80-business/mail";
import { familyOf } from "../60-infra/vulns";
import { addAlias, createMailAccount, setAccountQuota, setAccountRoles, setPrimary } from "./mailbox";
import { mailboxTaken } from "../42-mail/accounts";
import { cancelMail } from "./mail";

const fail = (error: string): ActionResult => ({ ok: false, error });
const port = (p: number) => Number.isInteger(p) && p > 0 && p < 65536;

function save(s: GameState, c: Cluster, cfg: WebmailInstall, setupPending: boolean): void {
  s.webmail = { ...s.webmail, installs: { ...s.webmail.installs, [c.id]: cfg } };
  const backend = mailClusterAt(s, c, cfg.imapHost)?.id ?? null;
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, backend, setupPending } : x));
}

// A fresh front end takes the mail server on its machine; SquirrelMeal waits for conf.pl to save its config.php and
// Postfixit Admin for its setup page (finishPanelSetup).
export function startWebmail(s: GameState, clusterId: string): void {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (c) save(s, c, webmailDefaults(s, c), frontOf(c) === "squirrelmeal" || frontOf(c) === "postfixitadmin");
}

// Saves a front end's configuration, as conf.pl does; the IMAP server it names becomes its backend.
export function configureWebmail(s: GameState, clusterId: string, cfg: Partial<WebmailInstall>): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || c.kind !== "mailweb") return fail("error.unknownCluster");
  const next = { ...webmailOf(s, c), ...cfg };
  if (!next.imapHost.trim() || !next.smtpHost.trim() || !port(next.imapPort) || !port(next.smtpPort)) return fail("error.webmailConfig");
  if (next.plugins.some((p) => !(WEBMAIL_PLUGINS as readonly string[]).includes(p))) return fail("error.webmailConfig");
  save(s, c, { ...next, imapHost: next.imapHost.trim(), smtpHost: next.smtpHost.trim() }, false);
  return { ok: true, id: c.id };
}

// Picks the front end that answers at webmail.<domain>.
export function setWebmailDefault(s: GameState, clusterId: string): ActionResult {
  if (!webmailClusters(s).some((c) => c.id === clusterId)) return fail("error.unknownCluster");
  s.webmail = { ...s.webmail, default: clusterId };
  return { ok: true, id: clusterId };
}

// Removing a front end drops what it kept; the mail stays on the server.
export function dropWebmail(s: GameState, clusterId: string): void {
  const { [clusterId]: _, ...installs } = s.webmail.installs, { [clusterId]: _u, ...users } = s.webmail.users;
  s.webmail = { ...s.webmail, installs, users, default: s.webmail.default === clusterId ? null : s.webmail.default };
}

// A switch on the mail server's own page; Mailpig's Rspamed is always on.
export function setMailSoftwareOption(s: GameState, clusterId: string, key: MailOption, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), sw = c && (familyOf(c) as SelfMailSoftware | null);
  if (!c || c.kind !== "mail" || !sw || !(sw in MAIL_SOFTWARE)) return fail("error.noMailServer");
  if (!(MAIL_OPTIONS as readonly string[]).includes(key) || MAIL_SOFTWARE[sw].spam.always) return fail("error.mailOptionFixed");
  s.webmail = { ...s.webmail, options: { ...s.webmail.options, [c.id]: { ...s.webmail.options[c.id], [key]: on } } };
  return { ok: true, id: c.id };
}

// Each role goes to one mailbox: the ones ticked here leave the tenant's other mailboxes, and owner mail moves the primary.
export function assignMailRoles(s: GameState, id: string, roles: MailRole[]): ActionResult {
  const a = s.mail.accounts.find((x) => x.id === id);
  if (!a) return fail("error.mailUnknown");
  const routed: MailRole[] = roles.filter((r) => r !== "owner");
  if (roles.includes("owner")) {
    const r = setPrimary(s, id);
    if (!r.ok) return r;
  }
  for (const b of s.mail.accounts) if (b.tenant === a.tenant && b.id !== id && b.roles.some((r) => routed.includes(r))) setAccountRoles(s, b.id, b.roles.filter((r) => !routed.includes(r)));
  return setAccountRoles(s, id, roles);
}

// The admin pages' Create mailbox form: the account, its quota and roles, and the welcome mail unless it is unticked.
export function createAdminMailbox(s: GameState, o: { tenant: string; local: string; title: string; password: string; quotaMb?: number; roles?: MailRole[]; welcome?: boolean }): ActionResult {
  if (o.quotaMb !== undefined && (!Number.isInteger(o.quotaMb) || o.quotaMb < 1)) return fail("error.mailQuota");
  const r = createMailAccount(s, o);
  if (!r.ok) return r;
  const id = r.id!;
  if (o.quotaMb !== undefined) setAccountQuota(s, id, o.quotaMb);
  if (o.roles?.length) assignMailRoles(s, id, o.roles);
  if (o.welcome === false) s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [id]: [] }, accounts: s.mail.accounts.map((a) => (a.id === id ? { ...a, usedKb: 0 } : a)) };
  return { ok: true, id };
}

export const DEFAULT_ALIASES = ["postmaster", "abuse", "hostmaster", "webmaster"];
// "Add default mail aliases": the four role addresses on one mailbox, skipping those already taken.
export function addDefaultAliases(s: GameState, id: string): ActionResult {
  const a = s.mail.accounts.find((x) => x.id === id), t = a && s.mail.tenants.find((x) => x.id === a.tenant);
  if (!a || !t) return fail("error.mailUnknown");
  for (const l of DEFAULT_ALIASES) {
    if (mailboxTaken(s, t, l)) continue;
    const r = addAlias(s, id, l);
    if (!r.ok) return r;
  }
  return { ok: true, id };
}

// Uninstalling the mail server ends its tenant at once: every mailbox and message on it is gone, and the company falls
// back to GMix.
export function dropMailServer(s: GameState, clusterId: string): void {
  const tenants = new Set(s.mail.tenants.filter((t) => t.host === "self" && t.clusterId === clusterId).map((t) => t.id));
  if (s.company.mail.kind === "self" && s.company.mail.clusterId === clusterId) cancelMail(s);
  const gone = new Set(s.mail.accounts.filter((a) => tenants.has(a.tenant)).map((a) => a.id));
  if (!gone.size && !tenants.size) return;
  const msgs = Object.fromEntries(Object.entries(s.mail.msgs).filter(([id]) => !gone.has(id)));
  const contacts = Object.fromEntries(Object.entries(s.mail.contacts).filter(([, id]) => !gone.has(id)));
  s.mail = { ...s.mail, msgs, contacts, accounts: s.mail.accounts.filter((a) => !gone.has(a.id)), channels: s.mail.channels.filter((c) => !gone.has(c.accountId)),
    tenants: s.mail.tenants.map((t) => (tenants.has(t.id) ? { ...t, endsAt: Math.min(t.endsAt ?? s.hour, s.hour) } : t)),
    catchAll: s.mail.catchAll && gone.has(s.mail.catchAll) ? null : s.mail.catchAll };
  const { [clusterId]: _, ...options } = s.webmail.options;
  s.webmail = { ...s.webmail, options };
}

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
  const trash = String(webmailUser(s, clusterId, accountId).prefs.trash ?? "trash");
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
