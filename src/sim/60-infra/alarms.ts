// What a hypervisor console's cluster summary and alarm list show: per node and in total the physical capacity, what the
// workloads book of it and what they use right now, and the alarms those numbers raise.
import type { GameState } from "../50-state";
import { held, controlPlanesOn, KEYS, memberUp, type Cluster, type ClusterNode, type NodeState } from "./cluster";
import { rackPower } from "./status";
import { CONTINUOUS } from "../20-world/datacenters";
import { nodeUsage } from "./usage";
import { cephRebalancing } from "./replica";

// Booked vCPUs per core a mixed cluster still runs at its peak (economy.md, Usage curves: mixing peaks near 0.5 load),
// and the share of the usable disk past which a pool counts as nearly full. RAM warns from HOT_RAM, where balancing starts.
export const CPU_RATIO = 2;
export const HOT_RAM = 0.9;
export const DISK_FULL = 0.9;

export interface AlarmRules { cpu: number; ram: number; disk: number }
export const DEFAULT_RULES: AlarmRules = { cpu: CPU_RATIO, ram: HOT_RAM, disk: DISK_FULL };
export const rulesOf = (c: Cluster): AlarmRules => ({ ...DEFAULT_RULES, ...c.alarmRules });
export const alarmKey = (a: Alarm): string => `${a.key}:${a.on.id}`;

export type Severity = "warning" | "critical";
export interface Alarm { severity: Severity; on: { kind: "cluster" | "host" | "vm" | "rack"; id: string }; key: string; params: Record<string, string | number> }
export interface Amount { capacity: number; allocated: number; used: number }
export type Amounts = Record<(typeof KEYS)[number], Amount>;
export interface HostSummary { deviceId: string; name: string; state: NodeState; up: boolean; vms: number; use: Amounts }
// hidden holds the alarms the player acknowledged, which stay out of alarms until they clear.
export interface ClusterSummary { hosts: HostSummary[]; total: Amounts; alarms: Alarm[]; hidden: Alarm[] }

const zero = (): Amounts => ({ vcpu: { capacity: 0, allocated: 0, used: 0 }, ramGb: { capacity: 0, allocated: 0, used: 0 }, diskGb: { capacity: 0, allocated: 0, used: 0 } });
const round = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => Math.round((a / b) * 100);

// Allocated counts the control plane a node runs along with what its workloads hold.
function host(s: GameState, c: Cluster, n: ClusterNode): HostSummary {
  const { deviceId, state } = n;
  const d = s.devices.find((x) => x.id === deviceId);
  const u = nodeUsage(s, deviceId), use = zero(), on = s.workloads.filter((w) => w.clusterId === c.id && w.deviceId === deviceId);
  const alloc = controlPlanesOn(s, deviceId);
  for (const w of on) { const b = held(s, w); for (const k of KEYS) alloc[k] += b[k]; }
  for (const k of KEYS) use[k] = { capacity: u.physical[k], allocated: alloc[k], used: u.used[k] };
  return { deviceId, name: d ? d.hostname ?? d.label ?? d.name : deviceId, state, up: memberUp(s, n), vms: on.length, use };
}

const hostAlarms = (r: AlarmRules) => (h: HostSummary): Alarm[] => {
  const out: Alarm[] = [], on = { kind: "host" as const, id: h.deviceId }, { vcpu, ramGb, diskGb } = h.use, p = { host: h.name };
  const add = (severity: Severity, key: string, params: Alarm["params"] = {}) => out.push({ severity, on, key, params: { ...p, ...params } });
  if (!h.up && h.vms) add("critical", "alarm.hostDown", { count: h.vms });
  else if ((h.state === "maintenance" || h.state === "draining") && h.vms) add("warning", "alarm.hostMaintenance", { count: h.vms, state: h.state });
  if (!h.up) return out;
  if (ramGb.used > ramGb.capacity + 1e-9) add("critical", "alarm.memoryFull", { used: round(ramGb.used), capacity: ramGb.capacity });
  else if (ramGb.used > r.ram * ramGb.capacity) add("warning", "alarm.memoryHigh", { percent: pct(ramGb.used, ramGb.capacity) });
  if (ramGb.allocated > ramGb.capacity + 1e-9) add("warning", "alarm.memoryOverallocated", { allocated: round(ramGb.allocated), capacity: ramGb.capacity });
  if (vcpu.used > vcpu.capacity + 1e-9) add("critical", "alarm.cpuContention", { used: round(vcpu.used), capacity: vcpu.capacity });
  if (vcpu.allocated > r.cpu * vcpu.capacity + 1e-9) add("warning", "alarm.cpuOvercommitted", { allocated: round(vcpu.allocated), capacity: vcpu.capacity, ratio: r.cpu });
  if (diskGb.used >= diskGb.capacity && diskGb.capacity > 0) add("critical", "alarm.diskFull", { percent: pct(diskGb.used, diskGb.capacity) });
  else if (diskGb.used > r.disk * diskGb.capacity) add("warning", "alarm.diskHigh", { percent: pct(diskGb.used, diskGb.capacity) });
  return out;
};

