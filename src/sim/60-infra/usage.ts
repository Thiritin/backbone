import { chance, hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import { isOobPort, jacksOf, modelById } from "../10-catalog/hardware";
import type { Resources } from "../10-catalog/products";
import { BACKUP_CHANGED, BACKUP_HOUR, curveFor, curveLoad, growthRate, idNum, JOB_CPU, nightJob, weekMedian } from "../10-catalog/usage";
import type { Service } from "../30-customers/customers";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import { isSuspended } from "../45-billing/billing";
import type { Device, End, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { booked, clusterOf, controlPlaneUp, controlPlaneUse, hostOfVm, isOwnVm, lostDisk, workloadsOf, workloadsOn, type Workload } from "./cluster";
import { serviceMbps } from "./network";
import { installedCores, installedRamGb, portPeers, raidUsable, working } from "./status";

// economy.md: memory stays mostly resident, disks fill from 30% of booked at signup at the customer's growth rate up to the booked limit.
const RAM_BASE = 0.6;
const yearsSince = (since: number, hour: number) => Math.max(0, hour - since) / 8760;
export function diskFill(s: GameState, w: Workload, hour: number): number {
  const v = s.services.find((x) => x.id === w.serviceId);
  return Math.min(1, 0.3 + growthRate(s.seed, v?.customerId ?? w.serviceId, "disk") * yearsSince(v?.startedAt ?? w.placedAt, hour));
}

// How much more CPU a customer needs than in their first month, from their growth rate.
const demand = (s: GameState, v: Service, hour: number) => 1 + growthRate(s.seed, v.customerId, "cpu") * yearsSince(v.startedAt, hour);

// A workload's load at an hour: its customer's curve times their grown demand with ±20% jitter drawn from the seed, plus their
// night job. Stopped, restoring and lost workloads idle.
export function workloadLoad(s: GameState, w: Workload, hour: number): number {
  if (w.stopped || w.busyUntil > hour || lostDisk(s, w)) return 0;
  const v = s.services.find((x) => x.id === w.serviceId), c = v && s.customers.find((x) => x.id === v.customerId);
  if (!v || !c) return 0;
  const jitter = 1 + 0.4 * (rand(hashRng(s.seed, idNum(w.id), hour)) - 0.5);
  return Math.min(1, curveLoad(curveFor(v.product, c.profile), hour) * demand(s, v, hour) * jitter + JOB_CPU * nightJob(s.seed, c.id, hour));
}

// The player's cluster backups this hour: each source node sends its workloads' changed data to the target's control plane.
// ponytail: a backup to another zone lights the LAN ports only; bill it on the uplinks if cross-zone backups get common.
export interface BackupFlow { from: string; to: string; mbps: number }
export function backupFlows(s: GameState, hour: number = s.hour): BackupFlow[] {
  const d = dateOf(hour);
  if (d.getUTCHours() !== BACKUP_HOUR) return [];
  const flows = new Map<string, BackupFlow>();
  for (const c of s.clusters) {
    const t = s.clusters.find((x) => x.id === c.backup.targetId), to = t?.controlPlane;
    if (c.backup.every === "off" || !t || !to || !controlPlaneUp(s, t) || (c.backup.every === "weekly" && d.getUTCDay() !== 0)) continue;
    for (const w of s.workloads) {
      if (w.clusterId !== c.id || !w.deviceId || w.deviceId === to || w.stopped || lostDisk(s, w)) continue;
      const f = flows.get(`${w.deviceId}>${to}`) ?? { from: w.deviceId, to, mbps: 0 };
      f.mbps += (w.diskGb * diskFill(s, w, hour) * BACKUP_CHANGED * 8000) / 3600;
      flows.set(`${w.deviceId}>${to}`, f);
    }
  }
  return [...flows.values()];
}
const flowMbps = (s: GameState, id: string) => backupFlows(s).reduce((n, f) => n + (f.from === id || f.to === id ? f.mbps : 0), 0);

// What a workload uses of its booking at an hour; a panel VM uses what its panel and web spaces use.
export function workloadUse(s: GameState, w: Workload, hour: number = s.hour): Resources {
  if (isOwnVm(w)) {
    const host = hostOfVm(s, w.id), u: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
    if (!host || w.stopped || lostDisk(s, w)) return u;
    const parts = [controlPlaneUse(host), ...s.workloads.filter((x) => x.clusterId === host.id).map((x) => workloadUse(s, x, hour))];
    for (const p of parts) { u.vcpu += p.vcpu; u.ramGb += p.ramGb; u.diskGb += p.diskGb; }
    return u;
  }
  const load = workloadLoad(s, w, hour), lost = lostDisk(s, w);
  return { vcpu: booked(s, w).vcpu * load, ramGb: w.stopped || lost ? 0 : w.ramGb * (RAM_BASE + (1 - RAM_BASE) * load), diskGb: lost ? 0 : w.diskGb * diskFill(s, w, hour) };
}

// What a node physically has and uses at an hour, and the performance its workloads get: CPU contention slows everyone by
// cores ÷ busy vCPUs, a disk pool over 100% stalls writes to 50%. RAM over 100% freezes the node instead (freezeTick).
// economy.md, RAID: the share of its performance a node keeps while its array rebuilds, by rebuild rate.
export const REBUILD_PERF = { low: 0.95, medium: 0.8, high: 0.6 } as const;
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
    const u = workloadUse(s, w, hour);
    used.vcpu += u.vcpu; used.ramGb += u.ramGb; used.diskGb += u.diskGb;
  }
  const physical = { vcpu: installedCores(d), ramGb: installedRamGb(d), diskGb: raidUsable(d) };
  const cpu = used.vcpu > physical.vcpu ? physical.vcpu / used.vcpu : 1;
  const disk = used.diskGb > physical.diskGb ? 0.5 : 1;
  return { used, physical, perf: Math.min(cpu, disk) * (d.rebuild ? REBUILD_PERF[d.rebuildRate] : 1) };
}

