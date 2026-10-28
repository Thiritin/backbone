import { hashRng, rand } from "../00-core/rng";
import { jacksOf, modelById } from "../10-catalog/hardware";
import type { Resources } from "../10-catalog/products";
import { curveFor, curveLoad } from "../10-catalog/usage";
import type { Device, End, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
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
// cores ÷ busy vCPUs, a disk pool over 100% stalls writes to 50%, a PHP upgrade slows it to 70%. RAM over 100% freezes the
// node instead (freezeTick).
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
  const disk = used.diskGb > physical.diskGb ? 0.5 : 1;
  const php = c && hour <= (c.nodes.find((n) => n.deviceId === deviceId)?.phpUntil ?? -1) ? PHP_SLOW : 1;
  return { used, physical, perf: Math.min(cpu, disk, php) };
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
    return p && kind(p.device) !== "patch" ? p : null;
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
  for (const d of s.devices) {
    if (!models.get(d.id)!.server || !up.has(d.id)) continue;
    const mbps = serverMbps(s, d);
    for (let id = d.id, t = toward.get(id); t; id = t.next.device, t = toward.get(id)) {
      out.get(id)![t.port]!.mbps += mbps;
      out.get(t.next.device)![t.next.port]!.mbps += mbps;
    }
  }
  for (const ls of out.values()) for (const l of ls) if (l) l.load = Math.min(1, l.mbps / (l.gbit * 1000));
  return out;
}
