// docs/design/web-hosting.md, The web space: a customer's contents are derived from the workload each time they are read,
// and only the player's changes are stored, as an overlay per workload.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { App } from "../10-catalog/apps";
import { packageNamed, type PackageDef } from "../80-business/packages";
import { accountUse } from "../80-business/readouts";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import type { Cluster, Workload } from "./cluster";

// Paths are relative to the account's home, such as "public_html/wp-config.php". Sizes are MB, at is the hour last modified.
// mode is the octal permission set by the player; archive names the catalog archive an uploaded file is, and pack holds
// what an archive compressed in the panel contains, by path relative to the archive's folder.
export interface WebFile { dir?: true; mb: number; at: number; mode?: string; archive?: string; pack?: Record<string, WebFile> }
// cPanel creates public_html as 0750 so only the web server's group reads it; everything else gets the umask defaults.
export const modeOf = (path: string, f: WebFile): string => f.mode ?? (path === "public_html" ? "0750" : f.dir ? "0755" : "0644");
export type DomainKind = "main" | "addon" | "sub" | "parked";
export interface WebDomain { name: string; kind: DomainKind; folder: string; php: string }
// schema and tables hold the tables of an imported or installed database (webdb.ts); without them the tables derive from the app.
// src is the database the generated rows come from, kept through an export and import.
export interface WebDatabase { name: string; mb: number; schema?: string; tables?: Record<string, number>; src?: string }
// A row the player edited or inserted in phpMyAdmon, keyed "db.table.pk"; values holds the changed columns only.
export interface DbRow { db: string; table: string; pk: number; values: Record<string, string> }
// grants maps a database name to its privileges, such as ["ALL PRIVILEGES"]. The host is always localhost.
export interface DbUser { name: string; password: string; grants: Record<string, string[]> }
export interface Mailbox { address: string; password: string; quotaMb: number; usedMb: number }
export interface Forwarder { from: string; to: string }
export interface FtpAccount { user: string; password: string; folder: string; quotaMb: number }
// schedule is the five crontab fields the player entered; everyHours is how often it runs in effect, at most hourly.
export interface CronJob { id: string; command: string; everyHours: number; schedule?: string }
export interface WebLimits { databases: number; mailboxes: number; ftpAccounts: number; addonDomains: number; subdomains: number }
export interface WebUsage {
  diskMb: number; quotaMb: number; inodes: number;
  databases: number; dbUsers: number; mailboxes: number; forwarders: number; ftpAccounts: number; addonDomains: number; subdomains: number; parked: number; cron: number;
}
// The app the customer runs, where it lives and the config file and database it needs (web-hosting.md 2.2).
export interface WebApp { id: App; folder: string; config: string; db: string }

// Every part keyed by its name, so the overlay merges by key.
export interface WebParts {
  files: Record<string, WebFile>; domains: Record<string, WebDomain>; databases: Record<string, WebDatabase>; dbUsers: Record<string, DbUser>;
  mailboxes: Record<string, Mailbox>; forwarders: Record<string, Forwarder>; ftp: Record<string, FtpAccount>; cron: Record<string, CronJob>;
  rows: Record<string, DbRow>;
}
export type PartName = keyof WebParts;
export const PARTS: PartName[] = ["files", "domains", "databases", "dbUsers", "mailboxes", "forwarders", "ftp", "cron", "rows"];
// What the player changed: a value adds or replaces an entry, false removes a derived one.
export type WebspaceOverlay = { [K in PartName]?: Record<string, WebParts[K][string] | false> };

export interface Webspace extends WebParts {
  workloadId: string; panel: string; account: string; prefix: string; webroot: string; domain: string;
  app: WebApp | null; limits: WebLimits; usage: WebUsage;
  // The files an attacker left on a defaced site, before the overlay; deleting all of them cleans it.
  shells: string[];
}

// A web space the player made for the company on a panel host, as an admin does in WHM's Create a New Account. It has no
// service and starts with the panel's skeleton only; at is the hour it was created.
export interface OwnWebspace { id: string; clusterId: string; account: string; domain: string; at: number }

// Defaults for packages saved before these counts and for accounts sold without a package.
export const WEB_LIMITS: Omit<WebLimits, "mailboxes"> = { databases: 5, ftpAccounts: 5, addonDomains: 1, subdomains: 10 };
// The company's own accounts run without a package, so nothing caps them.
const UNLIMITED: WebLimits = { databases: Infinity, mailboxes: Infinity, ftpAccounts: Infinity, addonDomains: Infinity, subdomains: Infinity };
export const ALL_PRIVILEGES = ["ALL PRIVILEGES"];
// cPanel's MultiPHP Manager; before it every domain runs the host's PHP.
export const MULTI_PHP_YEAR = 2015;
const MAIL_SHARE = 0.1, DB_SHARE = 0.2, SMALL_FILE_MB = 0.004;

