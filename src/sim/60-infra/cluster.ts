import { modelById } from "../10-catalog/hardware";
import { yearOf } from "../00-core/time";
import { kindServing, oldestPhp, phpAt, softwareById, type SoftwareKind } from "../10-catalog/platforms";
import { OVERCOMMIT, PRODUCTS, type Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { isSuspended } from "../45-billing/billing";
import type { Device, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { linkStatus, raidUsable, rackPower, working } from "./status";

// Active takes new workloads, cordoned keeps its own, draining moves them off, maintenance is empty after a drain.
export type NodeState = "active" | "cordoned" | "draining" | "maintenance";
// php is the node's PHP version; after an upgrade its sites run slower up to and including the hour phpUntil.
export interface ClusterNode { deviceId: string; state: NodeState; php: string; phpUntil: number }
export type Placement = "pack" | "spread";
export type BackupEvery = "off" | "daily" | "weekly";
// A cluster lives in one availability zone; its nodes are servers mounted in that zone. panel and platform are the installed
// SOFTWARE ids, null until installed; controlPlane is the node that hosts their management services. While switching (an
// install or a change), the control plane is busy until doneAt. Backups copy every workload to the target cluster.
export interface Cluster {
  id: string; name: string; az: string; placement: Placement; nodes: ClusterNode[];
  panel: string | null; platform: string | null; controlPlane: string | null;
  switching: { kind: SoftwareKind; to: string; doneAt: number } | null;
  backup: { targetId: string | null; every: BackupEvery };
}
// One workload runs one service: on a cluster node (clusterId and deviceId), on a whole server (deviceId only), or in rack
// units for colocation (rackId, slot, units, watts). Resources are booked at placement; placedAt is the hour it last moved.
// A stopped workload keeps its booking; busyUntil is the hour a restore or cold migration finishes; backupAt the last backup.
export interface Workload extends Resources {
  id: string; serviceId: string; clusterId: string | null; deviceId: string | null; rackId: string | null; slot: number; units: number; watts: number; placedAt: number;
  stopped: boolean; busyUntil: number; backupAt: number | null;
}

// Defaults for saves from before platforms, backups and PHP versions; they ran FreePanel and Proxmocks and their nodes the save year's PHP.
export const clusterDefaults = (c: Partial<Cluster> & Pick<Cluster, "nodes">, hour = 0): Cluster => ({
  panel: "freepanel", platform: "proxmocks", switching: null, backup: { targetId: null, every: "off" }, ...c,
  nodes: c.nodes.map((n) => ({ ...n, php: n.php ?? phpAt(yearOf(hour)), phpUntil: n.phpUntil ?? -1 })),
  controlPlane: c.controlPlane === undefined ? c.nodes[0]?.deviceId ?? null : c.controlPlane,
}) as Cluster;
export const workloadDefaults = (w: Partial<Workload>): Workload => ({ stopped: false, busyUntil: 0, backupAt: null, ...w }) as Workload;

const ZERO: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
const KEYS = ["vcpu", "ramGb", "diskGb"] as const;

// What a node can book: physical cores, RAM and usable RAID disk times the overcommit ratios.
export function nodeCapacity(d: Device): Resources {
  const v = modelById(d.model).server;
  return v ? { vcpu: v.cores * OVERCOMMIT.cpu, ramGb: v.ramGb * OVERCOMMIT.ram, diskGb: raidUsable(d) * OVERCOMMIT.disk } : ZERO;
}

export function nodeUsed(s: GameState, deviceId: string): Resources {
  const used = { ...ZERO };
  for (const w of s.workloads) if (w.deviceId === deviceId && w.clusterId) for (const k of KEYS) used[k] += w[k];
  return used;
}

// What the management services of a cluster's panel and platform take on their node.
export function controlPlaneUse(c: Pick<Cluster, "panel" | "platform">): Resources {
  const a = c.panel ? softwareById(c.panel).controlPlane : ZERO, b = c.platform ? softwareById(c.platform).controlPlane : ZERO;
  return { vcpu: a.vcpu + b.vcpu, ramGb: a.ramGb + b.ramGb, diskGb: a.diskGb + b.diskGb };
}
const density = (c: Cluster) => (c.platform ? softwareById(c.platform).density : 1);

// What a node can book for workloads: its capacity times the platform's density, less the control plane it hosts.
export function bookable(s: GameState, d: Device): Resources {
  const cap = nodeCapacity(d), c = clusterOf(s, d.id);
  if (!c) return cap;
  const k = density(c), cp = c.controlPlane === d.id ? controlPlaneUse(c) : ZERO;
  return { vcpu: cap.vcpu * k - cp.vcpu, ramGb: cap.ramGb * k - cp.ramGb, diskGb: cap.diskGb * k - cp.diskGb };
}

// Whether a working node of the cluster has room for its control plane next to its workloads.
export function fitsControlPlane(s: GameState, c: Cluster, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !working(s, deviceId)) return false;
  const cap = nodeCapacity(d), used = nodeUsed(s, deviceId), cp = controlPlaneUse(c), k = density(c);
  return fits(used, { vcpu: cap.vcpu * k, ramGb: cap.ramGb * k, diskGb: cap.diskGb * k }, cp);
}

// Whether the cluster runs software that sells the product line.
export function supports(c: Cluster, p: Product): boolean {
  const kind = kindServing(p);
  return kind === "panel" ? !!c.panel : kind === "cloud" ? !!c.platform : false;
}
// Whether some installed control plane anywhere sells the product line; lines off clusters don't need one.
export const lineOffered = (s: GameState, p: Product): boolean =>
  PRODUCTS[p].runsOn !== "cluster" || (!PRODUCTS[p].ha && s.clusters.some((c) => supports(c, p) && c.nodes.length > 0));
// Why a product found no place: no software that sells it, or no room.
export function noRoomError(s: GameState, p: Product, clusterId: string | null = null): string {
  if (PRODUCTS[p].runsOn === "server") return "error.noFreeServer";
  if (!s.clusters.some((c) => (clusterId ? c.id === clusterId : true) && supports(c, p))) return kindServing(p) === "panel" ? "error.needsPanel" : "error.needsPlatform";
  return "error.noCapacity";
}

// Nothing can be started, moved, restored or sold on a cluster while its control plane is down or nothing is installed.
export function controlPlaneUp(s: GameState, c: Cluster): boolean {
  return !c.switching && (!!c.panel || !!c.platform) && !!c.controlPlane && c.nodes.some((n) => n.deviceId === c.controlPlane) && working(s, c.controlPlane);
}

// A cluster's sites run on its oldest node's PHP; an empty cluster would install the current one.
export const clusterPhp = (c: Cluster, hour: number): string => oldestPhp(c.nodes.map((n) => n.php)) ?? phpAt(yearOf(hour));

// The panel serves web spaces, the platform everything else on the cluster.
export const servedBy = (s: GameState, w: Workload): SoftwareKind =>
  s.services.find((v) => v.id === w.serviceId)?.product === "webHosting" ? "panel" : "cloud";

// A workload lost its disk when its server's data was lost after the workload was placed there.
export function lostDisk(s: GameState, w: Workload): boolean {
  const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  return !!d && d.dataLost !== null && d.dataLost >= w.placedAt;
}

// The busiest resource's share of capacity.
const load = (used: Resources, cap: Resources) => Math.max(...KEYS.map((k) => (cap[k] ? used[k] / cap[k] : 1)));
const fits = (used: Resources, cap: Resources, r: Resources) => KEYS.every((k) => used[k] + r[k] <= cap[k] + 1e-9);

export const clusterOf = (s: GameState, deviceId: string): Cluster | undefined => s.clusters.find((c) => c.nodes.some((n) => n.deviceId === deviceId));
export const workloadsOf = (s: GameState, serviceId: string): Workload[] => s.workloads.filter((w) => w.serviceId === serviceId);
export const workloadsOn = (s: GameState, deviceId: string): Workload[] => s.workloads.filter((w) => w.deviceId === deviceId);
// A server taken by a cluster or rented whole as a dedicated server.
export const serverTaken = (s: GameState, deviceId: string): boolean => !!clusterOf(s, deviceId) || s.workloads.some((w) => w.deviceId === deviceId);

// The scheduler: active, working nodes with room; pack picks the busiest of them, spread the idlest. Ties keep node order.
export function pickNode(s: GameState, cluster: Cluster, r: Resources, skip: string | null = null): string | null {
  let best: { id: string; load: number } | null = null;
  for (const n of cluster.nodes) {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active" || n.deviceId === skip || !working(s, d.id)) continue;
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    if (!fits(used, cap, r)) continue;
    const l = load(used, cap);
    if (!best || (cluster.placement === "pack" ? l > best.load : l < best.load)) best = { id: d.id, load: l };
  }
  return best?.id ?? null;
}

// Moves every workload it can off a draining node; an emptied node goes into maintenance. Returns the workloads left.
export function moveOff(s: GameState, cluster: Cluster, deviceId: string): number {
  // ponytail: migrations are instant; economy.md's migration times and two moves per node come with link bandwidth.
  let left = 0;
  for (const w of s.workloads.filter((x) => x.deviceId === deviceId && x.clusterId === cluster.id)) {
    const to = pickNode(s, cluster, w, deviceId);
    if (!to) left++;
    else s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, deviceId: to, placedAt: s.hour } : x));
  }
  if (!left) setNodeState(s, deviceId, "maintenance");
  const to = !left && cluster.controlPlane === deviceId && cluster.nodes.find((n) => n.deviceId !== deviceId && n.state === "active" && fitsControlPlane(s, cluster, n.deviceId));
  if (to) s.clusters = s.clusters.map((c) => (c.id === cluster.id ? { ...c, controlPlane: to.deviceId } : c));
  return left;
}

