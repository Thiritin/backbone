// economy.md, Security advisories, Generated vulnerabilities: every software family ships one release a year and each
// year's release has a few vulnerabilities, drawn from the game's seed so they are the same whenever they are looked up.
import { hashRng, rand, type Rng } from "../00-core/rng";
import { hourOf, yearOf } from "../00-core/time";
import { CMS } from "../10-catalog/apps";
import { SOFTWARE, softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";

export type Severity = "low" | "high" | "critical";
export const SEVERITIES: Severity[] = ["low", "high", "critical"];

export interface Vulnerability { id: string; family: string; year: number; severity: Severity; disclosedAt: number; patchedAt: number }
// A vulnerability an instance is open to, with the whole days it has been exposed.
export interface OpenVuln extends Vulnerability { days: number }

// Mean vulnerabilities per family and year, by what the software is.
export const VULN_RATE: Record<string, number> = { panel: 2, cloud: 1, mail: 1, mailweb: 2, game: 1.5, cms: 3, oob: 1 };
export const SEVERITY_SHARE: Record<Severity, number> = { low: 0.5, high: 0.35, critical: 0.15 };
// The most days between disclosure and the patch.
export const PATCH_DAYS: Record<Severity, number> = { low: 14, high: 14, critical: 3 };
// Chance per day that an exposed instance is compromised, and how it grows with the days exposed.
export const DAILY_RISK: Record<Severity, number> = { low: 0.0005, high: 0.0025, critical: 0.01 };
export const RISK_STEPS: [days: number, factor: number][] = [[90, 4], [30, 2]];

const hashOf = (text: string): number => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

function poisson(r: Rng, mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0, p = rand(r);
  while (p > limit) { k++; p *= rand(r); }
  return k;
}

const cache = new Map<string, Vulnerability[]>();

// The vulnerabilities of a family's release in a year; the same for the same family, year and seed.
export function vulnsFor(familyId: string, year: number, seed: number): Vulnerability[] {
  const key = `${seed}:${familyId}:${year}`, kept = cache.get(key);
  if (kept) return kept;
  const rate = VULN_RATE[SOFTWARE.find((x) => x.id === familyId)?.kind ?? ((CMS as string[]).includes(familyId) ? "cms" : familyId)] ?? 0;
  const r = hashRng(seed, hashOf(familyId), year, 55);
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000, start = hourOf(new Date(Date.UTC(year, 0, 1)));
  const found: Vulnerability[] = [];
  for (let i = 0, n = poisson(r, rate); i < n; i++) {
    const roll = rand(r), severity: Severity = roll < SEVERITY_SHARE.low ? "low" : roll < SEVERITY_SHARE.low + SEVERITY_SHARE.high ? "high" : "critical";
    const disclosedAt = start + Math.floor(rand(r) * days) * 24, patchedAt = disclosedAt + Math.floor(rand(r) * (PATCH_DAYS[severity] + 1)) * 24;
    found.push({ id: `${familyId}-${year}-${i + 1}`, family: familyId, year, severity, disclosedAt, patchedAt });
  }
  cache.set(key, found);
  return found;
}

export const familyOf = (c: Pick<Cluster, "panel" | "platform">): string | null => c.panel ?? c.platform;

// An instance is open to a vulnerability when it runs an older release than the one that got the patch, or that release
// from before the patch came out.
export const affects = (c: Pick<Cluster, "version" | "updatedAt">, v: Vulnerability): boolean =>
  c.version < v.year || (c.version === v.year && c.updatedAt < v.patchedAt);

// Whole days exposed, counted from the patch (before it nobody can update) or from the last update.
export const exposureDays = (c: Pick<Cluster, "updatedAt">, v: Vulnerability, hour: number): number =>
  Math.max(0, Math.floor((hour - Math.max(v.patchedAt, c.updatedAt)) / 24));

export const rank = (v: Severity): number => SEVERITIES.indexOf(v);

// Chance per day an instance with this vulnerability open is compromised.
export const dailyRisk = (v: Pick<OpenVuln, "severity" | "days">): number =>
  DAILY_RISK[v.severity] * (RISK_STEPS.find(([days]) => v.days >= days)?.[1] ?? 1);

// The patched vulnerabilities a cluster's software is still open to at an hour, worst first.
export function openVulns(s: GameState, clusterId: string, hour: number = s.hour): OpenVuln[] {
  const c = s.clusters.find((x) => x.id === clusterId), family = c && familyOf(c);
  if (!c || !family || c.switching) return [];
  const open: OpenVuln[] = [];
  for (let y = Math.max(c.version, softwareById(family).from); y <= yearOf(hour); y++) {
    for (const v of vulnsFor(family, y, s.seed)) if (v.patchedAt <= hour && affects(c, v)) open.push({ ...v, days: exposureDays(c, v, hour) });
  }
  return open.sort((a, b) => rank(b.severity) - rank(a.severity) || b.days - a.days);
}

// The worst per-day chance among the open vulnerabilities.
export const instanceRisk = (open: OpenVuln[]): number => open.reduce((m, v) => Math.max(m, dailyRisk(v)), 0);

// One installed software for the monitoring list: its worst open vulnerability and how long that one has been exposed.
export interface MonitorRow { cluster: Cluster; family: string; worst: Severity | null; days: number; open: number }

// Every installed software, the most exposed first.
export function monitoring(s: GameState): MonitorRow[] {
  return s.clusters.flatMap((cluster) => {
    const family = familyOf(cluster);
    if (!family || cluster.switching) return [];
    const open = openVulns(s, cluster.id);
    return [{ cluster, family, worst: open[0]?.severity ?? null, days: open[0]?.days ?? 0, open: open.length }];
  }).sort((a, b) => (b.worst ? rank(b.worst) : -1) - (a.worst ? rank(a.worst) : -1) || b.days - a.days);
}

// One own instance with an open high or critical vulnerability, for the update list that needs no monitoring.
export interface UrgentRow { clusterId: string; software: string; host: string; worst: Severity; days: number }

// Every instance open to a high or critical vulnerability, critical first, then the longest exposed.
export function urgentSoftware(s: GameState): UrgentRow[] {
  return s.clusters.flatMap((c) => {
    const family = familyOf(c), top = family && !c.switching ? openVulns(s, c.id)[0] : undefined;
    return family && top && top.severity !== "low" ? [{ clusterId: c.id, software: softwareById(family).name, host: c.name, worst: top.severity, days: top.days }] : [];
  }).sort((a, b) => rank(b.worst) - rank(a.worst) || b.days - a.days);
}

// The vulnerabilities whose patch comes out this hour for a cluster that is open to them.
export function patchedNow(s: GameState, c: Cluster): Vulnerability[] {
  const family = familyOf(c);
  if (!family || c.switching) return [];
  const year = yearOf(s.hour);
  return [year - 1, year].flatMap((y) => vulnsFor(family, y, s.seed)).filter((v) => v.patchedAt === s.hour && affects(c, v));
}
