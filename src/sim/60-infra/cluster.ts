import { modelById } from "../10-catalog/hardware";
import { yearOf } from "../00-core/time";
import { IN_VM, kindServing, phpAt, softwareById, type Software, type SoftwareKind } from "../10-catalog/platforms";
import { OVERCOMMIT, PRODUCTS, type Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { isSuspended } from "../45-billing/billing";
import type { Device, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { installedCores, installedRamGb, linkStatus, locationOf, raidUsable, rackPower, working } from "./status";
import { hasPublicAddress, sellsFrom } from "./addresses";

// Active takes new workloads, cordoned keeps its own, draining moves them off, maintenance is empty after a drain.
export type NodeState = "active" | "cordoned" | "draining" | "maintenance";
export interface ClusterNode { deviceId: string; state: NodeState }
export type Placement = "pack" | "spread";
export type BackupEvery = "off" | "daily" | "weekly";
// High availability, per hypervisor cluster once researched: live migration, auto-balancing and automatic failover.
export interface Ha { live: boolean; balance: boolean; failover: boolean }
export const HA_OFF: Ha = { live: false, balance: false, failover: false };
// Every server runs at most one control plane. A cluster is either a hypervisor cluster (kind "cloud": one or more servers
// with the same hypervisor, hosting virtual machines) or a panel host (kind "panel": web hosting on one bare-metal server in
// nodes, or inside the player's own virtual machine vm on a hypervisor cluster, with nodes empty). panel and platform hold
// the installed software of the kind, null until installed; controlPlane is the node that runs it, null for a panel VM.
// While switching (an install or a change), the control plane is busy until doneAt. Backups copy every workload to the
// target cluster. ramGuard (Memory reservation) keeps booked RAM within each node's installed RAM. php and phpUntil are a
// panel host's PHP version; after an upgrade its sites run slower up to and including the hour phpUntil.
export interface Cluster {
  id: string; name: string; az: string; kind: SoftwareKind; placement: Placement; nodes: ClusterNode[];
  panel: string | null; platform: string | null; vm: string | null; controlPlane: string | null;
  switching: { kind: SoftwareKind; to: string; doneAt: number } | null;
  backup: { targetId: string | null; every: BackupEvery };
  ramGuard?: boolean;
  php: string; phpUntil: number; ha: Ha;
}
// One workload runs one service: on a hypervisor node or bare-metal panel server (clusterId and deviceId), inside a panel
// VM (clusterId of the panel host, no deviceId), on a whole server (deviceId only), or in rack units for colocation (rackId,
// slot, units, watts). The player's own panel VMs have no service. Resources are booked at placement; placedAt is the hour
// it last moved. A stopped workload keeps its booking; busyUntil is the hour a restore or cold migration finishes; backupAt
// the last backup; stuck marks a VM that failover found no room for; migrating is a web space on its way to a panel host,
// moved at the hour doneAt.
export interface Workload extends Resources {
  id: string; serviceId: string; clusterId: string | null; deviceId: string | null; rackId: string | null; slot: number; units: number; watts: number; placedAt: number;
  stopped: boolean; busyUntil: number; backupAt: number | null; stuck?: boolean; migrating?: { clusterId: string; doneAt: number };
}

// Old saves are converted by upgradeCompute; this fills the fields every cluster has.
export const clusterDefaults = (c: Partial<Cluster> & Pick<Cluster, "nodes">, hour = 0): Cluster => ({
  panel: null, platform: null, vm: null, switching: null, backup: { targetId: null, every: "off" }, php: phpAt(yearOf(hour)), phpUntil: -1, ...c,
  ha: { ...HA_OFF, ...c.ha },
  controlPlane: c.controlPlane === undefined ? c.nodes[0]?.deviceId ?? null : c.controlPlane,
}) as Cluster;
export const workloadDefaults = (w: Partial<Workload>): Workload => ({ stopped: false, busyUntil: 0, backupAt: null, ...w }) as Workload;

const ZERO: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
export const KEYS = ["vcpu", "ramGb", "diskGb"] as const;
const minus = (a: Resources, b: Resources): Resources => ({ vcpu: a.vcpu - b.vcpu, ramGb: a.ramGb - b.ramGb, diskGb: a.diskGb - b.diskGb });

// What a node can book: physical cores, RAM and usable RAID disk times the overcommit ratios its software allows.
export function nodeCapacity(d: Device, sw: Software | null = null): Resources {
  const v = modelById(d.model).server, r = sw?.overcommit ?? OVERCOMMIT;
  return v ? { vcpu: installedCores(d) * r.cpu, ramGb: installedRamGb(d) * r.ram, diskGb: raidUsable(d) * OVERCOMMIT.disk } : ZERO;
}
const softwareOf = (c: Pick<Cluster, "panel" | "platform">): Software | null => { const id = c.panel ?? c.platform; return id ? softwareById(id) : null; };

// What the workloads on a server book; web spaces inside a panel VM count in the VM's booking.
export function nodeUsed(s: GameState, deviceId: string): Resources {
  const used = { ...ZERO };
  for (const w of s.workloads) if (w.deviceId === deviceId && w.clusterId) for (const k of KEYS) used[k] += w[k];
  return used;
}

// What the management services of a cluster's software take.
export function controlPlaneUse(c: Pick<Cluster, "panel" | "platform">): Resources {
  const id = c.panel ?? c.platform;
  return id ? softwareById(id).controlPlane : ZERO;
}
const density = (c: Cluster) => (c.platform ? softwareById(c.platform).density : 1);

// What a node can book for workloads: its capacity times the hypervisor's density, less the control plane it runs. With
// Memory reservation on, or for automatic placement (guard), RAM stops at the installed RAM.
export function bookable(s: GameState, d: Device, guard = false): Resources {
  const c = clusterOf(s, d.id), cap = nodeCapacity(d, c ? softwareOf(c) : null);
  if (!c) return cap;
  const k = density(c), cp = c.controlPlane === d.id ? controlPlaneUse(c) : ZERO;
  const ram = c.ramGuard || guard ? Math.min(cap.ramGb * k, installedRamGb(d)) : cap.ramGb * k;
  return { vcpu: cap.vcpu * k - cp.vcpu, ramGb: ram - cp.ramGb, diskGb: cap.diskGb * k - cp.diskGb };
}

// The player's own VM a panel host runs in, or the VM a web space inside it runs in.
export const vmById = (s: GameState, id: string | null): Workload | undefined => (id ? s.workloads.find((w) => w.id === id) : undefined);
export function vmOf(s: GameState, w: Workload): Workload | undefined {
  if (!w.clusterId || w.deviceId) return undefined;
  return vmById(s, s.clusters.find((c) => c.id === w.clusterId)?.vm ?? null);
}
// The server a workload runs on, through its panel VM for a web space in one.
export const serverOf = (s: GameState, w: Workload): string | null => w.deviceId ?? vmOf(s, w)?.deviceId ?? null;
export const hostOfVm =(s: GameState, vmId: string): Cluster | undefined => s.clusters.find((c) => c.vm === vmId);
export const isOwnVm = (w: Workload): boolean => !w.serviceId;
// The server a panel host runs on: its bare-metal node or its VM's node.
export const anchorOf = (s: GameState, c: Cluster): string | null => c.nodes[0]?.deviceId ?? vmById(s, c.vm)?.deviceId ?? null;

// What software in a VM of that size can book: CPU and RAM at IN_VM of bare metal, less the panel.
export const vmCap = (r: Resources, panel: Resources): Resources => minus({ vcpu: r.vcpu * IN_VM, ramGb: r.ramGb * IN_VM, diskGb: r.diskGb }, panel);
// A panel VM's room: its booking less the panel, and what its web spaces book.
export function vmRoom(s: GameState, c: Cluster): { cap: Resources; used: Resources } {
  const vm = vmById(s, c.vm), used = { ...ZERO };
  for (const w of s.workloads) if (w.clusterId === c.id) for (const k of KEYS) used[k] += w[k];
  return { cap: vm ? vmCap(vm, controlPlaneUse(c)) : ZERO, used };
}

// Whether a working node of the cluster has room for its control plane next to its workloads.
export function fitsControlPlane(s: GameState, c: Cluster, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !working(s, deviceId)) return false;
  const cap = nodeCapacity(d, softwareOf(c)), used = nodeUsed(s, deviceId), cp = controlPlaneUse(c), k = density(c);
  return fits(used, { vcpu: cap.vcpu * k, ramGb: cap.ramGb * k, diskGb: cap.diskGb * k }, cp);
}

// Whether the cluster sells the product line: web hosting on a panel host, virtual machines on a hypervisor cluster, and
// products that need high availability only with automatic failover on.
export function supports(c: Cluster, p: Product): boolean {
  const kind = kindServing(p);
  if (!kind || c.kind !== kind || !(kind === "panel" ? c.panel : c.platform)) return false;
  return !PRODUCTS[p].ha || c.ha.failover;
}
export const hasHosts = (c: Cluster): boolean => c.nodes.length > 0 || !!c.vm;
// Whether the internet reaches a cluster: its panel VM or one of its servers has a public address.
export const clusterReachable = (s: GameState, c: Cluster): boolean =>
  c.vm ? hasPublicAddress(s, c.vm) : c.nodes.some((n) => linkStatus(s, n.deviceId).online && hasPublicAddress(s, n.deviceId));
// Whether the player can deliver the product line anywhere: a reachable cluster with software that sells it, a spare
// reachable server for dedicated servers, a rented location for colocation (gdd.md, Addresses and internet, The start).
export function lineOffered(s: GameState, p: Product): boolean {
  const runsOn = PRODUCTS[p].runsOn;
  const sells = (az: string | undefined) => { const l = s.locations.find((x) => x.az === az); return !!l && sellsFrom(s, l, p); };
  if (runsOn === "cluster") return s.clusters.some((c) => supports(c, p) && hasHosts(c) && clusterReachable(s, c) && sells(c.az));
  if (runsOn === "server") return s.devices.some((d) => d.rackId && modelById(d.model).server && !serverTaken(s, d.id) && linkStatus(s, d.id).online && hasPublicAddress(s, d.id) && sells(locationOf(s, d)?.az));
  return runsOn === "none" || s.locations.some((l) => l.dc);
}
// Why a product found no place: no software that sells it, no failover for a product that needs it, or no room.
export function noRoomError(s: GameState, p: Product, clusterId: string | null = null): string {
  if (PRODUCTS[p].runsOn === "server") return "error.noFreeServer";
  if (PRODUCTS[p].runsOn === "rack") return "error.needsDatacenter";
  const kind = kindServing(p), mine = s.clusters.filter((c) => (clusterId ? c.id === clusterId : true) && c.kind === kind && (c.panel || c.platform));
  if (!mine.length) return kind === "panel" ? "error.needsPanel" : "error.needsPlatform";
  if (!mine.some((c) => supports(c, p))) return "error.needsHaCluster";
  if (!mine.some((c) => clusterReachable(s, c))) return "error.needsInternet";
  if (!mine.some((c) => s.locations.some((l) => l.az === c.az && sellsFrom(s, l, p)))) return "error.needsStaticLine";
  return "error.noCapacity";
}

// Nothing can be started, moved, restored or sold on a cluster while its control plane is down or nothing is installed.
// A panel VM's control plane is up while the VM runs.
export function controlPlaneUp(s: GameState, c: Cluster): boolean {
  if (c.switching || !(c.panel || c.platform)) return false;
  if (c.vm) { const vm = vmById(s, c.vm); return !!vm && workloadOnline(s, vm); }
  return !!c.controlPlane && c.nodes.some((n) => n.deviceId === c.controlPlane) && working(s, c.controlPlane);
}

// The kind of software that serves a workload: the panel of a panel host, otherwise the hypervisor.
export const servedBy = (s: GameState, w: Workload): SoftwareKind => s.clusters.find((c) => c.id === w.clusterId)?.kind ?? "cloud";

// A workload lost its disk when its server's data was lost after the workload was placed there; a web space in a panel VM
// loses it with the VM.
export function lostDisk(s: GameState, w: Workload): boolean {
  const vm = vmOf(s, w);
  if (vm) return lostDisk(s, vm);
  const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  return !!d && d.dataLost !== null && d.dataLost >= w.placedAt;
}

// The busiest resource's share of capacity.
export const load = (used: Resources, cap: Resources) => Math.max(...KEYS.map((k) => (cap[k] ? used[k] / cap[k] : 1)));
export const fits = (used: Resources, cap: Resources, r: Resources) => KEYS.every((k) => used[k] + r[k] <= cap[k] + 1e-9);

export const clusterOf = (s: GameState, deviceId: string): Cluster | undefined => s.clusters.find((c) => c.nodes.some((n) => n.deviceId === deviceId));
export const workloadsOf = (s: GameState, serviceId: string): Workload[] => s.workloads.filter((w) => w.serviceId === serviceId);
export const workloadsOn = (s: GameState, deviceId: string): Workload[] => s.workloads.filter((w) => w.deviceId === deviceId);
// A server taken by a cluster or rented whole as a dedicated server.
export const serverTaken = (s: GameState, deviceId: string): boolean => !!clusterOf(s, deviceId) || s.workloads.some((w) => w.deviceId === deviceId);

// The scheduler: active, working nodes with room; pack picks the busiest of them, spread the idlest. Ties keep node order.
// A panel VM is its one node: it returns the VM's id while the VM runs and has room. RAM is booked only up to the installed
// RAM; overbooking RAM takes the player's choice of node (overbook).
export function pickNode(
  s: GameState, cluster: Cluster, r: Resources, skip: string | null = null, overbook = false, placement: Placement = cluster.placement,
): string | null {
  if (cluster.vm) {
    const vm = vmById(s, cluster.vm), room = vmRoom(s, cluster);
    return vm && !vm.stopped && vm.deviceId && working(s, vm.deviceId) && fits(room.used, room.cap, r) ? vm.id : null;
  }
  let best: { id: string; load: number } | null = null;
  for (const n of cluster.nodes) {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active" || n.deviceId === skip || !working(s, d.id)) continue;
    const cap = bookable(s, d, !overbook), used = nodeUsed(s, d.id);
    if (!fits(used, cap, r)) continue;
    const l = load(used, cap);
    if (!best || (placement === "pack" ? l > best.load : l < best.load)) best = { id: d.id, load: l };
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
  if (!left) moveControlPlaneOff(s, cluster.id, deviceId);
  return left;
}

// Hands the control plane to another active node with room when its node is going away.
export function moveControlPlaneOff(s: GameState, clusterId: string, deviceId: string): boolean {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || c.controlPlane !== deviceId) return false;
  const to = c.nodes.find((n) => n.deviceId !== deviceId && n.state === "active" && fitsControlPlane(s, c, n.deviceId));
  if (to) s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, controlPlane: to.deviceId } : x));
  return !!to;
}