// A working cluster node whose RAM in use exceeds its installed RAM freezes: every workload on it is down until it fits again.
export const ramOver = (u: NodeUsage) => u.used.ramGb > u.physical.ramGb + 1e-9;

// Hourly and after a stop or a move: recomputes the frozen nodes and reports each freeze and thaw.
export function freezeTick(s: GameState): SimEvent[] {
  const name = (id: string) => { const d = s.devices.find((x) => x.id === id)!; return d.label ?? d.name; };
  const frozen = s.clusters.flatMap((c) => c.nodes.map((n) => n.deviceId)).filter((id) => working(s, id) && ramOver(nodeUsage(s, id)));
  const events: SimEvent[] = [
    ...frozen.filter((id) => !s.frozen.includes(id)).map((id) => ({ app: "Locations", key: "event.nodeFrozen", params: { device: name(id) } })),
    ...s.frozen.filter((id) => !frozen.includes(id) && s.devices.some((d) => d.id === id)).map((id) => ({ app: "Locations", key: "event.nodeThawed", params: { device: name(id) } })),
  ];
  s.frozen = frozen;
  return events;
}

// economy.md, Workloads: a workload is pegged when its CPU ran at 95% or more of its booking for over half of the last 24 hours.
export const PEGGED_LOAD = 0.95;
export const peggedHours = (s: GameState, w: Workload, hour: number = s.hour): number =>
  Array.from({ length: Math.min(24, hour + 1) }, (_, i) => workloadLoad(s, w, hour - i)).filter((l) => l >= PEGGED_LOAD).length;
export const pegged = (s: GameState, w: Workload, hour: number = s.hour) => peggedHours(s, w, hour) > 12;

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
// A workload's share of its service's traffic; a panel VM carries its web spaces'.
const workloadMbps = (s: GameState, w: Workload): number => {
  if (isOwnVm(w)) { const host = hostOfVm(s, w.id); return host ? s.workloads.filter((x) => x.clusterId === host.id).reduce((n, x) => n + workloadMbps(s, x), 0) : 0; }
  const v = s.services.find((x) => x.id === w.serviceId);
  return v ? serviceMbps(s, v) / workloadsOf(s, v.id).length : 0;
};
const serverMbps = (s: GameState, d: Device) => workloadsOn(s, d.id).reduce((n, w) => n + workloadMbps(s, w), 0);

function serverSums(s: GameState, d: Device, out: Sums) {
  const u = nodeUsage(s, d.id);
  for (const k of ["vcpu", "ramGb", "diskGb"] as const) out.physical[k] += u.physical[k];
  out.gbit += linkedGbit(s, d);
  if (!working(s, d.id)) return;
  for (const k of ["vcpu", "ramGb", "diskGb"] as const) out.used[k] += u.used[k];
  out.mbps += serverMbps(s, d) + flowMbps(s, d.id);
}

