import { modelById } from "../10-catalog/hardware";
import { START_YEAR, yearOf } from "../00-core/time";
import { GPU_SKILL } from "../10-catalog/research";
import { IN_VM, kindsServing, kindServing, phpAt, softwareById, type SoftwareKind } from "../10-catalog/platforms";
import { OVERCOMMIT, PRODUCTS, type Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { isSuspended } from "../45-billing/billing";
import type { Device, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { installedCores, installedRamGb, linkStatus, locationOf, raidUsable, rackPower, working } from "./status";
import { hasPublicAddress, sellsFrom } from "./addresses";
import { coverage } from "./maintenance";

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
// target cluster. ramGuard (Memory reservation) keeps booked RAM within each node's installed RAM; it is the only way RAM refuses a booking. php and phpUntil are a
// panel host's PHP version; after an upgrade its sites run slower up to and including the hour phpUntil. version is the
// year of the release the installed software runs and updatedAt the hour it was installed or last updated (vulns.ts).
export interface Cluster {
  id: string; name: string; az: string; kind: SoftwareKind; placement: Placement; nodes: ClusterNode[];
  panel: string | null; platform: string | null; vm: string | null; controlPlane: string | null;
  switching: { kind: SoftwareKind; to: string; doneAt: number } | null;
  backup: { targetId: string | null; every: BackupEvery };
  ramGuard?: boolean;
  php: string; phpUntil: number; ha: Ha; version: number; updatedAt: number;
}
// One workload runs one service: on a hypervisor node or bare-metal panel server (clusterId and deviceId), inside a panel
// VM (clusterId of the panel host, no deviceId), on a whole server (deviceId only), or in rack units for colocation (rackId,
// slot, units, watts). The player's own panel VMs have no service. Resources are booked at placement; placedAt is the hour
// it last moved. A stopped workload keeps its booking; busyUntil is the hour a restore or cold migration finishes; backupAt
// the last backup; stuck marks a VM that failover found no room for; migrating is a web space on its way to a panel host,
// moved at the hour doneAt.
export interface Workload extends Resources {
  id: string; serviceId: string; clusterId: string | null; deviceId: string | null; rackId: string | null; slot: number; units: number; watts: number; placedAt: number;
  stopped: boolean; busyUntil: number; backupAt: number | null; stuck?: boolean;
  // vmNNN for the player's own VMs; a customer workload carries its service's hostname.
  hostname?: string;
  migrating?: { clusterId: string; doneAt: number };
  // A pulled plug corrupted the data: it counts as lost until recovered (recoverDoneAt is the hour a recovery finishes) or
  // restored; noticed is set once the alert went out, recoverFailed once a recovery did not bring the data back.
  corrupted?: boolean; noticed?: boolean; recoverDoneAt?: number; recoverFailed?: boolean;
}

// Old saves are converted by upgradeCompute; this fills the fields every cluster has.
// Software of a save from before versions runs its install year, or two years before the save while no install date is known.
export const clusterDefaults = (c: Partial<Cluster> & Pick<Cluster, "nodes">, hour = 0): Cluster => ({
  panel: null, platform: null, vm: null, switching: null, backup: { targetId: null, every: "off" }, php: phpAt(yearOf(hour)), phpUntil: -1,
  version: c.switching ? yearOf(c.switching.doneAt) : Math.max(START_YEAR, yearOf(hour) - 2), updatedAt: c.switching?.doneAt ?? hour, ...c,
  ha: { ...HA_OFF, ...c.ha },
  controlPlane: c.controlPlane === undefined ? c.nodes[0]?.deviceId ?? null : c.controlPlane,
}) as Cluster;
export const workloadDefaults = (w: Partial<Workload>): Workload => ({ stopped: false, busyUntil: 0, backupAt: null, ...w }) as Workload;

const ZERO: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
export const KEYS = ["vcpu", "ramGb", "diskGb"] as const;
const minus = (a: Resources, b: Resources): Resources => ({ vcpu: a.vcpu - b.vcpu, ramGb: a.ramGb - b.ramGb, diskGb: a.diskGb - b.diskGb });

// What a node holds: its physical cores and installed RAM, and the disk it books up to (usable RAID times OVERCOMMIT.disk).
// Booking CPU and RAM past the physical amounts is always allowed; it costs performance and freezes (usage.ts).
export function nodeCapacity(d: Device): Resources {
  return modelById(d.model).server ? { vcpu: installedCores(d), ramGb: installedRamGb(d), diskGb: raidUsable(d) * OVERCOMMIT.disk } : ZERO;
}

// The working GPU cards of a server, and the ones no GPU VM has taken yet.
export const cardsOn = (d: Device): number => d.components.filter((c) => c.kind === "gpu" && c.failedAt === null).length;
export const cardsFree = (s: GameState, d: Device): number =>
  cardsOn(d) - s.workloads.reduce((n, w) => n + (w.deviceId === d.id && w.clusterId ? w.gpus ?? 0 : 0), 0);

// What the workloads on a server book; web spaces inside a panel VM count in the VM's booking.
export function nodeUsed(s: GameState, deviceId: string): Resources {
  const used = { ...ZERO };
  for (const w of s.workloads) if (w.deviceId === deviceId && w.clusterId) { const b = booked(s, w); for (const k of KEYS) used[k] += b[k]; }
  return used;
}
// Lines that share a guest per node rather than run one each, so they keep their fraction of a core everywhere.
const SHARED: Product[] = ["webHosting", "dns", "vpn"];
// What a workload books: on software that does not split cores a VM takes whole vCPUs.
export function booked(s: GameState, w: Workload): Resources {
  const c = s.clusters.find((x) => x.id === w.clusterId), id = c?.panel ?? c?.platform;
  if (!id || softwareById(id).split || Number.isInteger(w.vcpu)) return w;
  const product = s.services.find((v) => v.id === w.serviceId)?.product;
  return product && SHARED.includes(product) ? w : { ...w, vcpu: Math.ceil(w.vcpu) };
}

// What the management services of a cluster's software take.
export function controlPlaneUse(c: Pick<Cluster, "panel" | "platform">): Resources {
  const id = c.panel ?? c.platform;
  return id ? softwareById(id).controlPlane : ZERO;
}
// What a node holds for workloads: its capacity less the control plane it runs. Bars show booked against it.
export function bookable(s: GameState, d: Device): Resources {
  const c = clusterOf(s, d.id);
  return minus(nodeCapacity(d), c && c.controlPlane === d.id ? controlPlaneUse(c) : ZERO);
}
// Whether the resources fit the disk of a pool; CPU and RAM never refuse a booking.
export const diskFits = (used: Resources, cap: Resources, r: Resources): boolean => used.diskGb + r.diskGb <= cap.diskGb + 1e-9;
// Whether a node can take r more once freed is released. Disk is the only limit, besides RAM within the installed RAM while
// the cluster's Memory reservation is on.
export function nodeTakes(s: GameState, d: Device, r: Resources, freed: Resources = ZERO): boolean {
  const cap = bookable(s, d), used = minus(nodeUsed(s, d.id), freed);
  return diskFits(used, cap, r) && !(clusterOf(s, d.id)?.ramGuard && used.ramGb + r.ramGb > cap.ramGb + 1e-9);
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

// What a VM of that size holds for software: CPU and RAM at IN_VM of bare metal, less the panel.
export const vmCap = (r: Resources, panel: Resources): Resources => minus({ vcpu: r.vcpu * IN_VM, ramGb: r.ramGb * IN_VM, diskGb: r.diskGb }, panel);
// A panel VM's room: what it holds less the panel, and what its web spaces book. Only its disk limits the booking.
export function vmRoom(s: GameState, c: Cluster): { cap: Resources; used: Resources } {
  const vm = vmById(s, c.vm), used = { ...ZERO };
  for (const w of s.workloads) if (w.clusterId === c.id) for (const k of KEYS) used[k] += w[k];
  return { cap: vm ? vmCap(vm, controlPlaneUse(c)) : ZERO, used };
}

// Whether a working node of the cluster has the disk for its control plane next to its workloads.
export function fitsControlPlane(s: GameState, c: Cluster, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !working(s, deviceId)) return false;
  return diskFits(nodeUsed(s, deviceId), nodeCapacity(d), controlPlaneUse(c));
}

// Whether the cluster sells the product line: web hosting on a panel host, virtual machines on a hypervisor cluster, game
// servers on either a game panel or a hypervisor cluster, and products that need high availability only with automatic failover on.
export function supports(c: Cluster, p: Product): boolean {
  if (!kindsServing(p).includes(c.kind) || !(c.kind === "cloud" ? c.platform : c.panel)) return false;
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
  if (runsOn === "cluster") return s.clusters.some((c) => supports(c, p) && hasHosts(c) && clusterReachable(s, c) && sells(c.az) && (p !== "gpu" || gpuReady(s, c)));
  if (runsOn === "server") return s.devices.some((d) => d.rackId && modelById(d.model).server && !serverTaken(s, d.id) && linkStatus(s, d.id).online && hasPublicAddress(s, d.id) && sells(locationOf(s, d)?.az));
  return runsOn === "none" || s.locations.some((l) => l.dc);
}
// Whether a node of the cluster has a card no GPU VM has taken.
export const hasFreeCard = (s: GameState, c: Cluster): boolean => c.nodes.some((n) => { const d = s.devices.find((x) => x.id === n.deviceId); return !!d && cardsFree(s, d) > 0; });
// Whether the cluster can rent out GPUs: the team has the skill and a node has a free card.
export const gpuReady = (s: GameState, c: Cluster): boolean => s.unlocks.includes(GPU_SKILL) && hasFreeCard(s, c);
// Why a product found no place: no software that sells it, no failover for a product that needs it, or no room.
export function noRoomError(s: GameState, p: Product, clusterId: string | null = null): string {
  if (p === "gpu" && !s.unlocks.includes(GPU_SKILL)) return "error.needsResearch";
  if (PRODUCTS[p].runsOn === "server") return "error.noFreeServer";
  if (PRODUCTS[p].runsOn === "rack") return "error.needsDatacenter";
  const kind = kindServing(p), mine = s.clusters.filter((c) => (clusterId ? c.id === clusterId : true) && kindsServing(p).includes(c.kind) && (c.panel || c.platform));
  if (!mine.length) return kind === "panel" ? "error.needsPanel" : "error.needsPlatform";
  if (!mine.some((c) => supports(c, p))) return "error.needsHaCluster";
  if (!mine.some((c) => clusterReachable(s, c))) return "error.needsInternet";
  if (!mine.some((c) => s.locations.some((l) => l.az === c.az && sellsFrom(s, l, p)))) return "error.needsStaticLine";
  return p === "gpu" && !mine.some((c) => hasFreeCard(s, c)) ? "error.noCard" : "error.noCapacity";
}

// Nothing can be started, moved, restored or sold on a cluster while its control plane is down or nothing is installed.
// A panel VM's control plane is up while the VM runs.
export function controlPlaneUp(s: GameState, c: Cluster): boolean {
  if (c.switching || !(c.panel || c.platform)) return false;
  if (c.vm) { const vm = vmById(s, c.vm); return !!vm && workloadOnline(s, vm); }
  return !!c.controlPlane && c.nodes.some((n) => n.deviceId === c.controlPlane) && working(s, c.controlPlane);
}

// Game panels come first when a game server looks for a cluster.
export const gameFirst = (a: Cluster, b: Cluster): number => Number(b.kind === "game") - Number(a.kind === "game");

// The kind of software that serves a workload: the panel of a panel host, otherwise the hypervisor.
export const servedBy = (s: GameState, w: Workload): SoftwareKind => s.clusters.find((c) => c.id === w.clusterId)?.kind ?? "cloud";

// A workload lost its disk when its server's data was lost after the workload was placed there; a web space in a panel VM
// loses it with the VM.
export function lostDisk(s: GameState, w: Workload): boolean {
  const vm = vmOf(s, w);
  if (vm) return lostDisk(s, vm);
  if (w.corrupted) return true;
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

// The scheduler: active, working nodes with the disk for it. Booking CPU and RAM past a node never refuses a placement, but
// a node whose installed RAM it still fits wins (pack picks the busiest of them, spread the idlest); with none, the node
// with the least RAM booked takes it and risks a freeze; roomyOnly refuses that fallback, for callers that try the next cluster first.
// Ties keep node order. A panel VM is its one node: it returns the VM's id while the VM runs and has the disk (and, with
// roomyOnly, the RAM).
export function pickNode(
  s: GameState, cluster: Cluster, r: Resources, skip: string | null = null, placement: Placement = cluster.placement, roomyOnly = false,
): string | null {
  if (cluster.vm) {
    const vm = vmById(s, cluster.vm), room = vmRoom(s, cluster);
    return vm && !vm.stopped && vm.deviceId && working(s, vm.deviceId) && diskFits(room.used, room.cap, r) && (!roomyOnly || room.used.ramGb + r.ramGb <= room.cap.ramGb + 1e-9) ? vm.id : null;
  }
  let best: { id: string; load: number; roomy: boolean } | null = null;
  for (const n of cluster.nodes) {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active" || n.deviceId === skip || !working(s, d.id)) continue;
    if ((r.gpus ?? 0) > cardsFree(s, d) || !nodeTakes(s, d, r)) continue;
    const cap = bookable(s, d), used = nodeUsed(s, d.id), roomy = used.ramGb + r.ramGb <= cap.ramGb + 1e-9;
    // Past every node's RAM, the one with the lowest share of RAM booked is the least likely to freeze.
    const l = roomy ? load(used, cap) : cap.ramGb ? used.ramGb / cap.ramGb : Infinity;
    if (roomyOnly && !roomy) continue;
    if (!best || (roomy !== best.roomy ? roomy : roomy && placement === "pack" ? l > best.load : l < best.load)) best = { id: d.id, load: l, roomy };
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
  if (c && (c.kind === "panel" ? sitesDown(s, c.id) : s.security.hacked.includes(c.id))) return false;
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
  // Hours inside an announced maintenance window are no downtime for the SLA; a late announcement counts half.
  const hours = (id: string) => coverage(s, s.services.find((v) => v.id === id)!)?.factor ?? 1;
  if (down.length) s.downHours = { ...s.downHours, ...Object.fromEntries(down.map((id) => [id, (s.downHours[id] ?? 0) + hours(id)])) };
  return events;
}
