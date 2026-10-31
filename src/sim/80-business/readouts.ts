// docs/design/plans/readouts.md: read-only screens derived from the state the sim already holds.
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Cluster, Workload } from "../60-infra/cluster";
import { serviceMbps } from "../60-infra/network";
import { diskFill, workloadLoad, workloadUse } from "../60-infra/usage";
import { ascii, companyDomain } from "../30-customers/domains";
import { controlPlaneUp, liveBetween, workloadOnline } from "../60-infra/cluster";
import { hashRng, rand } from "../00-core/rng";
import { familyOf, openVulns } from "../60-infra/vulns";
import { autoUpdates } from "../10-catalog/platforms";
import { yearOf } from "../00-core/time";
import { phpDue } from "../90-actions/clusters";
import { updateDue } from "../90-actions/software";

export const TASK_WINDOW_HOURS = 336;
export const TASK_MAX = 12;

export type TaskStatus = "running" | "done" | "error";
export interface PanelTask { key: string; start: number | null; finish: number; text: string; params: Record<string, string>; status: TaskStatus }

// The tasks of a panel host. The sim keeps no history, so finished work shows only as far as the stored hours reach.
export function panelTasks(s: GameState, c: Cluster, now: number = s.hour): PanelTask[] {
  const recent = (h: number | null | undefined): h is number => h != null && h <= now && now - h <= TASK_WINDOW_HOURS;
  const out: PanelTask[] = [];
  const add = (key: string, text: string, status: TaskStatus, finish: number, start: number | null = null, params: Record<string, string> = {}) =>
    out.push({ key, start, finish, text, params, status });
  if (c.switching) add(`sw-${c.id}`, "install", "running", c.switching.doneAt, c.switching.doneAt - softwareById(c.switching.to).installHours, { software: softwareById(c.switching.to).name, name: c.name });
  else if (recent(c.updatedAt)) add(`up-${c.id}`, "update", "done", c.updatedAt, c.updatedAt, { software: c.panel ? softwareById(c.panel).name : c.name });
  if (c.phpUntil > now) add(`php-${c.id}`, "php", "running", c.phpUntil);
  for (const w of s.workloads.filter((x) => x.clusterId === c.id)) {
    const name = w.hostname ?? w.id;
    if (w.migrating && w.migrating.doneAt > now) add(`mv-${w.id}`, "move", "running", w.migrating.doneAt, null, { name });
    else if (w.cloning && w.cloning > now) add(`cl-${w.id}`, "clone", "running", w.cloning, null, { name });
    else if (w.recoverDoneAt && w.recoverDoneAt > now) add(`rc-${w.id}`, "recover", "running", w.recoverDoneAt, null, { name });
    else if (w.busyUntil > now) add(`rs-${w.id}`, s.lossReports.some((r) => r.items.some((i) => i.workloadId === w.id && i.restored)) ? "restore" : "move", "running", w.busyUntil, null, { name });
    if (recent(w.placedAt)) add(`pl-${w.id}`, "created", "done", w.placedAt, w.placedAt, { name });
    if (recent(w.backupAt)) add(`bk-${w.id}`, "backup", "done", w.backupAt, w.backupAt, { name });
  }
  const nodes = new Set(c.nodes.map((n) => n.deviceId));
  for (const r of s.lossReports) if (nodes.has(r.deviceId) && recent(r.hour)) {
    const d = s.devices.find((x) => x.id === r.deviceId);
    add(`ls-${r.id}`, "lostDisks", "error", r.hour, r.hour, { name: d ? d.hostname ?? d.label ?? d.name : "" });
  }
  return out.sort((a, b) => b.finish - a.finish).slice(0, TASK_MAX);
}

export const LEVEL_WARN = 0.8, LEVEL_BAD = 0.95;
export const TRAFFIC_SAMPLE_HOURS = 6, TRAFFIC_WINDOW_HOURS = 730;
export type Level = "ok" | "warn" | "bad";
export const levelOf = (used: number, of: number): Level => { const f = of > 0 ? used / of : 0; return f >= LEVEL_BAD ? "bad" : f >= LEVEL_WARN ? "warn" : "ok"; };

export interface AccountUse { disk: [number, number]; traffic: [number, number]; mailboxes: number; level: Level }