export function setNodeState(s: GameState, deviceId: string, state: NodeState) {
  s.clusters = s.clusters.map((c) => (c.nodes.some((n) => n.deviceId === deviceId) ? { ...c, nodes: c.nodes.map((n) => (n.deviceId === deviceId ? { ...n, state } : n)) } : c));
}

// A workload on a server is up while the server reaches the internet and still holds the data written since it was placed.
// Colocation is up while its rack has power.
// ponytail: colocation ignores the customer's uplinks until colocation cabling lands.
export function workloadOnline(s: GameState, w: Workload): boolean {
  if (w.stopped || w.busyUntil > s.hour) return false;
  const c = w.clusterId ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
  if (c?.switching && c.switching.kind === servedBy(s, w)) return false;
  // Web sites taken offline for maintenance or compromised.
  if (c && w.deviceId && (s.security.offline.includes(w.deviceId) || s.security.hacked.includes(w.deviceId)) && servedBy(s, w) === "panel") return false;
  if (w.deviceId) {
    const d = s.devices.find((x) => x.id === w.deviceId);
    return !!d && !lostDisk(s, w) && linkStatus(s, d.id).online;
  }
  const rack = s.racks.find((r) => r.id === w.rackId);
  const loc = rack && s.locations.find((l) => l.id === rack.locationId);
  return !!rack && !!loc && loc.readyAt <= s.hour && rack.arriveAt === null && !rackPower(s, rack.id).tripped;
}

