// docs/design/plans/webmail-server.md: the webmail front ends of the own mail server, what each install is set up with,
// and the hooks mail-core reads to learn what the own server offers.
import { t } from "../../i18n/en";
import { companyDomain } from "../30-customers/domains";
import { WEBMAIL, type WebmailId } from "../10-catalog/webmail";
import { mailHooks, type SelfHostCaps } from "../42-mail/caps";
import type { MailRule } from "../42-mail/types";
import type { GameState } from "../50-state";
import { controlPlaneUp, type Cluster } from "../60-infra/cluster";
import { panelMachine as machineIdOf } from "../60-infra/licence";
import { familyOf } from "../60-infra/vulns";
import { mailClusterAtHost, namesOf } from "../60-infra/mail-host";
import { panelDeliver } from "../60-infra/panel-mail";
import { MAIL_SOFTWARE, spamOn, type MailOption } from "./mail-software";

// What the configuration of a front end holds (section 3.5); conf keeps SquirrelMeal's other config.php values by variable
// and Squarecube's database; installerOpen is Squarecube's installer, enabled until the player disables it.
export interface WebmailInstall {
  productName: string; domain: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; plugins: string[];
  conf: Record<string, string>; installerOpen?: boolean;
}
// installs by front end cluster; default is the cluster that answers at webmail.<domain>, null for the first installed;
// options are the mail servers' switches by cluster (section 5.1); users by front end cluster and account (section 4.4);
// subs the folder ids each account unsubscribed.
export interface WebmailState {
  installs: Record<string, WebmailInstall>; default: string | null; options: Record<string, Partial<Record<MailOption, boolean>>>;
  users: Record<string, Record<string, WebmailUser>>; subs: Record<string, string[]>;
}

export interface Identity { name: string; email: string; replyTo: string; signature: string }
export interface Contact { nick: string; name: string; email: string; info: string }
export type WebmailPrefs = Record<string, string | number | boolean>;
// What a front end keeps for one account; localFilters run over Inbox mail newer than filteredAt (game minutes).
export interface WebmailUser { identities: Identity[]; contacts: Contact[]; prefs: WebmailPrefs; localFilters: MailRule[]; filteredAt: number }
// trash is the folder a delete moves to, "" for "Do not use Trash".
export const PREF_DEFAULTS = { theme: "default", perPage: 15, trash: "trash" } satisfies WebmailPrefs;

// SquirrelMeal's plugins (section 3.4): the bundled ones start switched on.
export const WEBMAIL_PLUGINS = ["filters", "changepass", "havelsieve", "squirrelspelt"] as const;
const BUNDLED = ["filters", "squirrelspelt"];
const IMAP_PORTS = [143, 993];

// The front end a cluster runs, also while it installs.
export const frontOf = (c: Cluster): string | null => familyOf(c) ?? c.switching?.to ?? null;

mailHooks.panelInbox = (s, m) => panelDeliver(s, { from: m.from, to: m.to, subject: m.own?.subject ?? m.topic, body: m.own?.text ?? "" });

// The own mail server a front end reaches at a host name: its own machine's at localhost.
export const mailClusterAt = (s: GameState, front: Cluster, host: string): Cluster | null => mailClusterAtHost(s, host, machineIdOf(front));

// A fresh install points at the mail server on its machine, else at the company's mail server by name.
export function webmailDefaults(s: GameState, front: Cluster): WebmailInstall {
  const self = machineIdOf(front), local = s.clusters.find((c) => c.kind === "mail" && machineIdOf(c) === self);
  const other = local ? null : s.clusters.find((c) => c.kind === "mail"), id = other && machineIdOf(other);
  const host = local || !id ? "localhost" : namesOf(s, id)[1] ?? namesOf(s, id)[0] ?? "localhost";
  const sw = frontOf(front), name = WEBMAIL.find((w) => w.id === sw)?.name ?? "";
  const base = { productName: name, domain: companyDomain(s), imapHost: host, imapPort: 143, smtpHost: host, smtpPort: 25, plugins: [...BUNDLED], conf: {} };
  return sw === "squarecube" ? { ...base, productName: `${name} Webmail`, plugins: [], conf: { db_dsnw: SQUARECUBE_DSN }, installerOpen: true } : base;
}
export const SQUARECUBE_DSN = "mysql://squarecube:pass@localhost/squarecubemail";
export const installerLeft = (s: GameState, clusterId: string): boolean => !!s.webmail.installs[clusterId]?.installerOpen;

