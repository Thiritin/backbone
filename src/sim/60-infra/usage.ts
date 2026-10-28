import { hashRng, rand } from "../00-core/rng";
import { modelById } from "../10-catalog/hardware";
import type { Resources } from "../10-catalog/products";
import { curveFor, curveLoad } from "../10-catalog/usage";
import type { Device, GameState } from "../50-state";
import { clusterOf, controlPlaneUse, lostDisk, workloadsOf, workloadsOn, type Workload } from "./cluster";
import { serviceMbps } from "./network";
import { PHP_SLOW } from "./php";
import { portPeers, raidUsable, working } from "./status";

const YEARS_2 = 2 * 8760;
// economy.md: memory stays mostly resident, disks fill from 30% of booked at signup to 70% after two years.
const RAM_BASE = 0.6;
export function diskFill(s: GameState, w: Workload, hour: number): number {
  const since = s.services.find((v) => v.id === w.serviceId)?.startedAt ?? w.placedAt;
  return 0.3 + 0.4 * Math.min(1, Math.max(0, hour - since) / YEARS_2);
}

const idNum = (id: string) => [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193), 0x811c9dc5);

// A workload's load at an hour: its customer's curve with ±20% jitter drawn from the seed. Stopped, restoring and lost workloads idle.
export function workloadLoad(s: GameState, w: Workload, hour: number): number {
  if (w.stopped || w.busyUntil > hour || lostDisk(s, w)) return 0;
  const v = s.services.find((x) => x.id === w.serviceId), c = v && s.customers.find((x) => x.id === v.customerId);
  if (!v || !c) return 0;
  const jitter = 1 + 0.4 * (rand(hashRng(s.seed, idNum(w.id), hour)) - 0.5);
  return Math.min(1, curveLoad(curveFor(v.product, c.profile), hour) * jitter);
}

// What a node physically has and uses at an hour, and the performance its workloads get: CPU contention slows everyone by
// cores ÷ busy vCPUs, RAM over 100% swaps to 30%, a disk pool over 100% stalls writes to 50%, a PHP upgrade slows it to 70%.
export interface NodeUsage { used: Resources; physical: Resources; perf: number }

export function nodeUsage(s: GameState, deviceId: string, hour: number = s.hour): NodeUsage {
  const d = s.devices.find((x) => x.id === deviceId), v = d && modelById(d.model).server;
  const used: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
  if (!d || !v) return { used, physical: { ...used }, perf: 1 };
  const c = clusterOf(s, deviceId);
  if (c && c.controlPlane === deviceId) {
    const cp = controlPlaneUse(c);
    used.vcpu += cp.vcpu; used.ramGb += cp.ramGb; used.diskGb += cp.diskGb;
  }
  for (const w of s.workloads) {
    if (w.deviceId !== deviceId || !w.clusterId) continue;
    const load = workloadLoad(s, w, hour), idle = w.stopped || lostDisk(s, w);
    used.vcpu += w.vcpu * load;
    used.ramGb += idle ? 0 : w.ramGb * (RAM_BASE + (1 - RAM_BASE) * load);
    used.diskGb += lostDisk(s, w) ? 0 : w.diskGb * diskFill(s, w, hour);
  }
  const physical = { vcpu: v.cores, ramGb: v.ramGb, diskGb: raidUsable(d) };
  const cpu = used.vcpu > physical.vcpu ? physical.vcpu / used.vcpu : 1;
  const ram = used.ramGb > physical.ramGb ? 0.3 : 1;
  const disk = used.diskGb > physical.diskGb ? 0.5 : 1;
  const php = c && hour <= (c.nodes.find((n) => n.deviceId === deviceId)?.phpUntil ?? -1) ? PHP_SLOW : 1;
  return { used, physical, perf: Math.min(cpu, ram, disk, php) };
}

// The highest CPU, RAM and disk use of a node over the given hours.
export function peakUsage(s: GameState, deviceId: string, from: number, hours: number): Resources {
  const peak: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
  for (let h = from; h < from + hours; h++) {
    const u = nodeUsage(s, deviceId, h).used;
    peak.vcpu = Math.max(peak.vcpu, u.vcpu); peak.ramGb = Math.max(peak.ramGb, u.ramGb); peak.diskGb = Math.max(peak.diskGb, u.diskGb);
  }
  return peak;
}

// Shares of each resource in use, 0 to 1, for the LED bars of a server, a rack or a location.
export interface Usage { cpu: number; ram: number; disk: number; net: number }
interface Sums { used: Resources; physical: Resources; gbit: number; mbps: number }

const linkedGbit = (s: GameState, d: Device) => portPeers(s, d.id).reduce((n, p, i) => n + (p ? modelById(d.model).ports[i].gbit : 0), 0);
const serverMbps = (s: GameState, d: Device) =>
  workloadsOn(s, d.id).reduce((n, w) => { const v = s.services.find((x) => x.id === w.serviceId); return n + (v ? serviceMbps(s, v) / workloadsOf(s, v.id).length : 0); }, 0);

function serverSums(s: GameState, d: Device, out: Sums) {
  const u = nodeUsage(s, d.id);
  for (const k of ["vcpu", "ramGb", "diskGb"] as const) out.physical[k] += u.physical[k];
  out.gbit += linkedGbit(s, d);
  if (!working(s, d.id)) return;
  for (const k of ["vcpu", "ramGb", "diskGb"] as const) out.used[k] += u.used[k];
  out.mbps += serverMbps(s, d);
}

// A switch carries the traffic of the servers plugged straight into it.
function switchSums(s: GameState, d: Device, out: Sums) {
  out.gbit += linkedGbit(s, d);
  if (!working(s, d.id)) return;
  for (const p of portPeers(s, d.id)) {
    const peer = p && s.devices.find((x) => x.id === p.device);
    if (peer && modelById(peer.model).server && working(s, peer.id)) out.mbps += serverMbps(s, peer);
  }
}

const share = (used: number, cap: number) => (cap > 0 ? Math.min(1, used / cap) : 0);

// Servers count their own links; a list of only switches counts switch ports.
export function usageOf(s: GameState, devices: Device[]): Usage {
  const sums: Sums = { used: { vcpu: 0, ramGb: 0, diskGb: 0 }, physical: { vcpu: 0, ramGb: 0, diskGb: 0 }, gbit: 0, mbps: 0 };
  const servers = devices.filter((d) => modelById(d.model).server);
  if (servers.length) for (const d of servers) serverSums(s, d, sums);
  else for (const d of devices) if (modelById(d.model).kind === "switch" || modelById(d.model).kind === "firewall") switchSums(s, d, sums);
  const { used, physical } = sums;
  return { cpu: share(used.vcpu, physical.vcpu), ram: share(used.ramGb, physical.ramGb), disk: share(used.diskGb, physical.diskGb), net: share(sums.mbps, sums.gbit * 1000) };
}
