// docs/design/web-hosting.md, The web space: a customer's contents are derived from the workload each time they are read,
// and only the player's changes are stored, as an overlay per workload.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { App } from "../10-catalog/apps";
import { packageNamed, type PackageDef } from "../80-business/packages";
import { accountUse } from "../80-business/readouts";
import type { GameState } from "../50-state";
import type { Cluster, Workload } from "./cluster";

// Paths are relative to the account's home, such as "public_html/wp-config.php". Sizes are MB, at is the hour last modified.
export interface WebFile { dir?: true; mb: number; at: number }
export type DomainKind = "main" | "addon" | "sub" | "parked";
export interface WebDomain { name: string; kind: DomainKind; folder: string; php: string }
export interface WebDatabase { name: string; mb: number }
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
}
export type PartName = keyof WebParts;
export const PARTS: PartName[] = ["files", "domains", "databases", "dbUsers", "mailboxes", "forwarders", "ftp", "cron"];
// What the player changed: a value adds or replaces an entry, false removes a derived one.
export type WebspaceOverlay = { [K in PartName]?: Record<string, WebParts[K][string] | false> };

export interface Webspace extends WebParts {
  workloadId: string; panel: string; account: string; prefix: string; webroot: string; domain: string;
  app: WebApp | null; limits: WebLimits; usage: WebUsage;
}

// Defaults for packages saved before these counts and for accounts sold without a package.
export const WEB_LIMITS: Omit<WebLimits, "mailboxes"> = { databases: 5, ftpAccounts: 5, addonDomains: 1, subdomains: 10 };
export const ALL_PRIVILEGES = ["ALL PRIVILEGES"];
// cPanel's MultiPHP Manager; before it every domain runs the host's PHP.
export const MULTI_PHP_YEAR = 2015;
const MAIL_SHARE = 0.1, DB_SHARE = 0.2;

// The files an app ships with, in share of the disk the files use; the config file is the one the app reads its database from.
const APP_FILES: Record<App, { files: [string, number][]; config?: string; db?: string }> = {
  wordpass: { files: [["wp-admin", 30], ["wp-content", 55], ["wp-includes", 12], ["index.php", 1], ["wp-config.php", 1], [".htaccess", 1]], config: "wp-config.php", db: "wp" },
  joomlah: { files: [["administrator", 25], ["components", 30], ["media", 35], ["templates", 8], ["index.php", 1], ["configuration.php", 1]], config: "configuration.php", db: "joom" },
  drupel: { files: [["core", 40], ["modules", 20], ["sites", 34], ["sites/default", 1], ["themes", 3], ["index.php", 1], ["sites/default/settings.php", 1]], config: "sites/default/settings.php", db: "drup" },
  static: { files: [["images", 80], ["css", 5], ["index.html", 5], ["about.html", 5], ["contact.html", 5]] },
};

const strHash = (text: string): number => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
const password = (s: GameState, ...parts: string[]): string => {
  const r = hashRng(s.seed, ...parts.map(strHash));
  return Array.from({ length: 12 }, () => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand(r) * 57)]).join("");
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

function panelOf(s: GameState, workloadId: string): { w: Workload; c: Cluster } | null {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  return w && c?.kind === "panel" && c.panel ? { w, c } : null;
}

// The contents a customer web space has without any change by the player.
export function deriveWebspace(s: GameState, workloadId: string): Webspace | null {
  const at = panelOf(s, workloadId);
  if (!at) return null;
  const { w, c } = at, v = s.services.find((x) => x.id === w.serviceId);
  const domain = v?.domain ?? v?.label ?? w.hostname ?? w.id;
  const account = v?.username ?? (domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^[0-9]+/, "") || "user").slice(0, 8);
  const panel = c.panel!, webroot = webrootOf(panel), prefix = prefixOf(account), since = v?.startedAt ?? w.placedAt, year = yearOf(s.hour);
  const ws: Webspace = {
    workloadId, panel, account, prefix, webroot, domain, app: null, files: {}, domains: {}, databases: {}, dbUsers: {}, mailboxes: {}, forwarders: {}, ftp: {}, cron: {},
    limits: limitsOf(v?.pkg ? packageNamed(c, v.pkg) : undefined, v?.spec.mailboxes ?? 0), usage: undefined!,
  };
  for (const p of [webroot, "logs", "tmp", "mail"]) ws.files[p] = { dir: true, mb: 0, at: since };
  ws.domains[domain] = { name: domain, kind: "main", folder: webroot, php: c.php };
  // The player's own web spaces have no customer service and start empty.
  if (v) {
    const app = v.spec.app ?? "static", def = APP_FILES[app], usedMb = accountUse(s, w).disk[0] * 1024;
    const nMail = Math.min(v.spec.mailboxes, 8), mailMb = nMail ? usedMb * MAIL_SHARE : 0, dbMb = def.db ? usedMb * DB_SHARE : 0, filesMb = usedMb - mailMb - dbMb;
    for (const [n, share] of def.files) ws.files[`${webroot}/${n}`] = { ...(n.includes(".") ? {} : { dir: true as const }), mb: +(filesMb * share / 100).toFixed(3), at: since };
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
  const w = s.workloads.find((x) => x.id === ws.workloadId)!, files = Object.values(ws.files), domains = Object.values(ws.domains);
  const filesMb = files.reduce((a, f) => a + f.mb, 0), kind = (k: DomainKind) => domains.filter((d) => d.kind === k).length;
  const diskMb = filesMb + Object.values(ws.databases).reduce((a, d) => a + d.mb, 0) + Object.values(ws.mailboxes).reduce((a, m) => a + m.usedMb, 0);
  return {
    diskMb: +diskMb.toFixed(3), quotaMb: w.diskGb * 1024,
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