// GB moved by the account's service over the last month, summed from sampled Mbit/s.
export function trafficUsedGb(s: GameState, w: Workload, now: number = s.hour): number {
  const v = s.services.find((x) => x.id === w.serviceId);
  if (!v) return 0;
  const end = v.endedAt ?? now;
  let mbps = 0;
  for (let h = Math.max(v.startedAt, now - TRAFFIC_WINDOW_HOURS); h <= Math.min(now, end); h += TRAFFIC_SAMPLE_HOURS) mbps += serviceMbps(s, v, h);
  return (mbps * TRAFFIC_SAMPLE_HOURS * 3600) / 8000;
}

export function accountUse(s: GameState, w: Workload): AccountUse {
  const v = s.services.find((x) => x.id === w.serviceId), u = workloadUse(s, w);
  const disk: [number, number] = [u.diskGb, w.diskGb], traffic: [number, number] = [trafficUsedGb(s, w), v?.spec.trafficGb ?? 0];
  const worst = Math.max(disk[1] > 0 ? disk[0] / disk[1] : 0, traffic[1] > 0 ? traffic[0] / traffic[1] : 0);
  return { disk, traffic, mailboxes: v?.spec.mailboxes ?? 0, level: levelOf(worst, 1) };
}

export type LogSource = "access" | "error" | "auth" | "mail" | "system";
export const LOG_SOURCES: LogSource[] = ["access", "error", "auth", "mail", "system"];
export interface LogLine { hour: number; key: string; params: Record<string, string | number> }
export const LOG_WINDOW_HOURS = 168, LOG_BASE_HOURS = 24;

const ip = (n: number) => `${1 + (n % 223)}.${(n >> 8) % 256}.${(n >> 16) % 256}.${(n >> 4) % 254 + 1}`;
const PATHS = ["/", "/index.html", "/style.css", "/about", "/img/logo.png", "/contact"];

// The lines of one log of a panel host, newest first. Event lines come from the state at the hour of the event and stay
// while it is in the window; baseline lines are drawn from the seed so the same save always reads the same.
export function logLines(s: GameState, c: Cluster, source: LogSource, limit: number, now: number = s.hour): LogLine[] {
  const out: LogLine[] = [], from = now - LOG_WINDOW_HOURS, inside = (h: number) => h >= from && h <= now;
  const add = (hour: number, key: string, params: Record<string, string | number> = {}) => { if (inside(hour)) out.push({ hour, key, params }); };
  const ws = s.workloads.filter((w) => w.clusterId === c.id), nodes = new Set(c.nodes.map((n) => n.deviceId));
  const devices = s.devices.filter((d) => nodes.has(d.id)), dname = (d: (typeof devices)[number]) => d.hostname ?? d.label ?? d.name;
  const domain = (id: string | null) => s.services.find((v) => v.id === id)?.domain ?? c.name;
  const seed = Number(c.id.replace(/\D/g, "")) || 0;
  const base = (tag: number, f: (h: number, r: ReturnType<typeof hashRng>) => void) => { for (let h = Math.max(from, now - LOG_BASE_HOURS); h <= now; h++) f(h, hashRng(s.seed, seed, h, tag)); };
  const tickets = s.tickets.filter((t) => t.notice && ws.some((w) => w.serviceId === t.serviceId));
  if (source === "access") {
    for (const w of ws) base(idNumber(w.id) + 1, (h, r) => {
      const n = Math.round(workloadLoad(s, w, h) * 3);
      for (let i = 0; i < n; i++) add(h, "access", { ip: ip(Math.floor(rand(r) * 1e9)), path: PATHS[Math.floor(rand(r) * PATHS.length)], status: 200, size: 200 + Math.floor(rand(r) * 9000), domain: domain(w.serviceId) });
    });
    for (const t of tickets) add(t.createdAt - 1, "access", { ip: ip(t.createdAt * 7919), path: new URL(t.notice!.url).pathname, status: 200, size: 4096, domain: domain(t.serviceId) });
    for (const w of ws) { const until = s.ops.takedowns[w.serviceId ?? ""] ?? 0; if (until) for (let h = Math.max(from, until - 24); h <= Math.min(now, until); h++) add(h, "access", { ip: ip(h * 31), path: "/", status: 503, size: 0, domain: domain(w.serviceId) }); }
  } else if (source === "error") {
    for (const i of s.ops.incidents) for (const d of devices) if (i.devices.includes(d.id)) { add(i.hour, "error.power", { name: dname(d) }); add(i.hour + Math.ceil(i.minutes / 60), "error.restart", { name: dname(d) }); }
    for (const r of s.lossReports) if (nodes.has(r.deviceId)) add(r.hour, "error.disks", { name: dname(devices.find((d) => d.id === r.deviceId)!) });
    for (const w of ws) if (w.serviceId) { const at = s.services.find((v) => v.id === w.serviceId)?.slowedAt; if (at !== undefined) add(at, "error.busy", { domain: domain(w.serviceId) }); }
    for (const v of openVulns(s, c.id, now)) add(Math.max(v.disclosedAt, from), "error.vuln", { id: v.id, family: v.family });
  } else if (source === "auth") {
    base(2, (h, r) => { if (rand(r) < 0.35) add(h, "auth.fail", { ip: ip(Math.floor(rand(r) * 1e9)), user: ["root", "admin", "test", "ubuntu"][Math.floor(rand(r) * 4)] }); });
    const breaches = s.breaches.filter((b) => b.hostId === c.id);
    for (const b of breaches) add(b.hour, "auth.ok", { ip: ip(b.hour * 104729) });
    if (s.security.hacked.includes(c.id) && breaches.length) for (let h = Math.max(from, breaches[breaches.length - 1].hour + 12); h <= now; h += 12) add(h, "auth.ok", { ip: ip(h * 104729) });
  } else if (source === "mail") {
    for (const t of tickets.filter((x) => x.topic === "spam")) for (let k = 1; k <= 6; k++) add(t.createdAt - k, "mail.sent", { domain: domain(t.serviceId), count: 120 + ((t.createdAt * k) % 400) });
  } else {
    for (const d of devices) for (const e of d.log) add(e.hour, "system.device", { name: dname(d), event: e.key });
    if (c.updatedAt) add(c.updatedAt, "system.update", { name: c.name });
  }
  return out.sort((a, b) => b.hour - a.hour).slice(0, limit);
}
const idNumber = (id: string) => Number(id.replace(/\D/g, "")) || 0;