// The files an app ships with, in share of the disk the files use; the config file is the one the app reads its database from.
const APP_FILES: Record<App, { files: [string, number][]; config?: string; db?: string }> = {
  wordpass: { files: [["wp-admin", 30], ["wp-content", 35], ["wp-content/uploads", 20], ["wp-includes", 12], ["index.php", 1], ["wp-config.php", 1], [".htaccess", 1]], config: "wp-config.php", db: "wp" },
  joomlah: { files: [["administrator", 25], ["components", 30], ["media", 30], ["images", 5], ["templates", 8], ["index.php", 1], ["configuration.php", 1]], config: "configuration.php", db: "joom" },
  drupel: { files: [["core", 40], ["modules", 20], ["sites", 30], ["sites/default", 1], ["sites/default/files", 4], ["themes", 3], ["index.php", 1], ["sites/default/settings.php", 1]], config: "sites/default/settings.php", db: "drup" },
  static: { files: [["images", 80], ["css", 5], ["index.html", 5], ["about.html", 5], ["contact.html", 5]] },
};

// The writable folder a backdoor is dropped into on a defaced site.
const SHELL_DIR: Partial<Record<App, string>> = { wordpass: "wp-content/uploads", joomlah: "images", drupel: "sites/default/files" };

const strHash = (text: string): number => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
const password = (s: GameState, ...parts: string[]): string => {
  const r = hashRng(s.seed, ...parts.map(strHash));
  return Array.from({ length: 12 }, () => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand(r) * 57)]).join("");
};
// Named after the hack, so a file deleted after an earlier hack never hides the next one.
const shellName = (s: GameState, serviceId: string, hack: number): string => {
  const r = hashRng(s.seed, strHash(serviceId), hack, 334);
  return Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand(r) * 36)]).join("");
};

export const webrootOf = (panel: string): string => (panel === "pleskit" ? "httpdocs" : "public_html");
// cPanel puts the first eight characters of the username in front of every database and database user.
export const prefixOf = (account: string): string => `${account.slice(0, 8)}_`;
// MySQL user names were capped at 16 characters until MySQL 5.7.
export const dbUserMax = (year: number): number => (year < 2016 ? 16 : 32);

export function limitsOf(pkg: PackageDef | undefined, mailboxes: number): WebLimits {
  return {
    databases: pkg?.databases ?? WEB_LIMITS.databases, mailboxes, ftpAccounts: pkg?.ftpAccounts ?? WEB_LIMITS.ftpAccounts,
    addonDomains: pkg?.addonDomains ?? WEB_LIMITS.addonDomains, subdomains: pkg?.subdomains ?? WEB_LIMITS.subdomains,
  };
}

// The username a panel suggests for a domain: its first label, letters and digits only, eight characters.
export const accountFor = (domain: string): string =>
  (domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^[0-9]+/, "") || "user").slice(0, 8);

// The panel host of a web space: a customer workload's cluster or an own web space's.
export function hostOf(s: GameState, id: string): { c: Cluster; w?: Workload; own?: OwnWebspace } | null {
  const own = s.ownWebspaces.find((x) => x.id === id), w = own ? undefined : s.workloads.find((x) => x.id === id);
  const c = (own || w) && s.clusters.find((x) => x.id === (own?.clusterId ?? w?.clusterId));
  return c && c.kind === "panel" && c.panel ? { c, w, own } : null;
}

export const ownWebspacesOn = (s: GameState, clusterId: string): OwnWebspace[] => s.ownWebspaces.filter((x) => x.clusterId === clusterId);
// The company domain's main web space, where the company website and the shop live.
export function companyWebspace(s: GameState): Webspace | null {
  const own = s.ownWebspaces.find((x) => x.domain === companyDomain(s));
  return own ? webspaceOf(s, own.id) : null;
}