export const webmailOf = (s: GameState, front: Cluster): WebmailInstall => s.webmail.installs[front.id] ?? webmailDefaults(s, front);

export const CONFIG_PHP = "/etc/squirrelmeal/config.php";
// The config.php variables of each conf.pl menu with their config_default.php values; the variables in CORE live in
// WebmailInstall's own fields.
export const CONF_ITEMS: Record<string, [string, string][]> = {
  org: [["org_name", ""], ["org_logo", "../images/sm_logo.png"], ["org_title", "SquirrelMeal $version"], ["signout_page", ""], ["frame_top", "_top"], ["provider_uri", "http://squirrelmeal.org/"], ["provider_name", "SquirrelMeal"]],
  server: [["domain", ""], ["invert_time", "false"]],
  imap: [["imapServerAddress", ""], ["imapPort", ""], ["imap_auth_mech", "login"], ["use_imap_tls", "false"], ["imap_server_type", "other"], ["optional_delimiter", "detect"]],
  smtp: [["smtpServerAddress", ""], ["smtpPort", ""], ["pop_before_smtp", "false"], ["smtp_auth_mech", "none"], ["use_smtp_tls", "false"], ["encode_header_key", ""]],
  folders: [
    ["default_folder_prefix", ""], ["show_prefix_option", "false"], ["trash_folder", "INBOX.Trash"], ["sent_folder", "INBOX.Sent"], ["draft_folder", "INBOX.Drafts"],
    ["default_move_to_trash", "true"], ["default_move_to_sent", "true"], ["default_save_as_draft", "true"], ["list_special_folders_first", "true"], ["auto_create_special", "true"],
  ],
  general: [
    ["data_dir", "/var/lib/squirrelmeal/data/"], ["attachment_dir", "/var/spool/squirrelmeal/attach/"], ["dir_hash_level", "0"], ["default_left_size", "150"],
    ["force_username_lowercase", "false"], ["default_use_priority", "true"], ["hide_sm_attributions", "false"], ["default_use_mdn", "true"], ["edit_identity", "true"], ["session_name", "SQMSESSID"],
  ],
  themes: [["theme_default", "0"], ["theme_css", ""]],
  abook: [["default_use_javascript_addr_book", "false"], ["abook_global_file", ""], ["abook_global_file_writeable", "false"]],
  motd: [["motd", ""]],
  db: [["addrbook_dsn", ""], ["addrbook_table", "address"], ["prefs_dsn", ""], ["prefs_table", "userprefs"], ["prefs_user_field", "user"], ["prefs_key_field", "prefkey"], ["prefs_val_field", "prefval"]],
  lang: [["squirrelmail_default_language", "en_US"], ["default_charset", "iso-8859-1"], ["lossy_encoding", "false"]],
};
const CORE: Record<string, "productName" | "domain" | "imapHost" | "imapPort" | "smtpHost" | "smtpPort"> = {
  org_name: "productName", domain: "domain", imapServerAddress: "imapHost", imapPort: "imapPort", smtpServerAddress: "smtpHost", smtpPort: "smtpPort",
};
const DEFAULTS: Record<string, string> = Object.fromEntries(Object.values(CONF_ITEMS).flat());

export const confValue = (cfg: WebmailInstall, key: string): string => (key in CORE ? String(cfg[CORE[key]]) : cfg.conf[key] ?? DEFAULTS[key] ?? "");
export function setConfValue(cfg: WebmailInstall, key: string, value: string): WebmailInstall {
  const f = CORE[key];
  return f ? { ...cfg, [f]: f.endsWith("Port") ? Number(value) : value } : { ...cfg, conf: { ...cfg.conf, [key]: value } };
}