// N+1: the working node with the most booked RAM fails, and the other active working nodes have less RAM free than it held.
function failoverAlarm(c: Cluster, hosts: HostSummary[]): Alarm[] {
  const up = hosts.filter((h) => h.up);
  if (hosts.length < 2 || !up.length) return [];
  const big = up.reduce((a, b) => (b.use.ramGb.allocated > a.use.ramGb.allocated ? b : a));
  const free = up.filter((h) => h !== big && h.state === "active").reduce((n, h) => n + Math.max(0, h.use.ramGb.capacity - h.use.ramGb.allocated), 0);
  return big.use.ramGb.allocated > free + 1e-9
    ? [{ severity: "warning", on: { kind: "cluster", id: c.id }, key: "alarm.noFailover", params: { cluster: c.name, host: big.name, need: round(big.use.ramGb.allocated), free: round(free) } }]
    : [];
}

export function clusterSummary(s: GameState, clusterId: string): ClusterSummary {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return { hosts: [], total: zero(), alarms: [], hidden: [] };
  const hosts = c.nodes.map((n) => host(s, c, n)), total = zero();
  for (const h of hosts) for (const k of KEYS) for (const f of ["capacity", "allocated", "used"] as const) total[k][f] += h.use[k][f];
  const stuck: Alarm[] = s.workloads.filter((w) => w.clusterId === c.id && w.stuck)
    .map((w) => ({ severity: "critical", on: { kind: "vm", id: w.id }, key: "alarm.vmStuck", params: { vm: w.hostname ?? w.id } }));
  const ceph: Alarm[] = cephRebalancing(s, c) ? [{ severity: "warning", on: { kind: "cluster", id: c.id }, key: "alarm.cephRebalancing", params: { cluster: c.name } }] : [];
  const all = [...hosts.flatMap(hostAlarms(rulesOf(c))), ...stuck, ...failoverAlarm(c, hosts), ...ceph]
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
  const seen = (a: Alarm) => c.acks.includes(alarmKey(a));
  return { hosts, total, alarms: all.filter((a) => !seen(a)), hidden: all.filter(seen) };
}

// How many alarms an inventory object carries: a host its own, a cluster all of its own, its hosts' and its VMs'.
export const alarmCount = (sum: ClusterSummary, id?: string): number => (id ? sum.alarms.filter((a) => a.on.id === id).length : sum.alarms.length);

// A rack's power alarms: a feed above its continuous load, and feeds that together draw more than one feed can carry alone.
export function rackAlarms(s: GameState, rackId: string): Alarm[] {
  const rack = s.racks.find((r) => r.id === rackId), p = rackPower(s, rackId);
  if (!rack || !p.limitWatts) return [];
  const on = { kind: "rack", id: rackId } as const, out: Alarm[] = [];
  for (const [feed, load] of [["A", p.a], ["B", p.b]] as const) {
    if (load > CONTINUOUS.share * p.limitWatts) out.push({ severity: "critical", on, key: "alarm.feedHigh", params: { rack: rack.name, feed, percent: Math.round((100 * load) / p.limitWatts) } });
  }
  if (rack.feedB && p.watts > p.limitWatts) out.push({ severity: "warning", on, key: "alarm.noFeedFailover", params: { rack: rack.name, percent: Math.round((100 * p.watts) / p.limitWatts) } });
  return out;
}

// Hourly: an acknowledgement ends once its alarm has cleared.
export function pruneAcks(s: GameState): void {
  s.clusters = s.clusters.map((c) => {
    if (!c.acks.length) return c;
    const live = new Set(clusterSummary(s, c.id).hidden.map(alarmKey));
    const acks = c.acks.filter((k) => live.has(k));
    return acks.length === c.acks.length ? c : { ...c, acks };
  });
}