export type AdvisorKind = "vulnCritical" | "vulnHigh" | "vulnLow" | "update" | "php" | "backup" | "auto" | "offline";
export interface AdvisorCheck { kind: AdvisorKind; penalty: number; count: number }
export const VULN_PENALTY = { critical: 15, high: 8, low: 3 } as const, VULN_PENALTY_MAX = 40;

// The Advisor card: every finding with its penalty, and the score they leave from 100.
export function advisorChecks(s: GameState, c: Cluster): { score: number; checks: AdvisorCheck[] } {
  const checks: AdvisorCheck[] = [], open = openVulns(s, c.id), family = familyOf(c);
  let vuln = 0;
  for (const sev of ["critical", "high", "low"] as const) {
    const count = open.filter((v) => v.severity === sev).length, penalty = Math.min(VULN_PENALTY_MAX - vuln, count * VULN_PENALTY[sev]);
    vuln += penalty;
    if (count) checks.push({ kind: sev === "critical" ? "vulnCritical" : sev === "high" ? "vulnHigh" : "vulnLow", penalty, count });
  }
  if (updateDue(s, c)) checks.push({ kind: "update", penalty: 10, count: 1 });
  if (phpDue(s, c)) checks.push({ kind: "php", penalty: 10, count: 1 });
  if (c.backup.every === "off") checks.push({ kind: "backup", penalty: 15, count: 1 });
  if (family && autoUpdates(softwareById(family), yearOf(s.hour)) && !c.autoUpdate) checks.push({ kind: "auto", penalty: 5, count: 1 });
  if (s.security.offline.includes(c.id)) checks.push({ kind: "offline", penalty: 5, count: 1 });
  return { score: Math.max(0, Math.min(100, 100 - checks.reduce((n, x) => n + x.penalty, 0))), checks };
}

// Infrastructure readouts (plan 3.13 to 3.16): all derived from the seed and the hour, so a render never changes.
export const QUERIES_PER_ZONE_HOUR = 90, STORAGE_DAYS = 30, SERIES_HOURS = 24;
export type SeriesKind = "queries" | "mbit" | "storage";

// Oldest first and ending now: queries and Mbit/s hourly, storage fill in GB once a day.
export function seriesOf(s: GameState, ws: Workload[], kind: SeriesKind, points: number = kind === "storage" ? STORAGE_DAYS : SERIES_HOURS): number[] {
  const step = kind === "storage" ? 24 : 1;
  return Array.from({ length: points }, (_, i) => {
    const h = s.hour - (points - 1 - i) * step;
    return ws.reduce((n, w) => {
      const v = s.services.find((x) => x.id === w.serviceId);
      if (kind === "storage") return n + diskFill(s, w, h) * w.diskGb;
      if (!v || !workloadOnline(s, w)) return n;
      if (kind === "mbit") return n + serviceMbps(s, v, h);
      return n + (v.spec.zones ?? 0) * QUERIES_PER_ZONE_HOUR * workloadLoad(s, w, h) * Math.pow(1.2, h / 8760);
    }, 0);
  });
}

