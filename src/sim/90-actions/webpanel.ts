import { yearOf } from "../00-core/time";
import { PHP } from "../10-catalog/platforms";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { accountsOf, AUTOSSL_WINDOW_DAYS, autoSslOn, isCpanic, logRenewal, phpCompat, phpInstalled, phpOlder, POOL_MAX, poolOf, renewNow } from "../60-infra/webpanel";
import { hashRng, rand } from "../00-core/rng";
import { cmsOf, hasBackup, updateSite } from "../60-infra/apps";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import { FAIL2BAN_FROM, isPleskit, newHostBans, setBans } from "../60-infra/bans";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

const panelHost = (s: GameState, hostId: string) => {
  const c = s.clusters.find((x) => x.id === hostId);
  return !c ? fail("error.unknownCluster") : c.kind !== "panel" ? fail("error.notPanelHost") : c;
};

// Installs or drops the legacy PHP versions a panel host keeps besides its newest; it rebuilds, so its sites run slower for an hour.
export function setPhpPool(s: GameState, hostId: string, versions: string[]): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  const list = [...new Set(versions)];
  if (list.some((v) => !PHP.some((p) => p.version === v && p.year <= yearOf(s.hour)) || !phpOlder(v, c.php))) return fail("error.phpNotAvailable");
  if (list.length > POOL_MAX) return fail("error.phpPoolFull");
  const old = poolOf(s, hostId);
  if (list.length === old.length && list.every((v) => old.includes(v))) return { ok: true };
  const mine = new Set(accountsOf(s, hostId).map((x) => x.id));
  const phpOf = Object.fromEntries(Object.entries(s.webpanel.phpOf).filter(([id, v]) => !mine.has(id) || list.includes(v)));
  s.webpanel = { ...s.webpanel, phpPool: { ...s.webpanel.phpPool, [hostId]: list }, phpOf };
  s.clusters = s.clusters.map((x) => (x.id === hostId ? { ...x, phpUntil: s.hour + PHP_UPGRADE_HOURS } : x));
  phpCompat(s);
  return { ok: true };
}

// Moves one account to an installed PHP version.
export function setAccountPhp(s: GameState, serviceId: string, version: string): ActionResult {
  const w = s.workloads.find((x) => x.serviceId === serviceId && x.clusterId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!c || c.kind !== "panel") return fail("error.notPanelHost");
  if (!phpInstalled(s, c).includes(version)) return fail("error.phpNotInstalled");
  s.webpanel = { ...s.webpanel, phpOf: { ...s.webpanel.phpOf, [serviceId]: version } };
  phpCompat(s);
  return { ok: true };
}

// A rebuild of the host's web software: its sites run slower for an hour.
export function rebuildHost(s: GameState, hostId: string): ActionResult {
  const c = panelHost(s, hostId);
  if ("ok" in c) return c;
  s.clusters = s.clusters.map((x) => (x.id === hostId ? { ...x, phpUntil: s.hour + PHP_UPGRADE_HOURS } : x));
  return { ok: true };
}

const CHECK_MINUTES = 5;
const busy = (s: GameState) => { s.playerBusyUntil = Math.max(s.playerBusyUntil, s.hour * 60) + CHECK_MINUTES; };

// AutoSSL is a cPanic feature; the other panels renew by hand.
export function setAutoSsl(s: GameState, hostId: string, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || !isCpanic(c)) return fail("error.notCpanic");
  const auto = s.webpanel.ssl.auto.filter((id) => id !== hostId);
  s.webpanel = { ...s.webpanel, ssl: { ...s.webpanel.ssl, auto: on ? [...auto, hostId] : auto } };
  return { ok: true };
}

// The player gives one domain a fresh certificate; any panel offers it.
export function renewCertificate(s: GameState, serviceId: string): ActionResult {
  const host = s.workloads.find((w) => w.serviceId === serviceId)?.clusterId, c = s.clusters.find((x) => x.id === host);
  if (!c || c.kind !== "panel" || s.webpanel.ssl.expires[serviceId] === undefined) return fail("error.unknownService");
  busy(s);
  renewNow(s, serviceId);
  return { ok: true };
}

// The WHM button: every certificate due within 30 days, or already expired, is renewed now.
export function runAutoSslCheck(s: GameState, hostId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || !isCpanic(c)) return fail("error.notCpanic");
  if (!autoSslOn(s, hostId)) return fail("error.autoSslOff");
  busy(s);
  const x = s.webpanel.ssl;
  for (const v of accountsOf(s, hostId)) {
    if (x.expires[v.id] !== undefined && x.expires[v.id] - s.hour <= AUTOSSL_WINDOW_DAYS * 24) { logRenewal(s, v.id, true); renewNow(s, v.id); }
  }
  return { ok: true };
}

const pleskit = (s: GameState, hostId: string) => {
  const c = s.clusters.find((x) => x.id === hostId);
  return !isPleskit(c) ? fail("error.notPleskit") : yearOf(s.hour) < FAIL2BAN_FROM ? fail("error.noFail2ban") : c;
};

// The jail turns scanners away at the price of now and then locking a customer out.
export function setJail(s: GameState, hostId: string, on: boolean): ActionResult {
  const c = pleskit(s, hostId);
  if ("ok" in c) return c;
  busy(s);
  setBans(s, hostId, { jail: on });
  return { ok: true };
}

