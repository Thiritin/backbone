// economy.md, Security advisories: scripted PHP vulnerabilities, their stages and the exploitation risk.
import { chance } from "../00-core/rng";
import { formatClock, hourOf } from "../00-core/time";
import { bump, createTicket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { clusterOf, servedBy, type ClusterNode, type Workload } from "./cluster";
import { maybeReview } from "./incidents";

export interface Vuln { id: string; at: number; versions: string[] }
const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m - 1, d, 9)));
export const VULNS: Vuln[] = [
  { id: "mopb", at: at(2007, 3, 12), versions: ["4.4", "5.1", "5.2"] },
  { id: "cgi", at: at(2012, 5, 3), versions: ["5.1", "5.2", "5.3"] },
  { id: "fpm", at: at(2019, 10, 22), versions: ["7.1", "7.2", "7.3"] },
  { id: "argv", at: at(2024, 6, 7), versions: ["8.1", "8.2", "8.3"] },
];
export const vulnById = (id: string | null): Vuln | undefined => VULNS.find((v) => v.id === id);

// Hours after the announcement each stage comes out: the announcement, the proof of concept, the agency warning, the patch.
export const STAGES = ["announced", "poc", "warning", "patch"] as const;
export const STAGE_HOURS = [0, 24, 48, 60];
export const ADVISORY_KEYS = STAGES.map((x) => `event.vuln.${x}`);
// Hourly chance an exposed node is compromised once the proof of concept is out, and once the agency warned (mass scanning).
export const POC_RISK = 0.01;
export const WARNING_RISK = 0.04;
// Happiness each customer on a compromised node loses to the data leak, and again without a backup to restore.
export const LEAK = -30;
export const REBUILT = -15;
export const RESTORE_HOURS = 4;
export const REBUILD_HOURS = 12;

// vuln is the advisory under way and stage the last one shown. patched, offline and hacked hold node device ids:
// patched against vuln, web sites taken offline by the player, and compromised until cleaned up.
export interface Security { vuln: string | null; stage: number; seen: string[]; patched: string[]; offline: string[]; hacked: string[] }
export const newSecurity = (): Security => ({ vuln: null, stage: 0, seen: [], patched: [], offline: [], hacked: [] });

export const webOn = (s: GameState, deviceId: string): Workload[] =>
  s.workloads.filter((w) => w.deviceId === deviceId && w.clusterId && servedBy(s, w) === "panel");
export const sitesDown = (s: GameState, deviceId: string): boolean => s.security.offline.includes(deviceId) || s.security.hacked.includes(deviceId);
export const patchOut = (s: GameState): boolean => !!s.security.vuln && s.security.stage >= STAGES.indexOf("patch");
export const vulnerable = (s: GameState, n: ClusterNode): boolean =>
  !!vulnById(s.security.vuln)?.versions.includes(n.php) && !s.security.patched.includes(n.deviceId);
// Nodes the Security app lists: on an affected version, or patched, offline or compromised.
export const advisoryNodes = (s: GameState): ClusterNode[] =>
  s.clusters.flatMap((c) => c.nodes).filter((n) =>
    vulnerable(s, n) || s.security.patched.includes(n.deviceId) || sitesDown(s, n.deviceId));
const exposed = (s: GameState, n: ClusterNode): boolean => vulnerable(s, n) && !sitesDown(s, n.deviceId) && webOn(s, n.deviceId).length > 0;

const params = (s: GameState, v: Vuln) => ({
  name: v.id, versions: v.versions.join(", "), date: formatClock(v.at + STAGE_HOURS[3]),
  nodes: s.clusters.flatMap((c) => c.nodes).filter((n) => vulnerable(s, n) && webOn(s, n.deviceId).length).length,
});

// The web sites on the node are defaced and send spam; every customer there gets a data leak notice.
function compromise(s: GameState, deviceId: string, events: SimEvent[]): void {
  s.security = { ...s.security, hacked: [...s.security.hacked, deviceId] };
  const services = new Set(webOn(s, deviceId).map((w) => w.serviceId));
  s.customers = s.customers.map((c) => ({ ...c }));
  let hit = 0;
  for (const c of s.customers) {
    const svc = s.services.find((v) => v.customerId === c.id && services.has(v.id));
    if (!svc || c.churnedAt !== null) continue;
    hit++;
    bump(c, LEAK);
    createTicket(s, c, "abuse", svc.id, "spam");
    maybeReview(s, c, "dataLoss", s.rng, events, 1);
  }
  const d = s.devices.find((x) => x.id === deviceId);
  events.push({ app: "Security", key: "event.vuln.hacked", params: { device: d?.label ?? d?.name ?? deviceId, customers: hit } });
}

// Hourly: a vulnerability fires on its date for players running affected web nodes, its stages follow on schedule and
// exposed nodes risk a compromise from the proof of concept on.
export function securityTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const v of VULNS) {
    if (v.at > s.hour || s.security.seen.includes(v.id)) continue;
    s.security = { ...s.security, seen: [...s.security.seen, v.id] };
    const live = s.hour < v.at + STAGE_HOURS[3];
    const hit = live && s.clusters.some((c) => c.nodes.some((n) => v.versions.includes(n.php) && webOn(s, n.deviceId).length));
    if (!hit) continue;
    s.security = { ...s.security, vuln: v.id, stage: 0, patched: [] };
    events.push({ app: "Security", key: ADVISORY_KEYS[0], params: params(s, v) });
  }
  const v = vulnById(s.security.vuln);
  if (!v) return events;
  const next = s.security.stage + 1;
  if (next < STAGES.length && s.hour >= v.at + STAGE_HOURS[next]) {
    s.security = { ...s.security, stage: next };
    events.push({ app: "Security", key: ADVISORY_KEYS[next], params: params(s, v) });
  }
  if (s.security.stage < 1) return events;
  const risk = s.security.stage >= 2 ? WARNING_RISK : POC_RISK;
  for (const n of s.clusters.flatMap((c) => c.nodes)) if (exposed(s, n) && chance(s.rng, risk)) compromise(s, n.deviceId, events);
  return events;
}

// Marks the node patched when it now runs an affected version and the patch is out.
export function markPatched(s: GameState, deviceId: string): void {
  const n = clusterOf(s, deviceId)?.nodes.find((x) => x.deviceId === deviceId);
  if (n && patchOut(s) && vulnerable(s, n)) s.security = { ...s.security, patched: [...s.security.patched, deviceId] };
}
