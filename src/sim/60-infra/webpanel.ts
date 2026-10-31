// economy.md, PHP versions: the state of the web panels' own screens lives in one object so a save and a new game each need a
// single line. Entries are created on first use, so an empty object behaves like a fresh game.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { certificateOf } from "../30-customers/certificates";
import { PHP, phpAt } from "../10-catalog/platforms";
import { bump, createTicket, isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { cmsOf } from "./apps";
import type { Cluster } from "./cluster";
import type { HostBans } from "./bans";

export interface WebPanel {
  phpPool: Record<string, string[]>; // panel host id -> legacy PHP versions kept installed besides Cluster.php
  phpOf: Record<string, string>; // web hosting service id -> the PHP version it runs; missing means the host's newest
  phpBroken: Record<string, string>; // web hosting service id -> the version it broke on
  ssl: Ssl;
  bans: Record<string, HostBans>; // Pleskit host id -> its Fail2ban jail
  appBack: Record<string, { appVersion: number; appUpdatedAt: number }>; // site id -> the release before a Toolkit update
  appBroken: Record<string, number>; // site id -> the hour the site a Toolkit update broke runs normally again
}

// economy.md, SSL certificates and AutoSSL: auto lists the cPanic hosts with AutoSSL on, expires the hour each domain's
// certificate runs out, expired the services serving an expired one now, and log the last renewals.
export interface SslLog { hour: number; serviceId: string; ok: boolean }
export interface Ssl { auto: string[]; expires: Record<string, number>; expired: string[]; log: SslLog[] }
export const newSsl = (): Ssl => ({ auto: [], expires: {}, expired: [], log: [] });

export const newWebPanel = (): WebPanel => ({ phpPool: {}, phpOf: {}, phpBroken: {}, ssl: newSsl(), bans: {}, appBack: {}, appBroken: {} });

// A save keeps what it has per sub-record, so a save from an earlier milestone still gets the later sub-fields.
export const mergeWebPanel = (base: WebPanel, data: Partial<WebPanel> | undefined): WebPanel => ({
  phpPool: { ...base.phpPool, ...data?.phpPool }, phpOf: { ...base.phpOf, ...data?.phpOf }, phpBroken: { ...base.phpBroken, ...data?.phpBroken },
  ssl: { ...base.ssl, ...data?.ssl }, bans: { ...base.bans, ...data?.bans },
  appBack: { ...base.appBack, ...data?.appBack }, appBroken: { ...base.appBroken, ...data?.appBroken },
});

export const POOL_MAX = 2;
// A broken site writes in with this chance, drawn per site and version.
export const PHP_BROKEN_TICKET = 0.35;
// How many release years of PHP a CMS release keeps running on.
export const PHP_COMPAT_YEARS = 2;

const phpIndex = (version: string): number => PHP.findIndex((p) => p.version === version);
export const phpOlder = (a: string, b: string): boolean => phpIndex(a) < phpIndex(b);

export const poolOf = (s: GameState, hostId: string): string[] => s.webpanel.phpPool[hostId] ?? [];
// The versions installed on a panel host, newest first.
export const phpInstalled = (s: GameState, c: Cluster): string[] => [c.php, ...poolOf(s, c.id).filter((v) => v !== c.php)];

// The PHP version an account runs: its own pick while that is still installed, else the host's newest.
export function phpRunning(s: GameState, c: Cluster, serviceId: string): string {
  const own = s.webpanel.phpOf[serviceId];
  return own && phpInstalled(s, c).includes(own) ? own : c.php;
}

// The newest PHP a CMS release runs on; static sites run on anything.
export function phpLimit(appVersion: number): string {
  return phpAt(appVersion + PHP_COMPAT_YEARS);
}

export const phpFits = (appVersion: number, version: string): boolean => phpIndex(version) <= phpIndex(phpLimit(appVersion));

// The web hosting services that live on a panel host.
export function accountsOf(s: GameState, hostId: string) {
  const ids = new Set(s.workloads.filter((w) => w.clusterId === hostId && w.serviceId).map((w) => w.serviceId));
  return s.services.filter((v) => v.product === "webHosting" && v.endedAt === null && ids.has(v.id));
}

// The oldest PHP version a panel host still runs an account on.
export function phpOldestInUse(s: GameState, c: Cluster): string {
  const used = accountsOf(s, c.id).map((v) => phpRunning(s, c, v.id));
  return [c.php, ...used].reduce((a, v) => (phpOlder(v, a) ? v : a), c.php);
}

// Whether a site's app runs on the PHP it is set to.
export function siteBroken(s: GameState, c: Cluster, serviceId: string): boolean {
  const v = s.services.find((x) => x.id === serviceId);
  return !!v && !!cmsOf(v) && !phpFits(v.spec.appVersion ?? 0, phpRunning(s, c, serviceId));
}

// A host's previous version stays installed; accounts whose app does not run on the new newest move onto it.
export function keepPhp(s: GameState, hostId: string, version: string): void {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || version === c.php || poolOf(s, hostId).length >= POOL_MAX) return;
  const phpPool = { ...s.webpanel.phpPool, [hostId]: [...poolOf(s, hostId), version] }, phpOf = { ...s.webpanel.phpOf };
  for (const v of accountsOf(s, hostId)) {
    if (cmsOf(v) && !phpFits(v.spec.appVersion ?? 0, c.php) && phpFits(v.spec.appVersion ?? 0, version) && phpRunning(s, c, v.id) === c.php) phpOf[v.id] = version;
  }
  s.webpanel = { ...s.webpanel, phpPool, phpOf };
}

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// Daily: sites whose app does not run on their PHP are slowed and some write in; fixed sites withdraw the ticket.
export function phpCompat(s: GameState): void {
  for (const c of s.clusters) {
    if (c.kind !== "panel") continue;
    for (const v of accountsOf(s, c.id)) {
      const version = phpRunning(s, c, v.id), seen = s.webpanel.phpBroken[v.id];
      if (siteBroken(s, c, v.id)) {
        s.services = s.services.map((x) => (x.id === v.id ? { ...x, slowedAt: s.hour } : x));
        if (seen === version) continue;
        s.webpanel = { ...s.webpanel, phpBroken: { ...s.webpanel.phpBroken, [v.id]: version } };
        const cust = s.customers.find((x) => x.id === v.customerId);
        if (cust && rand(hashRng(s.seed, idNum(v.id), phpIndex(version), 310)) < PHP_BROKEN_TICKET && !s.tickets.some((t) => t.serviceId === v.id && t.topic === "phpBroken" && !isFinal(t))) {
          createTicket(s, cust, "howTo", v.id, "phpBroken");
        }
      } else if (seen) {
        const { [v.id]: _, ...rest } = s.webpanel.phpBroken;
        s.webpanel = { ...s.webpanel, phpBroken: rest };
        s.tickets = s.tickets.map((t) => (t.serviceId === v.id && t.topic === "phpBroken" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
      }
    }
  }
}

export const CERT_DAYS = 90;
export const AUTOSSL_FROM = 2016;
export const AUTOSSL_WINDOW_DAYS = 30;
export const AUTOSSL_FAIL = 0.03;
export const CERT_ANGER = 12;
export const CERT_TICKET = 0.6;
// Chance a customer without AutoSSL renews by hand before the certificate expires, by skill.
export const MANUAL_RENEW = { high: 0.6, medium: 0.3, low: 0.05 } as const;
const SSL_LOG_CAP = 100;

export const isCpanic = (c: Cluster | undefined): c is Cluster => !!c && c.kind === "panel" && c.panel === "cpanic";
export const autoSslOn = (s: GameState, hostId: string): boolean => s.webpanel.ssl.auto.includes(hostId);
// A domain's certificate state: valid, renewing (inside the AutoSSL window with AutoSSL on) or expired.
export function sslStatus(s: GameState, serviceId: string): "valid" | "renewing" | "expired" {
  const x = s.webpanel.ssl;
  if (x.expired.includes(serviceId)) return "expired";
  const host = s.workloads.find((w) => w.serviceId === serviceId)?.clusterId;
  return host && autoSslOn(s, host) && x.expires[serviceId] !== undefined && x.expires[serviceId] - s.hour <= AUTOSSL_WINDOW_DAYS * 24 ? "renewing" : "valid";
}

function setSsl(s: GameState, patch: Partial<Ssl>): void {
  s.webpanel = { ...s.webpanel, ssl: { ...s.webpanel.ssl, ...patch } };
}

export function logRenewal(s: GameState, serviceId: string, ok: boolean): void {
  setSsl(s, { log: [...s.webpanel.ssl.log, { hour: s.hour, serviceId, ok }].slice(-SSL_LOG_CAP) });
}

// Gives a domain a fresh certificate and ends the incident of an expired one.
export function renewNow(s: GameState, serviceId: string): void {
  const x = s.webpanel.ssl, was = x.expired.includes(serviceId);
  setSsl(s, { expires: { ...x.expires, [serviceId]: s.hour + CERT_DAYS * 24 }, expired: x.expired.filter((id) => id !== serviceId) });
  if (!was) return;
  const v = s.services.find((y) => y.id === serviceId);
  if (v && s.tickets.some((t) => t.serviceId === serviceId && t.topic === "certExpired" && !isFinal(t))) {
    s.customers = s.customers.map((c) => { if (c.id !== v.customerId) return c; const n = { ...c }; bump(n, 5); return n; });
  }
  s.tickets = s.tickets.map((t) => (t.serviceId === serviceId && t.topic === "certExpired" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
}

function expire(s: GameState, v: { id: string; customerId: string }): void {
  setSsl(s, { expired: [...s.webpanel.ssl.expired, v.id] });
  s.customers = s.customers.map((c) => { if (c.id !== v.customerId) return c; const n = { ...c }; bump(n, -CERT_ANGER); return n; });
  const cust = s.customers.find((c) => c.id === v.customerId);
  if (cust && rand(hashRng(s.seed, idNum(v.id), s.hour, 312)) < CERT_TICKET) createTicket(s, cust, "howTo", v.id, "certExpired");
}

// Daily from 2016: each domain's certificate lives 90 days; AutoSSL renews in the last 30, otherwise the customer may, and
// an expired one slows the site until the player renews it.
export function sslTick(s: GameState): void {
  if (yearOf(s.hour) < AUTOSSL_FROM) return;
  const live = new Set<string>();
  for (const c of s.clusters) {
    if (c.kind !== "panel") continue;
    for (const v of accountsOf(s, c.id)) {
      if (certificateOf(s, v.domain ?? v.label)) continue;
      live.add(v.id);
      const x = s.webpanel.ssl, exp = x.expires[v.id];
      if (exp === undefined) { setSsl(s, { expires: { ...x.expires, [v.id]: s.hour + Math.floor(rand(hashRng(s.seed, idNum(v.id), 311)) * CERT_DAYS * 24) } }); continue; }
      const left = exp - s.hour, r = hashRng(s.seed, idNum(v.id), s.hour, 313);
      if (autoSslOn(s, c.id) && left <= AUTOSSL_WINDOW_DAYS * 24) {
        const ok = rand(r) >= AUTOSSL_FAIL;
        logRenewal(s, v.id, ok);
        if (ok) renewNow(s, v.id);
      } else if (!x.expired.includes(v.id) && left <= 0) expire(s, v);
      else if (!x.expired.includes(v.id) && left <= 24) {
        const cust = s.customers.find((y) => y.id === v.customerId);
        if (cust && rand(r) < MANUAL_RENEW[profileStats(cust.profile).skill]) renewNow(s, v.id);
      }
      if (s.webpanel.ssl.expired.includes(v.id)) s.services = s.services.map((y) => (y.id === v.id ? { ...y, slowedAt: s.hour } : y));
    }
  }
  const x = s.webpanel.ssl, keep = (id: string) => live.has(id);
  if (Object.keys(x.expires).some((id) => !keep(id)) || x.expired.some((id) => !keep(id))) {
    setSsl(s, { expires: Object.fromEntries(Object.entries(x.expires).filter(([id]) => keep(id))), expired: x.expired.filter(keep) });
  }
}

// Daily: a site a Toolkit update broke runs slowed until its hour; ended sites drop out.
function updateBrokenTick(s: GameState): void {
  const live = new Set(s.services.filter((v) => v.endedAt === null).map((v) => v.id));
  const entries = Object.entries(s.webpanel.appBroken), slow = new Set(entries.filter(([id, until]) => live.has(id) && until > s.hour).map(([id]) => id));
  if (slow.size !== entries.length) s.webpanel = { ...s.webpanel, appBroken: Object.fromEntries(entries.filter(([id]) => slow.has(id))) };
  if (slow.size) s.services = s.services.map((v) => (slow.has(v.id) ? { ...v, slowedAt: s.hour } : v));
}

export function webpanelTick(s: GameState): SimEvent[] {
  if (s.hour % 24 !== 0) return [];
  const hosts = new Set(s.clusters.filter((c) => c.kind === "panel").map((c) => c.id));
  const stale = Object.keys(s.webpanel.phpPool).filter((id) => !hosts.has(id));
  if (stale.length) s.webpanel = { ...s.webpanel, phpPool: Object.fromEntries(Object.entries(s.webpanel.phpPool).filter(([id]) => hosts.has(id))) };
  phpCompat(s);
  sslTick(s);
  updateBrokenTick(s);
  return [];
}