export type MailCheck = "pass" | "missing" | "unchecked";
export const DKIM_FROM = 2007, DMARC_FROM = 2012;

// Pass when the company runs a working name server and mail server for the domain; Missing without a name server; Not checked when the zone is hosted elsewhere.
export function mailChecks(s: GameState, domain: string): { spf: MailCheck; dkim: MailCheck; dmarc: MailCheck } {
  const dns = s.clusters.filter((c) => c.kind === "dns"), mailUp = s.clusters.some((c) => c.kind === "mail" && controlPlaneUp(s, c));
  const base: MailCheck = domain !== companyDomain(s) ? "unchecked" : !dns.length ? "missing" : !mailUp || !dns.some((c) => controlPlaneUp(s, c)) ? "unchecked" : "pass";
  const year = yearOf(s.hour), era = (from: number): MailCheck => (base === "pass" && year < from ? "missing" : base);
  return { spf: base, dkim: era(DKIM_FROM), dmarc: era(DMARC_FROM) };
}

export interface VpnSession { workloadId: string; user: string; realIp: string; vpnIp: string; since: number; rxMb: number; txMb: number }

// Per tenant: users x min(1, load x 1.2) sessions, each with a seeded address and a connected-since hour; nothing while the workload is down.
export function vpnSessions(s: GameState, c: Cluster, hour: number = s.hour): VpnSession[] {
  return s.workloads.filter((w) => w.clusterId === c.id).flatMap((w) => {
    const v = s.services.find((x) => x.id === w.serviceId), cu = v && s.customers.find((x) => x.id === v.customerId);
    if (!v || !cu || !workloadOnline(s, w)) return [];
    const n = Math.round((v.spec.users ?? 0) * Math.min(1, workloadLoad(s, w, hour) * 1.2)), mbit = serviceMbps(s, v, hour) / Math.max(1, n);
    const stem = ascii(cu.name.split(" ")[0]).toLowerCase() || "user";
    return Array.from({ length: n }, (_, i) => {
      const r = hashRng(s.seed, idNumber(w.id), i + 1), hours = 1 + Math.floor(rand(r) * 23), a = Math.floor(rand(r) * 1e9);
      return { workloadId: w.id, user: `${stem}${i + 1}`, realIp: `${1 + (a % 222)}.${(a >> 8) % 256}.${(a >> 16) % 256}.${1 + (a >> 4) % 254}`, vpnIp: `10.8.${idNumber(w.id) % 256}.${i + 2}`, since: hour - hours, rxMb: Math.round(mbit * hours * 360), txMb: Math.round(mbit * hours * 90) };
    });
  });
}

// Hypervisor readouts (plan 3.12): two existing years and two device vendors, shown as warnings.
export type IntegrationState = "off" | "ok" | "update";
export const INTEGRATION_SERVICES = ["shutdown", "time", "exchange", "heartbeat", "backup"] as const;

// The guest's Integration Services are as old as its OS install; a guest older than the host needs an update, and a stopped VM runs none.
export function integrationServices(s: GameState, c: Cluster, w: Workload): { host: number; guest: number; version: IntegrationState; services: { key: (typeof INTEGRATION_SERVICES)[number]; state: IntegrationState }[] } {
  const guest = yearOf(w.os?.installedAt ?? w.placedAt), host = c.version, off = !workloadOnline(s, w) || w.stopped;
  const old = guest < host, state = (key: string): IntegrationState => (off ? "off" : old && key === "backup" ? "update" : "ok");
  return { host, guest, version: off ? "off" : old ? "update" : "ok", services: INTEGRATION_SERVICES.map((key) => ({ key, state: state(key) })) };
}

// Moving to this server cannot happen live: the boards are of different vendors and the clusters are not both in compatibility mode.
export function evcWarning(s: GameState, w: Workload, toDeviceId: string): boolean {
  const from = s.devices.find((d) => d.id === w.deviceId), to = s.devices.find((d) => d.id === toDeviceId);
  return !!from && !!to && !liveBetween(s, from, to);
}