// A switch carries the traffic of the servers plugged straight into it.
function switchSums(s: GameState, d: Device, out: Sums) {
  out.gbit += linkedGbit(s, d);
  if (!working(s, d.id)) return;
  for (const p of portPeers(s, d.id)) {
    const peer = p && s.devices.find((x) => x.id === p.device);
    if (peer && modelById(peer.model).server && working(s, peer.id)) out.mbps += serverMbps(s, peer) + flowMbps(s, peer.id);
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

// Every port's live link: its speed, the Mbit/s it carries and its share of the speed, or null without a link.
// Each server's traffic takes the shortest cable path to a carrier panel; patch panels pass it through.
// ponytail: a bonded server sends everything over the first link found; split it across the bond if the lights need it.
export interface PortLink { gbit: number; mbps: number; load: number }
export function portLinks(s: GameState): Map<string, (PortLink | null)[]> {
  const models = new Map(s.devices.map((d) => [d.id, modelById(d.model)]));
  const up = new Set(s.devices.filter((d) => working(s, d.id)).map((d) => d.id));
  const key = (e: End) => `${e.device}:${e.port}`, peers = new Map<string, End>();
  for (const c of s.cables) { peers.set(key(c.a), c.b); peers.set(key(c.b), c.a); }
  const kind = (id: string) => models.get(id)!.kind;
  const far = (e: End): End | null => {
    let p = peers.get(key(e));
    for (let hops = 0; p && kind(p.device) === "patch" && hops < 64; hops++) {
      const jacks = jacksOf(models.get(p.device)!);
      p = peers.get(key({ device: p.device, port: p.port < jacks ? p.port + jacks : p.port - jacks }));
    }
    return p && kind(p.device) !== "patch" && !isOobPort(p.port) ? p : null;
  };
  const out = new Map(s.devices.map((d) => {
    const m = models.get(d.id)!;
    return [d.id, m.ports.map((spec, port) => {
      const f = m.kind !== "patch" && up.has(d.id) ? far({ device: d.id, port }) : null;
      return f && up.has(f.device) ? { gbit: Math.min(spec.gbit, models.get(f.device)!.ports[f.port].gbit), mbps: 0, load: 0 } : null;
    })];
  }));
  // Breadth first from the carrier panels: toward[id] is the port that leads a device back, and the end it meets there.
  const queue = s.devices.filter((d) => kind(d.id) === "gateway" && up.has(d.id)).map((d) => d.id);
  const seen = new Set(queue), toward = new Map<string, { port: number; next: End }>();
  while (queue.length) {
    const id = queue.shift()!;
    out.get(id)!.forEach((l, port) => {
      const f = l && far({ device: id, port });
      if (!f || seen.has(f.device)) return;
      seen.add(f.device);
      toward.set(f.device, { port: f.port, next: { device: id, port } });
      if (kind(f.device) !== "server") queue.push(f.device);
    });
  }
  // Adds Mbit/s on every hop from a device toward the carrier panels, stopping at the device named by stop.
  const climb = (from: string, mbps: number, stop?: string) => {
    for (let id = from, t = toward.get(id); t && id !== stop; id = t.next.device, t = toward.get(id)) {
      out.get(id)![t.port]!.mbps += mbps;
      out.get(t.next.device)![t.next.port]!.mbps += mbps;
    }
  };
  const path = (from: string) => {
    const ids = [from];
    for (let t = toward.get(from); t; t = toward.get(t.next.device)) ids.push(t.next.device);
    return ids;
  };
  for (const d of s.devices) if (models.get(d.id)!.server && up.has(d.id)) climb(d.id, serverMbps(s, d));
  // A backup goes up from both ends to the first device their paths share.
  for (const f of backupFlows(s)) {
    if (!up.has(f.from) || !up.has(f.to)) continue;
    const there = new Set(path(f.to)), meet = path(f.from).find((id) => there.has(id));
    climb(f.from, f.mbps, meet);
    climb(f.to, f.mbps, meet);
  }
  for (const ls of out.values()) for (const l of ls) if (l) l.load = Math.min(1, l.mbps / (l.gbit * 1000));
  return out;
}

// economy.md, "Usage curves and overcommit": when customers outgrow their plan.
export const ASK_FILL = 0.9;
export const PEGGED = 0.9;
export const ASK_CHANCE = 1 / 7;
export const FULL_TICKET_CHANCE = 0.25;
export const FULL_PENALTY = 2;

// Each day at noon: a customer near the booked disk, or with CPU near 100% most of the week, asks for a bigger plan; a full
// disk breaks their site, costs happiness every day and makes them write in.
export function usageTick(s: GameState): SimEvent[] {
  if (s.hour % 24 !== 12) return [];
  let copied = false;
  for (const v of s.services) {
    const w = v.endedAt === null && !isSuspended(s, v.customerId) ? s.workloads.find((x) => x.serviceId === v.id && x.clusterId && !x.stopped) : undefined;
    const profile = w && s.customers.find((x) => x.id === v.customerId && x.churnedAt === null)?.profile;
    if (!w || !profile) continue;
    const fill = diskFill(s, w, s.hour), pegged = weekMedian(curveFor(v.product, profile)) * demand(s, v, s.hour) >= PEGGED;
    if (fill < ASK_FILL && !pegged) continue;
    if (!copied) { s.customers = s.customers.map((c) => ({ ...c })); copied = true; }
    const c = s.customers.find((x) => x.id === v.customerId)!;
    if (fill >= 1) bump(c, -FULL_PENALTY);
    if (s.tickets.some((t) => t.serviceId === v.id && !isFinal(t))) continue;
    const topic = fill >= 1 ? (chance(s.rng, FULL_TICKET_CHANCE) ? "full" : null) : chance(s.rng, ASK_CHANCE) ? (fill >= ASK_FILL ? "disk" : "cpu") : null;
    if (topic) createTicket(s, c, "upgrade", v.id, topic);
  }
  return [];
}