// Lifts a ban; the customer who was locked out is happy to be back.
export function unbanIp(s: GameState, hostId: string, ip: string): ActionResult {
  const c = pleskit(s, hostId);
  if ("ok" in c) return c;
  const b = s.webpanel.bans[hostId], ban = b?.list.find((x) => x.ip === ip);
  if (!ban) return fail("error.unknownIp");
  busy(s);
  setBans(s, hostId, { list: b.list.filter((x) => x !== ban) });
  const v = ban.serviceId ? s.services.find((x) => x.id === ban.serviceId) : undefined;
  if (v && s.tickets.some((t) => t.serviceId === v.id && t.topic === "lockedOut" && !isFinal(t))) {
    s.customers = s.customers.map((x) => { if (x.id !== v.customerId) return x; const n = { ...x }; bump(n, 5); return n; });
    s.tickets = s.tickets.map((t) => (t.serviceId === v.id && t.topic === "lockedOut" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
  }
  return { ok: true };
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// A trusted address is never banned again, and a ban on it is lifted.
export function trustIp(s: GameState, hostId: string, ip: string): ActionResult {
  const c = pleskit(s, hostId);
  if ("ok" in c) return c;
  const m = IPV4.exec(ip.trim());
  if (!m || m.slice(1).some((n) => Number(n) > 255)) return fail("error.badIp");
  const b = s.webpanel.bans[hostId] ?? newHostBans(), addr = ip.trim();
  busy(s);
  setBans(s, hostId, { trusted: b.trusted.includes(addr) ? b.trusted : [...b.trusted, addr] });
  return b.list.some((x) => x.ip === addr) ? unbanIp(s, hostId, addr) : { ok: true };
}

export function untrustIp(s: GameState, hostId: string, ip: string): ActionResult {
  const c = pleskit(s, hostId);
  if ("ok" in c) return c;
  busy(s);
  setBans(s, hostId, { trusted: (s.webpanel.bans[hostId]?.trusted ?? []).filter((x) => x !== ip) });
  return { ok: true };
}

export const TOOLKIT_MINUTES = 10;
export const TOOLKIT_SITES_PER_MINUTE = 5;
export const BREAK_BASE = 0.03;
export const BREAK_PER_YEAR = 0.02;
export const BREAK_MAX = 0.11;
export const BREAK_HOURS = 24;
export const BREAK_TICKET = 0.7;
export const ROLLBACK_MINUTES = 30;
const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// The chance an update breaks a site: 3% plus 2% for each release year it was behind, halved for managed updates.
export function breakChance(behind: number, managed: boolean): number {
  return Math.min(BREAK_MAX, BREAK_BASE + BREAK_PER_YEAR * behind) / (managed ? 2 : 1);
}

// The Toolkit updates the picked sites to this year's release in one go; each may break.
export function massUpdateSites(s: GameState, hostId: string, serviceIds: string[]): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!isPleskit(c)) return fail("error.notPleskit");
  const mine = new Set(accountsOf(s, hostId).filter((v) => cmsOf(v)).map((v) => v.id)), year = yearOf(s.hour);
  const sites = [...new Set(serviceIds)].map((id) => s.services.find((v) => v.id === id)).filter((v) => !!v && mine.has(v.id) && (v.spec.appVersion ?? 0) < year);
  if (!sites.length) return fail("error.nothingToUpdate");
  s.playerBusyUntil = Math.max(s.playerBusyUntil, s.hour * 60) + TOOLKIT_MINUTES + Math.ceil(sites.length / TOOLKIT_SITES_PER_MINUTE);
  for (const v of sites) {
    if (!v) continue;
    const was = { appVersion: v.spec.appVersion ?? 0, appUpdatedAt: v.spec.appUpdatedAt ?? 0 };
    updateSite(s, v.id);
    const r = hashRng(s.seed, idNum(v.id), s.hour, 311);
    if (rand(r) >= breakChance(year - was.appVersion, !!v.spec.managedUpdates)) continue;
    s.webpanel = { ...s.webpanel, appBack: { ...s.webpanel.appBack, [v.id]: was }, appBroken: { ...s.webpanel.appBroken, [v.id]: s.hour + BREAK_HOURS } };
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, slowedAt: s.hour } : x));
    const cust = s.customers.find((x) => x.id === v.customerId);
    if (cust && rand(r) < BREAK_TICKET && !s.tickets.some((t) => t.serviceId === v.id && t.topic === "updateBroke" && !isFinal(t))) createTicket(s, cust, "howTo", v.id, "updateBroke");
  }
  return { ok: true };
}

// Repairs a site an update broke: a backup brings back the old release (and its open vulnerabilities), otherwise the player fixes it by hand.
export function rollbackSite(s: GameState, serviceId: string): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || s.webpanel.appBroken[serviceId] === undefined) return fail("error.notBroken");
  const back = hasBackup(s, serviceId), was = s.webpanel.appBack[serviceId];
  s.playerBusyUntil = Math.max(s.playerBusyUntil, s.hour * 60) + ROLLBACK_MINUTES;
  if (back && was) s.services = s.services.map((x) => (x.id === serviceId ? { ...x, spec: { ...x.spec, ...was } } : x));
  const { [serviceId]: _a, ...appBroken } = s.webpanel.appBroken, { [serviceId]: _b, ...appBack } = s.webpanel.appBack;
  s.webpanel = { ...s.webpanel, appBroken, appBack };
  s.customers = s.customers.map((x) => { if (x.id !== v.customerId) return x; const n = { ...x }; bump(n, back ? 5 : -10); return n; });
  s.tickets = s.tickets.map((t) => (t.serviceId === serviceId && t.topic === "updateBroke" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
  return { ok: true };
}
