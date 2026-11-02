// docs/design/web-hosting.md, 4.5: the zones, certificates and cron schedules of a web space's domains.
import { yearOf } from "../00-core/time";
import { certificateOf } from "../30-customers/certificates";
import type { GameState } from "../50-state";
import { serviceAddress } from "./addresses";
import { defaultRecords, ownerOf, putZone, syncZone, zoneOf, type DnsRecord, type ZoneEdit } from "./netsvc-dns";
import { AUTOSSL_FROM, autoSslOn, sslStatus } from "./webpanel";
import type { CronJob, Webspace } from "./webspace";

// Every domain except a subdomain has a zone of its own; a subdomain's records live in its parent's zone.
export const zoneNames = (ws: Webspace): string[] => Object.values(ws.domains).filter((d) => d.kind !== "sub").map((d) => d.name);
export const zoneRoot = (ws: Webspace, name: string): string | undefined =>
  zoneNames(ws).filter((z) => name === z || name.endsWith(`.${z}`)).sort((a, b) => b.length - a.length)[0];

const hostIp = (s: GameState, ws: Webspace): string => {
  const w = s.workloads.find((x) => x.id === ws.workloadId);
  return (w?.serviceId && serviceAddress(s, w.serviceId)?.ip) || "192.0.2.1";
};

// The zone as PowerDNZ shows it when a DNS service owns it; a zone nobody hosts starts with the web space's own records.
export function webZone(s: GameState, ws: Webspace, zone: string): ZoneEdit {
  if (s.netsvc.zones[zone] || ownerOf(s, zone)) return zoneOf(s, zone);
  const ip = hostIp(s, ws), rec = (i: number, type: DnsRecord["type"], name: string, data: string): DnsRecord => ({ id: `d${i}`, type, name, ttl: 3600, data });
  const base = defaultRecords(s, zone).filter((r) => r.type !== "A");
  return { records: [...base, rec(3, "A", "@", ip), rec(4, "A", "www", ip)], secondary: null, typoAt: null };
}

export function addRecord(s: GameState, ws: Webspace, zone: string, rec: Omit<DnsRecord, "id">): void {
  const z = webZone(s, ws, zone);
  putZone(s, zone, { ...z, records: [...z.records, { id: `r${s.nextId++}`, ...rec }] });
  syncZone(s, zone);
}

const relName = (zone: string, name: string) => name.slice(0, -zone.length - 1);

// A new subdomain gets its address record at once, as real panels add it.
export function addSubdomainRecord(s: GameState, ws: Webspace, name: string): void {
  const zone = zoneRoot(ws, name);
  if (zone) addRecord(s, ws, zone, { type: "A", name: relName(zone, name), ttl: 3600, data: hostIp(s, ws) });
}

export function dropSubdomainRecord(s: GameState, ws: Webspace, name: string): void {
  const zone = zoneRoot(ws, name), z = zone && s.netsvc.zones[zone];
  if (!zone || !z) return;
  putZone(s, zone, { ...z, records: z.records.filter((r) => r.name !== relName(zone, name)) });
  syncZone(s, zone);
}

export type CertKind = "none" | "purchased" | "autossl" | "manual";
export interface DomainCert { kind: CertKind; status: "valid" | "renewing" | "expired" | null; expires: number | null }

// What secures a domain: a certificate bought for it, or from the free-certificate year the one every account of the host holds,
// renewed by AutoSSL where the host runs it. Only the main domain carries a renewal date.
export function domainCert(s: GameState, ws: Webspace, domain: string): DomainCert {
  const w = s.workloads.find((x) => x.id === ws.workloadId), host = w?.clusterId;
  if (certificateOf(s, domain)) return { kind: "purchased", status: "valid", expires: null };
  if (!w?.serviceId || !host || yearOf(s.hour) < AUTOSSL_FROM) return { kind: "none", status: null, expires: null };
  const auto = autoSslOn(s, host), exp = s.webpanel.ssl.expires[w.serviceId];
  if (exp === undefined || (!auto && domain !== ws.domain)) return { kind: "none", status: null, expires: null };
  return { kind: auto ? "autossl" : "manual", status: sslStatus(s, w.serviceId), expires: domain === ws.domain ? exp : null };
}

const RANGES: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
export const CRON_PRESETS: [string, string][] = [
  ["minute", "* * * * *"], ["five", "*/5 * * * *"], ["halfHour", "0,30 * * * *"], ["hour", "0 * * * *"], ["twiceDay", "0 0,12 * * *"],
  ["day", "0 0 * * *"], ["week", "0 0 * * 0"], ["twiceMonth", "0 0 1,15 * *"], ["month", "0 0 1 * *"], ["year", "0 0 1 1 *"],
];

// The five fields, or null when one is not a valid crontab field.
export function parseSchedule(schedule: string): string[] | null {
  const f = schedule.trim().split(/\s+/);
  const ok = f.length === 5 && f.every((x, i) => /^[\d*,/-]+$/.test(x) && [...x.matchAll(/(\/?)(\d+)/g)].every(([, step, n]) => Number(n) <= RANGES[i][1] && (step || Number(n) >= RANGES[i][0])));
  return ok ? f : null;
}

// Hours between runs in effect: the host runs a job at most once an hour, so anything more frequent counts as hourly.
export function scheduleHours(f: string[]): number {
  const [, hour, day, month, weekday] = f;
  if (month !== "*") return 8760;
  if (day !== "*") return 720;
  if (weekday !== "*") return 168;
  if (hour === "*") return 1;
  const step = /^\*\/(\d+)$/.exec(hour);
  return step ? Math.max(1, Number(step[1])) : Math.max(1, Math.floor(24 / hour.split(",").length));
}

export const scheduleOf = (j: CronJob): string => j.schedule ?? (j.everyHours === 1 ? "0 * * * *" : `0 */${j.everyHours} * * *`);

// A run holds one core for this many seconds.
export const CRON_RUN_SECONDS = 20;
// Share of one core a job keeps busy.
export const cronLoad = (j: CronJob): number => CRON_RUN_SECONDS / (3600 * j.everyHours);
