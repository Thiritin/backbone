import { yearOf } from "../00-core/time";
import { PHP } from "../10-catalog/platforms";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { accountsOf, AUTOSSL_WINDOW_DAYS, autoSslOn, isCpanic, logRenewal, phpCompat, phpInstalled, phpOlder, POOL_MAX, poolOf, renewNow } from "../60-infra/webpanel";
import { bump, isFinal } from "../40-support/tickets";
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