export function setNodeState(s: GameState, deviceId: string, state: NodeState) {
  s.clusters = s.clusters.map((c) => (c.nodes.some((n) => n.deviceId === deviceId) ? { ...c, nodes: c.nodes.map((n) => (n.deviceId === deviceId ? { ...n, state } : n)) } : c));
}

// The web sites of a panel host the player took offline or that were compromised.
export const sitesDown = (s: GameState, hostId: string): boolean => s.security.offline.includes(hostId) || s.security.hacked.includes(hostId);

// A workload on a server is up while the server reaches the internet and still holds the data written since it was placed.
// A web space in a panel VM is up while the VM is. Colocation is up while its rack has power.
// ponytail: colocation ignores the customer's uplinks until colocation cabling lands.
export function workloadOnline(s: GameState, w: Workload): boolean {
  if (w.stopped || w.busyUntil > s.hour) return false;
  const c = w.clusterId ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
  if (c?.switching) return false;
  if (c?.kind === "panel" && sitesDown(s, c.id)) return false;
  if (c?.vm) { const vm = vmById(s, c.vm); return !!vm && workloadOnline(s, vm); }
  if (c && w.deviceId && s.frozen.includes(w.deviceId)) return false;
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

// Hourly: frees the workloads of ended services and the player's VMs on gone clusters, keeps draining nodes moving and counts each live
// service's hours down this month.
export function computeTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const live = new Set(s.services.filter((v) => v.endedAt === null).map((v) => v.id));
  const keep = (w: Workload) => (isOwnVm(w) ? s.clusters.some((c) => c.id === w.clusterId) : live.has(w.serviceId));
  if (s.workloads.some((w) => !keep(w))) s.workloads = s.workloads.filter(keep);
  for (const c of s.clusters) {
    for (const n of c.nodes) {
      if (n.state !== "draining" || moveOff(s, s.clusters.find((x) => x.id === c.id)!, n.deviceId)) continue;
      const d = s.devices.find((x) => x.id === n.deviceId)!;
      events.push({ app: "Locations", key: "event.drained", params: { device: d.label ?? d.name } });
    }
  }
  const ids = [...new Set(s.workloads.filter((w) => !isOwnVm(w)).map((w) => w.serviceId))];
  const down = ids.filter((id) => !workloadsUp(s, id) && !isSuspended(s, s.services.find((v) => v.id === id)!.customerId));
  if (down.length) s.downHours = { ...s.downHours, ...Object.fromEntries(down.map((id) => [id, (s.downHours[id] ?? 0) + 1])) };
  return events;
}