const php = (v: string) => (/^(true|false|\d+)$/.test(v) ? v : `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);
// The config.php conf.pl writes.
export function configPhp(cfg: WebmailInstall): string {
  const vars = Object.values(CONF_ITEMS).flat().map(([k]) => `$${k.padEnd(32)} = ${php(confValue(cfg, k))};`);
  return [
    "<?php", "", "/**", " * SquirrelMeal Configuration File", " * Created using the configure script, conf.pl", " */", "", "global $version;", "$config_version = '1.4.0';", "",
    ...vars, "", ...cfg.plugins.map((p, i) => `$plugins[${i}] = '${t(`mailserver.plugin.${p}`)}';`), "", "?>", "",
  ].join("\n");
}

// Whether the front end reaches an IMAP server: its backend runs and is asked on an IMAP port.
export function imapUp(s: GameState, front: Cluster): boolean {
  const back = s.clusters.find((c) => c.id === front.backend), cfg = webmailOf(s, front);
  return !!back && controlPlaneUp(s, back) && IMAP_PORTS.includes(cfg.imapPort) && mailClusterAt(s, front, cfg.imapHost)?.id === back.id;
}

// A sign-in at the front end: the account id, or why it fails. The name is the mailbox's local part or its address.
export function webmailSignIn(s: GameState, front: Cluster, name: string, password: string): { ok: true; account: string } | { ok: false; error: "refused" | "badLogin" } {
  if (!imapUp(s, front)) return { ok: false, error: "refused" };
  const n = name.trim().toLowerCase(), tenants = s.mail.tenants.filter((x) => x.host === "self" && x.clusterId === front.backend && !x.locked).map((x) => x.id);
  const a = s.mail.accounts.find((x) => tenants.includes(x.tenant) && !x.shared && (n === x.local || n === `${x.local}@${x.domain}`));
  return a && a.password === password ? { ok: true, account: a.id } : { ok: false, error: "badLogin" };
}

const isWebmail = (c: Cluster): boolean => WEBMAIL.some((w) => !w.admin && w.id === frontOf(c));
export const webmailClusters = (s: GameState): Cluster[] => s.clusters.filter(isWebmail);
// The front end that answers at webmail.<domain>: the one the player picked, else the first installed.
export function defaultWebmail(s: GameState): Cluster | null {
  const all = webmailClusters(s);
  return all.find((c) => c.id === s.webmail.default) ?? all[0] ?? null;
}

// Hooks for mail-core (section 2.2), assigned below once this module loads; the install actions import it.
export const installedWebmail = (s: GameState): WebmailId | null => {
  const c = defaultWebmail(s);
  return c ? (frontOf(c) as WebmailId) : null;
};
// Dovecoat comes with Postfixit and gives IMAP and POP; Sieve and the spam filter follow MAIL_SOFTWARE.
export function selfHostCaps(s: GameState): SelfHostCaps {
  const m = s.company.mail, c = m.kind === "self" ? s.clusters.find((x) => x.id === m.clusterId) : undefined;
  if (!c || m.kind !== "self") return { imap: true, pop: true, sieve: false, junkBonus: 0 };
  const row = MAIL_SOFTWARE[m.software];
  return { imap: true, pop: true, sieve: c.version >= row.sieveFrom, junkBonus: spamOn(s, c, m.software) ? row.spam.bonus : 0 };
}

Object.assign(mailHooks, { installedWebmail, selfHostCaps });

// An account's entry at a front end, fresh with one identity from the mailbox until the first save.
export function webmailUser(s: GameState, clusterId: string, accountId: string): WebmailUser {
  const kept = s.webmail.users[clusterId]?.[accountId];
  if (kept) return kept;
  const a = s.mail.accounts.find((x) => x.id === accountId);
  return { identities: [{ name: a?.title ?? "", email: a ? `${a.local}@${a.domain}` : "", replyTo: "", signature: "" }], contacts: [], prefs: {}, localFilters: [], filteredAt: 0 };
}
export const webmailPref = <K extends keyof typeof PREF_DEFAULTS>(u: WebmailUser, key: K): (typeof PREF_DEFAULTS)[K] =>
  (u.prefs[key] ?? PREF_DEFAULTS[key]) as (typeof PREF_DEFAULTS)[K];
export const subscribed = (s: GameState, accountId: string, folderId: string): boolean => !s.webmail.subs[accountId]?.includes(folderId);
