import { chance, hashRng, rand } from "../00-core/rng";
import { licenceExpired } from "./licence";
import { dateOf, yearOf } from "../00-core/time";
import { isOobPort, jacksOf, modelById } from "../10-catalog/hardware";
import type { Resources } from "../10-catalog/products";
import { REPLICA_COST, replicaDue } from "./replica";
import { BACKUP_CHANGED, curveFor, curveLoad, daySwing, growthRate, idNum, JOB_CPU, nightJob, weekMedian } from "../10-catalog/usage";
import type { Service } from "../30-customers/customers";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import { serviceHeld } from "../45-billing/billing";
import type { Device, End, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { booked, liveRam, oomKilled, clustersOn, controlPlanesOn, controlPlaneUp, controlPlaneUse, hostsOfVm, insideVm, isOwnVm, lostDisk, nodeVcpu, workloadsOf, workloadsOn, type Workload } from "./cluster";
import { serviceMbps } from "./network";
import { interestAt, modById, titleById } from "../10-catalog/games";
import { fillOf } from "../30-customers/resellers";
import { machineScreen } from "./oob";
import { cpuLoad, installedRamGb, portPeers, raidUsable, working } from "./status";
import { THERMAL, throttled } from "./thermal";

// economy.md: memory stays mostly resident, disks fill from 30% of booked at signup at the customer's growth rate up to the booked limit.
const RAM_BASE = 0.6;
const yearsSince = (since: number, hour: number) => Math.max(0, hour - since) / 8760;
export function diskFill(s: GameState, w: Workload, hour: number): number {
  const v = s.services.find((x) => x.id === w.serviceId);
  return Math.min(1, 0.3 + growthRate(s.seed, v?.customerId ?? w.serviceId, "disk") * yearsSince(v?.startedAt ?? w.placedAt, hour));
}

// How much more CPU a customer needs than in their first month, from their growth rate.
const demand = (s: GameState, v: Service, hour: number) => 1 + growthRate(s.seed, v.customerId, "cpu") * yearsSince(v.startedAt, hour);

// A workload's load at an hour: its customer's curve times its day's swing and their grown demand with ±20% jitter drawn from the seed, plus their
// night job. Stopped, restoring and lost workloads idle.
// A held account serves a parked page.
export const HELD_LOAD = 0.02;

export function workloadLoad(s: GameState, w: Workload, hour: number): number {
  if (w.stopped || w.busyUntil > hour || oomKilled(w, hour) || lostDisk(s, w)) return 0;
  const v = s.services.find((x) => x.id === w.serviceId), c = v && s.customers.find((x) => x.id === v.customerId);
  if (!v || !c) return 0;
  if (serviceHeld(s, v)) return HELD_LOAD;
  const jitter = 1 + 0.4 * (rand(hashRng(s.seed, idNum(w.id), hour)) - 0.5);
  return Math.min(1, curveLoad(curveFor(v.product, c.profile, s.seed, c.id), hour) * daySwing(s.seed, w.id, hour) * demand(s, v, hour) * jitter * titleInterest(s, v, hour) + JOB_CPU * nightJob(s.seed, c.id, hour));
}

// The player's cluster backups this hour: each source node sends its workloads' changed data to the target's control plane.
// ponytail: a backup to another zone lights the LAN ports only; bill it on the uplinks if cross-zone backups get common.
export interface BackupFlow { from: string; to: string; mbps: number }
export function backupFlows(s: GameState, hour: number = s.hour): BackupFlow[] {
  const d = dateOf(hour);
  const flows = new Map<string, BackupFlow>();
  for (const c of s.clusters) {
    for (const j of c.jobs) {
      const t = s.clusters.find((x) => x.id === j.targetId), to = t?.controlPlane;
      if (j.hour !== d.getUTCHours() || !t || !to || !controlPlaneUp(s, t) || licenceExpired(s, t) || (j.every === "weekly" && d.getUTCDay() !== 0)) continue;
      for (const w of s.workloads) {
        if (w.clusterId !== c.id || !w.deviceId || w.deviceId === to || w.stopped || lostDisk(s, w) || (j.workloadIds && !j.workloadIds.includes(w.id))) continue;
        const f = flows.get(`${w.deviceId}>${to}`) ?? { from: w.deviceId, to, mbps: 0 };
        f.mbps += (w.diskGb * diskFill(s, w, hour) * BACKUP_CHANGED * 8000) / 3600;
        flows.set(`${w.deviceId}>${to}`, f);
      }
    }
  }
  // A replica sends its changed data to the second node when a copy is due.
  for (const w of s.workloads) {
    const r = w.replica;
    if (!r || !w.deviceId || w.stopped || lostDisk(s, w) || !replicaDue(r.every, hour)) continue;
    const f = flows.get(`${w.deviceId}>${r.toNode}`) ?? { from: w.deviceId, to: r.toNode, mbps: 0 };
    f.mbps += (w.diskGb * diskFill(s, w, hour) * BACKUP_CHANGED * REPLICA_COST[r.every] * 8000) / 3600;
    flows.set(`${w.deviceId}>${r.toNode}`, f);
  }
  return [...flows.values()];
}
const flowMbps = (s: GameState, id: string) => backupFlows(s).reduce((n, f) => n + (f.from === id || f.to === id ? f.mbps : 0), 0);

// A machine running only its OS still shows load: a little at the login, most of a core while it installs or boots.
// Panels and platforms count their own through their control plane instead.
// ponytail: reads the screen now, so a past hour shows today's state; track install history if peaks need it.
function osUse(s: GameState, id: string, cpus: number, ramGb: number, hour: number): Resources {
  if (clustersOn(s, id).some((c) => c.panel || c.platform)) return { vcpu: 0, ramGb: 0, diskGb: 0 };
  const k = machineScreen(s, id).kind, busy = k === "osInstall" || k === "installing" || k === "booting";
  if (!busy && k !== "login" && k !== "desktop") return { vcpu: 0, ramGb: 0, diskGb: 0 };
  const r = rand(hashRng(s.seed, idNum(id), hour));
  return { vcpu: Math.min(cpus, busy ? 0.6 + 0.4 * r : 0.02 + 0.06 * r), ramGb: Math.min(ramGb * (busy ? 0.4 : 0.15), busy ? 1 : 0.5) * (0.9 + 0.2 * r), diskGb: 0 };
}

// A game server on a faded title has fewer players on.
function titleInterest(s: GameState, v: Service, hour: number): number {
  const t = v.product === "gameServer" ? titleById(s.gameServers.find((g) => g.serviceId === v.id)?.title ?? "") : undefined;
  return t ? interestAt(t, yearOf(hour)) : 1;
}

// What a game server's mods multiply its resource use by.
const modLoad = (s: GameState, serviceId: string): number => (s.gameServers.find((g) => g.serviceId === serviceId)?.mods ?? []).reduce((n, id) => n * (modById(id)?.load ?? 1), 1);

// What a workload uses of its booking at an hour; a panel VM uses what its panel and web spaces use.
export function workloadUse(s: GameState, w: Workload, hour: number = s.hour): Resources {
  if (isOwnVm(w)) {
    const hosts = hostsOfVm(s, w.id), u: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
    if (w.stopped || lostDisk(s, w)) return u;
    const parts = [...hosts.map((h) => controlPlaneUse(s, h)), ...insideVm(s, w.id).map((x) => workloadUse(s, x, hour)), osUse(s, w.id, w.vcpu, w.ramGb, hour)];
    for (const p of parts) { u.vcpu += p.vcpu; u.ramGb += p.ramGb; u.diskGb += p.diskGb; }
    return u;
  }
  if (w.frozen) return { vcpu: 0, ramGb: 0, diskGb: w.diskGb * diskFill(s, w, hour) };
  const load = workloadLoad(s, w, hour), lost = lostDisk(s, w), mods = modLoad(s, w.serviceId), busy = Math.min(1, load * mods);
  const fill = fillOf(s, w.serviceId);
  const grow = (k: "vcpu" | "ramGb" | "diskGb") => fill * (w.promised && w[k] > 0 ? w.promised[k] / w[k] : 1);
  return { vcpu: booked(s, w).vcpu * grow("vcpu") * load * mods, ramGb: w.stopped || lost || oomKilled(w, hour) ? 0 : w.ramGb * grow("ramGb") * (RAM_BASE + (1 - RAM_BASE) * busy), diskGb: lost ? 0 : w.diskGb * grow("diskGb") * diskFill(s, w, hour) };
}

liveRam.of = (s, w) => workloadUse(s, w).ramGb;

// What a node physically has and uses at an hour, and the performance its workloads get: CPU contention slows everyone by
// cores ÷ busy vCPUs, a disk pool over 100% stalls writes to 50%, a full-VM node past its RAM swaps.
// economy.md, RAID: the share of its performance a node keeps while its array rebuilds, by rebuild rate.
export const REBUILD_PERF = { low: 0.95, medium: 0.8, high: 0.6 } as const;
export interface NodeUsage { used: Resources; physical: Resources; perf: number }

export function nodeUsage(s: GameState, deviceId: string, hour: number = s.hour): NodeUsage {
  const d = s.devices.find((x) => x.id === deviceId), v = d && modelById(d.model).server;
  if (!d || !v) { const used = { vcpu: 0, ramGb: 0, diskGb: 0 }; return { used, physical: { ...used }, perf: 1 }; }
  const { used, physical } = nodeLoad(s, d, hour);
  const cpu = used.vcpu > physical.vcpu ? physical.vcpu / used.vcpu : 1;
  const disk = used.diskGb > physical.diskGb ? 0.5 : 1;
  const heat = throttled(s, d) ? THERMAL.throttlePerf : 1;
  const over = used.ramGb / physical.ramGb - 1, ovz = clustersOn(s, deviceId).some((c) => c.kind === "cloud" && c.platform === "openveezee");
  const swap = over > 0 && !ovz ? 1 / (1 + SWAP_SLOW * over) : 1;
  return { used, physical, perf: Math.min(cpu, disk, swap) * (d.rebuild ? REBUILD_PERF[d.rebuildRate] : 1) * heat };
}

// economy.md, What runs over: a full-VM node swaps up to SWAP_MAX of its RAM, losing SWAP_SLOW × the overcommit in speed;
// past it the host OOM-kills its largest VM (vmOomTick). OpenVeeZee hands RAM pressure to its beancounters instead.
export const SWAP_MAX = 1.1, SWAP_SLOW = 5;
export const ramShare = (u: NodeUsage) => u.used.ramGb / Math.max(1e-9, u.physical.ramGb);

// What a node uses and physically has, before performance; heat reads this through power draw, so it cannot ask for perf.
function nodeLoad(s: GameState, d: Device, hour: number): { used: Resources; physical: Resources } {
  const deviceId = d.id, used: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
  for (const cp of [controlPlanesOn(s, deviceId), osUse(s, deviceId, nodeVcpu(s, d), installedRamGb(d), hour)]) {
    used.vcpu += cp.vcpu; used.ramGb += cp.ramGb; used.diskGb += cp.diskGb;
  }
  for (const w of s.workloads) {
    if (w.deviceId !== deviceId || !w.clusterId) continue;
    const u = workloadUse(s, w, hour);
    used.vcpu += u.vcpu; used.ramGb += u.ramGb; used.diskGb += u.diskGb;
  }
  return { used, physical: { vcpu: nodeVcpu(s, d), ramGb: installedRamGb(d), diskGb: raidUsable(d) } };
}

// A server's CPU utilisation from 0 to 1: its cluster share plus any whole-server rental on it.
// ponytail: cached per hour and workloads array, so a workload edited in place changes the draw from the next hour.
const utilCache = new WeakMap<GameState, { hour: number; workloads: Workload[]; by: Map<string, number> }>();
export function cpuUtil(s: GameState, d: Device): number {
  let c = utilCache.get(s);
  if (!c || c.hour !== s.hour || c.workloads !== s.workloads) utilCache.set(s, (c = { hour: s.hour, workloads: s.workloads, by: new Map() }));
  let u = c.by.get(d.id);
  if (u === undefined) c.by.set(d.id, (u = computeCpuUtil(s, d)));
  return u;
}
function computeCpuUtil(s: GameState, d: Device): number {
  if (!modelById(d.model).server) return 1;
  const u = nodeLoad(s, d, s.hour);
  const v = s.workloads.reduce((n, w) => (w.deviceId === d.id && !w.clusterId && !w.stopped ? n + workloadUse(s, w).vcpu : n), u.used.vcpu);
  return u.physical.vcpu ? Math.min(1, v / u.physical.vcpu) : 1;
}
cpuLoad.of = cpuUtil;

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
  if (isOwnVm(w)) return insideVm(s, w.id).reduce((n, x) => n + workloadMbps(s, x), 0);
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
    const w = v.endedAt === null && !serviceHeld(s, v) ? s.workloads.find((x) => x.serviceId === v.id && x.clusterId && !x.stopped) : undefined;
    const profile = w && s.customers.find((x) => x.id === v.customerId && x.churnedAt === null)?.profile;
    if (!w || !profile) continue;
    const fill = diskFill(s, w, s.hour), pegged = weekMedian(curveFor(v.product, profile, s.seed, v.customerId)) * demand(s, v, s.hour) >= PEGGED;
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