// The contents a customer web space has without any change by the player.
export function deriveWebspace(s: GameState, workloadId: string): Webspace | null {
  const at = hostOf(s, workloadId);
  if (!at) return null;
  const { c, own } = at, w = at.w!, v = own ? undefined : s.services.find((x) => x.id === w.serviceId);
  const domain = own?.domain ?? v?.domain ?? v?.label ?? w.hostname ?? w.id;
  const account = own?.account ?? v?.username ?? accountFor(domain);
  const panel = c.panel!, webroot = webrootOf(panel), prefix = prefixOf(account), since = own?.at ?? v?.startedAt ?? w.placedAt, year = yearOf(s.hour);
  const ws: Webspace = {
    workloadId, panel, account, prefix, webroot, domain, app: null, shells: [], files: {}, domains: {}, databases: {}, dbUsers: {}, mailboxes: {}, forwarders: {}, ftp: {}, cron: {}, rows: {},
    limits: own ? UNLIMITED : limitsOf(v?.pkg ? packageNamed(c, v.pkg) : undefined, v?.spec.mailboxes ?? 0), usage: undefined!,
  };
  for (const p of [webroot, "logs", "tmp", "mail"]) ws.files[p] = { dir: true, mb: 0, at: since };
  ws.domains[domain] = { name: domain, kind: "main", folder: webroot, php: c.php };
  // The default page a new account serves until the player uploads a site.
  if (own) ws.files[`${webroot}/index.html`] = { mb: 0.004, at: since };
  if (v) {
    const app = v.spec.app ?? "static", def = APP_FILES[app], usedMb = accountUse(s, w).disk[0] * 1024;
    const nMail = Math.min(v.spec.mailboxes, 8), mailMb = nMail ? usedMb * MAIL_SHARE : 0, dbMb = def.db ? usedMb * DB_SHARE : 0, filesMb = usedMb - mailMb - dbMb;
    // A single file weighs a few KB; the folders take the rest of the disk the files use.
    const isFile = (n: string) => n.includes("."), fileMb = (share: number) => Math.min(SMALL_FILE_MB, filesMb * share / 100);
    const dirMb = filesMb - def.files.filter(([n]) => isFile(n)).reduce((a, [, share]) => a + fileMb(share), 0), dirShare = def.files.filter(([n]) => !isFile(n)).reduce((a, [, share]) => a + share, 0);
    for (const [n, share] of def.files) ws.files[`${webroot}/${n}`] = { ...(isFile(n) ? {} : { dir: true as const }), mb: +(isFile(n) ? fileMb(share) : dirMb * share / dirShare).toFixed(3), at: since };
    if (!def.files.some(([n]) => n === ".htaccess")) ws.files[`${webroot}/.htaccess`] = { mb: 0.001, at: since };
    if (def.config && def.db) {
      const db = `${prefix}${def.db}`;
      ws.app = { id: app, folder: webroot, config: `${webroot}/${def.config}`, db };
      ws.databases[db] = { name: db, mb: +dbMb.toFixed(3) };
      ws.dbUsers[db] = { name: db, password: password(s, w.id, db), grants: { [db]: ALL_PRIVILEGES } };
    }
    const quotaMb = year < 2012 ? 250 : 1024, weights = Array.from({ length: nMail }, (_, i) => 1 + (strHash(`${w.id}${i}`) % 9));
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((wt, i) => {
      const address = `${i === 0 ? "info" : `user${i}`}@${domain}`;
      ws.mailboxes[address] = { address, password: password(s, w.id, address), quotaMb, usedMb: +Math.min(quotaMb * 0.95, mailMb * wt / total).toFixed(3) };
    });
    const hack = s.sites.hacks[v.id]?.at(-1);
    if (SHELL_DIR[app] && hack !== undefined && s.sites.defaced.includes(v.id)) {
      const path = `${webroot}/${SHELL_DIR[app]}/${shellName(s, v.id, hack)}.php`;
      ws.files[path] = { mb: 0.08, at: hack };
      ws.shells.push(path);
    }
    // WordPass sites past their first month run wp-cron from the system cron, as hosts advise.
    if (app === "wordpass" && s.hour - since >= 30 * 24) {
      ws.cron.cron1 = { id: "cron1", command: `php -q /home/${account}/${webroot}/wp-cron.php > /dev/null 2>&1`, everyHours: 1 };
    }
  }
  return ws;
}

// The derived contents with the player's changes on top.
export function webspaceOf(s: GameState, workloadId: string): Webspace | null {
  const ws = deriveWebspace(s, workloadId);
  if (!ws) return null;
  const o = s.webspaces[workloadId] ?? {};
  for (const part of PARTS) {
    const into = ws[part] as Record<string, unknown>;
    for (const [k, v] of Object.entries(o[part] ?? {})) {
      if (v === false) delete into[k];
      else into[k] = v;
    }
  }
  ws.usage = usageOf(s, ws);
  return ws;
}

function usageOf(s: GameState, ws: Webspace): WebUsage {
  const w = s.workloads.find((x) => x.id === ws.workloadId), files = Object.values(ws.files), domains = Object.values(ws.domains);
  const filesMb = files.reduce((a, f) => a + f.mb, 0), kind = (k: DomainKind) => domains.filter((d) => d.kind === k).length;
  const diskMb = filesMb + Object.values(ws.databases).reduce((a, d) => a + d.mb, 0) + Object.values(ws.mailboxes).reduce((a, m) => a + m.usedMb, 0);
  return {
    diskMb: +diskMb.toFixed(3), quotaMb: w ? w.diskGb * 1024 : Infinity,
    // ponytail: a derived folder stands for its whole subtree, so inodes are guessed at 30 per MB; count real entries once uploads extract archives.
    inodes: files.length + Math.round(filesMb * 30),
    databases: Object.keys(ws.databases).length, dbUsers: Object.keys(ws.dbUsers).length, mailboxes: Object.keys(ws.mailboxes).length,
    forwarders: Object.keys(ws.forwarders).length, ftpAccounts: Object.keys(ws.ftp).length,
    addonDomains: kind("addon"), subdomains: kind("sub"), parked: kind("parked"), cron: Object.keys(ws.cron).length,
  };
}

// web-hosting.md 2.2: an app counts as installed only while its folder, its config file and its database exist.
export type AppState = "none" | "installed" | "broken";
export function appState(ws: Webspace): AppState {
  if (!ws.app) return "none";
  const { folder, config, db } = ws.app;
  return ws.files[folder]?.dir && ws.files[config] && !ws.files[config].dir && ws.databases[db] ? "installed" : "broken";
}
