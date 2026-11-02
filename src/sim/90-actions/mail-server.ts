// docs/design/plans/webmail-server.md: setting up the webmail front ends of the own mail server.
import type { GameState } from "../50-state";
import type { Cluster } from "../60-infra/cluster";
import { frontOf, mailClusterAt, webmailClusters, webmailDefaults, webmailOf, WEBMAIL_PLUGINS, type WebmailInstall } from "../80-business/webmail";
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