// A service without workloads (resold domains, certificates, contracts from before placement) is always up.
export const workloadsUp = (s: GameState, serviceId: string): boolean => workloadsOf(s, serviceId).every((w) => workloadOnline(s, w));

// Hourly: frees the workloads of ended services, keeps draining nodes moving and counts each live service's hours down this month.
export function computeTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const live = new Set(s.services.filter((v) => v.endedAt === null).map((v) => v.id));
  if (s.workloads.some((w) => !live.has(w.serviceId))) s.workloads = s.workloads.filter((w) => live.has(w.serviceId));
  for (const c of s.clusters) {
    for (const n of c.nodes) {
      if (n.state !== "draining" || moveOff(s, s.clusters.find((x) => x.id === c.id)!, n.deviceId)) continue;
      const d = s.devices.find((x) => x.id === n.deviceId)!;
      events.push({ app: "Locations", key: "event.drained", params: { device: d.label ?? d.name } });
    }
  }
  const down = [...new Set(s.workloads.map((w) => w.serviceId))].filter((id) => !workloadsUp(s, id) && !isSuspended(s, s.services.find((v) => v.id === id)!.customerId));
  if (down.length) s.downHours = { ...s.downHours, ...Object.fromEntries(down.map((id) => [id, (s.downHours[id] ?? 0) + 1])) };
  return events;
}
