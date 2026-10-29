// economy.md, Security advisories: scripted PHP vulnerabilities, their stages and the exploitation risk.
import { chance, hashRng, rand } from "../00-core/rng";
import { softwareById } from "../10-catalog/platforms";
import { formatClock, hourOf } from "../00-core/time";
import { bump, createTicket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { controlPlaneUp, sitesDown, type Cluster, type Workload } from "./cluster";
import { breachEligible, breachTick, startBreach, BREACH_CHANCE } from "./breach";
import { maybeReview } from "./incidents";
import { familyOf, instanceRisk, openVulns, patchedNow } from "./vulns";
import { oobSecurityTick } from "./oob";

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
// Hourly chance an exposed panel host is compromised once the proof of concept is out, and once the agency warned (mass scanning).
export const POC_RISK = 0.01;
export const WARNING_RISK = 0.04;
// Happiness each customer on a compromised panel host loses to the data leak, and again without a backup to restore.
export const LEAK = -30;
export const REBUILT = -15;
export const RESTORE_HOURS = 4;
export const REBUILD_HOURS = 12;

// vuln is the advisory under way and stage the last one shown. patched, offline and hacked hold panel host ids:
// patched against vuln, web sites taken offline by the player, and compromised until cleaned up.
export interface Security { vuln: string | null; stage: number; seen: string[]; patched: string[]; offline: string[]; hacked: string[] }
export const newSecurity = (): Security => ({ vuln: null, stage: 0, seen: [], patched: [], offline: [], hacked: [] });

export { sitesDown };
export const webOn = (s: GameState, hostId: string): Workload[] => s.workloads.filter((w) => w.clusterId === hostId && w.serviceId);
const hosts = (s: GameState): Cluster[] => s.clusters.filter((c) => c.kind === "panel" && c.panel);
export const patchOut = (s: GameState): boolean => !!s.security.vuln && s.security.stage >= STAGES.indexOf("patch");
export const vulnerable = (s: GameState, c: Cluster): boolean =>
  c.kind === "panel" && !!vulnById(s.security.vuln)?.versions.includes(c.php) && !s.security.patched.includes(c.id);
// Panel hosts the Security app lists: on an affected version, or patched, offline or compromised.
export const advisoryNodes = (s: GameState): Cluster[] =>
  hosts(s).filter((c) => vulnerable(s, c) || s.security.patched.includes(c.id) || sitesDown(s, c.id));
const exposed = (s: GameState, c: Cluster): boolean => vulnerable(s, c) && !sitesDown(s, c.id) && webOn(s, c.id).length > 0;

const params = (s: GameState, v: Vuln) => ({
  name: v.id, versions: v.versions.join(", "), date: formatClock(v.at + STAGE_HOURS[3]),
  nodes: hosts(s).filter((c) => vulnerable(s, c) && webOn(s, c.id).length).length,
});

// A generated vulnerability reaches any cluster with software on a working host: panel hosts and hypervisors with customers
// on them, and the company's mail host.
const reachable = (s: GameState, c: Cluster): boolean =>
  !!familyOf(c) && !sitesDown(s, c.id) && controlPlaneUp(s, c) && (c.kind === "mail" || webOn(s, c.id).length > 0);

// The sites or virtual machines on the host are taken over and send spam; every customer there gets a data leak notice.
function compromise(s: GameState, host: Cluster, events: SimEvent[]): void {
  s.security = { ...s.security, hacked: [...s.security.hacked, host.id] };
  const services = new Set(webOn(s, host.id).map((w) => w.serviceId));
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
  events.push({ app: "Security", key: "event.vuln.hacked", params: { device: host.name, customers: hit, kind: host.kind } });
}

// Hourly: a vulnerability fires on its date for players running affected panel hosts, its stages follow on schedule and
// exposed hosts risk a compromise from the proof of concept on.
export function securityTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const v of VULNS) {
    if (v.at > s.hour || s.security.seen.includes(v.id)) continue;
    s.security = { ...s.security, seen: [...s.security.seen, v.id] };
    const live = s.hour < v.at + STAGE_HOURS[3];
    const hit = live && hosts(s).some((c) => v.versions.includes(c.php) && webOn(s, c.id).length);
    if (!hit) continue;
    s.security = { ...s.security, vuln: v.id, stage: 0, patched: [] };
    events.push({ app: "Security", key: ADVISORY_KEYS[0], params: params(s, v) });
  }
  events.push(...generatedTick(s), ...breachTick(s), ...oobSecurityTick(s));
  const v = vulnById(s.security.vuln);
  if (!v) return events;
  const next = s.security.stage + 1;
  if (next < STAGES.length && s.hour >= v.at + STAGE_HOURS[next]) {
    s.security = { ...s.security, stage: next };
    events.push({ app: "Security", key: ADVISORY_KEYS[next], params: params(s, v) });
  }
  if (s.security.stage < 1) return events;
  const risk = s.security.stage >= 2 ? WARNING_RISK : POC_RISK;
  for (const c of hosts(s)) if (exposed(s, c) && chance(s.rng, risk)) compromise(s, c, events);
  return events;
}

// Marks the panel host patched when it now runs an affected version and the patch is out.
export function markPatched(s: GameState, hostId: string): void {
  const c = s.clusters.find((x) => x.id === hostId);
  if (c && patchOut(s) && vulnerable(s, c)) s.security = { ...s.security, patched: [...s.security.patched, hostId] };
}

// Monitoring is a Pear Store app; without it the player hears only about critical vulnerabilities.
export const MONITORING = "Nagiosaurus";

// Generated vulnerabilities: the hour a patch comes out for software that is open to it (a banner for a low or high one when
// monitoring is installed, an alert for a critical one), and once a day each reachable instance risks a compromise.
function generatedTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const c of s.clusters) {
    const family = familyOf(c);
    if (!family) continue;
    for (const v of patchedNow(s, c)) {
      if (v.severity !== "critical" && !s.installed.includes(MONITORING)) continue;
      events.push({ app: "Security", key: v.severity === "critical" ? "event.vulnCritical" : "event.vulnOpen", params: { software: softwareById(family).name, host: c.name, severity: v.severity } });
    }
  }
  if (s.hour % 24 !== 0) return events;
  for (const c of s.clusters) {
    if (!reachable(s, c)) continue;
    const open = openVulns(s, c.id), risk = instanceRisk(open), num = Number(c.id.replace(/\D/g, "")) || 0;
    if (risk <= 0 || rand(hashRng(s.seed, num, s.hour / 24, 91)) >= risk) continue;
    if (breachEligible(s, c.id, open) && rand(hashRng(s.seed, num, s.hour / 24, 92)) < BREACH_CHANCE) startBreach(s, c, events);
    else compromise(s, c, events);
  }
  return events;
}
