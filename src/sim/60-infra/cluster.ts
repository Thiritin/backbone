import { modelById } from "../10-catalog/hardware";
import { START_YEAR, yearOf } from "../00-core/time";
import { GPU_SKILL } from "../10-catalog/research";
import { topTier } from "../10-catalog/licence-tiers";
import { backsUp, balancerIn, fcGbit, IN_VM, isService, kindsServing, kindServing, phpAt, softwareById, type DatastoreProtocol, type SoftwareKind } from "../10-catalog/platforms";
import { OVERCOMMIT, PRODUCTS, type Resources } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { serviceHeld } from "../45-billing/billing";
import type { Device, GameState, MachineState } from "../50-state";
import type { OsImage } from "../10-catalog/server-os";
import type { SimEvent } from "../88-tick/tick";
import type { VmSample } from "./stats";
import { deviceVendor, drivesOf, installedRamGb, installedVcpu, linkStatus, locationOf, raidUsable, rackPower, readOnlySweep, serviceById, sweepGroups, working, burning } from "./status";
import { COMPAT_VCPU } from "../10-catalog/cpus";
import { hasPublicAddress, sellsFrom } from "./addresses";
import { coverage } from "./maintenance";
import type { PackageDef } from "../80-business/packages";
import type { BackupJob, RestorePoint } from "./backups";
import type { Ceph, Replica } from "./replica";
import { firewallBlocks, type Firewall } from "./exposure";

// Active takes new workloads, cordoned keeps its own, draining moves them off, maintenance is empty after a drain.
export type NodeState = "active" | "cordoned" | "draining" | "maintenance";
export interface ClusterNode { deviceId: string; state: NodeState }
export type Placement = "pack" | "spread";
export type BackupEvery = "off" | "daily" | "weekly";
// High availability, per hypervisor cluster once researched: live migration, auto-balancing and automatic failover.
export interface Ha { live: boolean; balance: boolean; failover: boolean }
export const HA_OFF: Ha = { live: false, balance: false, failover: false };
// A server runs one control plane per installed software (software.md, section 3). A cluster is either a hypervisor cluster (kind "cloud": one or more servers
// with the same hypervisor, hosting virtual machines) or a panel host (kind "panel": web hosting on one bare-metal server in
// nodes, or inside the player's own virtual machine vm on a hypervisor cluster, with nodes empty). panel and platform hold
// the installed software of the kind, null until installed; controlPlane is the node that runs it, null for a panel VM.
// While switching (an install or a change), the control plane is busy until doneAt. Backups copy every workload to the
// target cluster. ramGuard (Memory reservation) keeps booked RAM within each node's installed RAM; it is the only way RAM refuses a booking. php and phpUntil are a
// panel host's PHP version; after an upgrade its sites run slower up to and including the hour phpUntil. version is the
// year of the release the installed software runs and updatedAt the hour it was installed or last updated (vulns.ts).
export type Drs = "off" | "manual" | "partial" | "full";
export interface DrsRec { workloadId: string; to: string; at: number }
export interface Cluster {
  id: string; name: string; az: string; kind: SoftwareKind; placement: Placement; nodes: ClusterNode[];
  panel: string | null; platform: string | null; vm: string | null; controlPlane: string | null;
  switching: { kind: SoftwareKind; to: string; doneAt: number } | null;
  // Backup jobs, up to MAX_JOBS (backups.ts).
  jobs: BackupJob[];
  // VMwhere DRS: how the hourly balancing pass acts, and the moves it recommends (at most 5) in the manual and partial modes.
  drs: Drs; recs: DrsRec[];
  ramGuard?: boolean;
  // A free server that casts one extra vote in a Proxmocks cluster (quorum.ts); missing is none.
  qdevice?: string | null;
  // A Proxmocks shared storage pool built from the node disks (replica.ts); missing is none.
  ceph?: Ceph;
  // The player's cap on booked vCPU per physical vCPU for a panel host; missing or null is no cap (oversell.ts).
  oversell?: number | null;
  // The update channel; missing is Release (channel.ts).
  channel?: "stable" | "release" | "edge";
  // The edition of a licensed panel: trialUntil is the end of the free trial until a tier is chosen, lapsedAt the hour an unpaid licence expired. Missing is the top tier without expiry.
  licence?: { tier: string; trialUntil: number | null; lapsedAt: number | null };
  // Compatibility mode lets VMs move live between nodes of different CPU vendors, at COMPAT_VCPU of every node's vCPU.
  compat?: boolean;
  // Whether the software updates itself at AUTO_UPDATE_HOUR when an update is due (software.ts).
  autoUpdate?: boolean;
  // Whether a VMwhere cluster pays for the App Suite (APP_SUITE_FEE).
  appSuite: boolean;
  // Whether the cluster pays for its hypervisor's balancer edition (Software.balancer).
  balancer?: boolean;
  php: string; phpUntil: number; ha: Ha; version: number; updatedAt: number;
  // Servers attached as shared storage (economy.md, Datastores); VM disks on one stay off their node.
  datastores: Datastore[];
  // Named specs this installation sells (80-business/packages.ts); absent reads as none.
  packages?: PackageDef[];
}
// A datastore takes disks from readyAt on.
export interface Datastore { deviceId: string; protocol: DatastoreProtocol; readyAt: number }
// One workload runs one service: on a hypervisor node or bare-metal panel server (clusterId and deviceId), inside a panel
// VM (clusterId of the panel host, no deviceId), on a whole server (deviceId only), or in rack units for colocation (rackId,
// slot, units, watts). The player's own panel VMs have no service. Resources are booked at placement; placedAt is the hour
// it last moved. A stopped workload keeps its booking; busyUntil is the hour a restore or cold migration finishes; backupAt
// the last backup; stuck marks a VM that failover found no room for; migrating is a web space on its way to a panel host,
// moved at the hour doneAt.
// The player's own VMs carry MachineState; customer workloads do not.
export interface Workload extends Resources, Partial<MachineState> {
  id: string; serviceId: string; clusterId: string | null; deviceId: string | null; rackId: string | null; slot: number; units: number; watts: number; placedAt: number;
  stopped: boolean; busyUntil: number; backupAt: number | null; stuck?: boolean;
  // Restore points the backup jobs wrote; backupAt is the newest one's hour.
  points?: RestorePoint[];
  // A copy of the disk on a second node of the cluster, refreshed on a schedule (replica.ts).
  replica?: Replica | null;
  // Own VMs only: the port macros the VM lets through (exposure.ts); missing or null is no firewall.
  firewall?: Firewall | null;
  // The sold size when a package booked less; the service uses the sold size times its load.
  promised?: Resources;
  // vmNNN for the player's own VMs; a customer workload carries its service's hostname.
  hostname?: string;
  // The installer ISO of an operating system loaded in one of the player's own VMs (90-actions/console.ts); the VM boots
  // the installer while it is in.
  media?: OsImage;
  migrating?: { clusterId: string; doneAt: number; announced?: true };
  // A pulled plug corrupted the data: it counts as lost until recovered (recoverDoneAt is the hour a recovery finishes) or
  // restored; noticed is set once the alert went out, recoverFailed once a recovery did not bring the data back.
  corrupted?: boolean; noticed?: boolean; recoverDoneAt?: number; recoverFailed?: boolean; corruptedAt?: number;
  // Own VMs only: the last STATS_HOURS hourly samples (stats.ts), missing until the first tick, and the hour the VM last came up.
  stats?: VmSample[]; upSince?: number;
  // The datastore of its cluster its disk is on; missing for a disk on its node.
  datastore?: string;
  // Oldest first (economy.md, Snapshots); machine is an own VM's OS and software at the hour taken.
  snapshots?: Snapshot[];
  // An own VM kept as a template to clone from (economy.md, Templates): stopped, it never starts and failover leaves it.
  template?: true;
  // The hour a clone's copy from its template is done.
  cloning?: number;
}
export interface Snapshot { id: string; at: number; deltaGb: number; machine?: MachineState }
// The disk a VM's snapshot deltas take on its storage.
export const deltaGb = (w: Workload): number => w.snapshots?.reduce((n, x) => n + x.deltaGb, 0) ?? 0;

// Old saves are converted by upgradeCompute; this fills the fields every cluster has.
// Software of a save from before versions runs its install year, or two years before the save while no install date is known.
export const clusterDefaults = (c: Partial<Cluster> & Pick<Cluster, "nodes">, hour = 0): Cluster => ({
  panel: null, platform: null, vm: null, switching: null, appSuite: false, datastores: [], packages: [], jobs: [], php: phpAt(yearOf(hour)), phpUntil: -1,
  version: c.switching ? yearOf(c.switching.doneAt) : Math.max(START_YEAR, yearOf(hour) - 2), updatedAt: c.switching?.doneAt ?? hour, ...c,
  ha: { ...HA_OFF, ...c.ha }, drs: c.drs ?? (c.ha?.balance ? "full" : "off"), recs: c.recs ?? [],
  ...(c.licence || !topTier(c.panel ?? c.platform ?? null) ? {} : { licence: { tier: topTier(c.panel ?? c.platform ?? null)!.id, trialUntil: null, lapsedAt: null } }),
  controlPlane: c.controlPlane === undefined ? c.nodes[0]?.deviceId ?? null : c.controlPlane,
}) as Cluster;
export const workloadDefaults = (w: Partial<Workload>): Workload => ({ stopped: false, busyUntil: 0, backupAt: null, ...w }) as Workload;

const ZERO: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
export const KEYS = ["vcpu", "ramGb", "diskGb"] as const;
const minus = (a: Resources, b: Resources): Resources => ({ vcpu: a.vcpu - b.vcpu, ramGb: a.ramGb - b.ramGb, diskGb: a.diskGb - b.diskGb });

// What a node holds: the vCPU of its physical cores and its installed RAM, and the disk it books up to (usable RAID times
// OVERCOMMIT.disk); with s, the vCPU its cluster's compatibility mode leaves. Booking CPU and RAM past the physical amounts is
// always allowed; it costs performance and freezes (usage.ts).
// MinnIO erasure sets: parity drives hold no data, never more than half the set.
export const effParity = (parity: number, n: number): number => Math.min(parity, Math.floor(n / 2));
function ecFactor(s: GameState, d: Device): number {
  const c = s.clusters.find((x) => x.nodes.some((n) => n.deviceId === d.id));
  if (!c || (c.panel ?? c.platform) !== "minnio") return 1;
  const set = Math.min(16, c.nodes.reduce((n, x) => n + drivesOf(s.devices.find((y) => y.id === x.deviceId) ?? d).length, 0));
  return set ? (set - effParity(s.netsvc.ec[c.id] ?? 2, set)) / set : 1;
}
export function nodeCapacity(d: Device, s?: GameState): Resources {
  return modelById(d.model).server ? { vcpu: s ? nodeVcpu(s, d) : installedVcpu(d), ramGb: installedRamGb(d), diskGb: raidUsable(d) * OVERCOMMIT.disk * (s ? ecFactor(s, d) : 1) } : ZERO;
}
export const nodeVcpu = (s: GameState, d: Device): number => (clusterOf(s, d.id)?.compat ? Math.round(installedVcpu(d) * COMPAT_VCPU * 100) / 100 : installedVcpu(d));
// Whether a VM moves live between two servers: their boards share a vendor, or both clusters run compatibility mode.
export const liveBetween = (s: GameState, from: Device, to: Device): boolean =>
  deviceVendor(from) === deviceVendor(to) || (!!clusterOf(s, from.id)?.compat && !!clusterOf(s, to.id)?.compat);

// The working GPU cards of a server, and the ones no GPU VM has taken yet.
export const cardsOn = (d: Device): number => d.components.filter((c) => c.kind === "gpu" && c.failedAt === null).length;
export const cardsFree = (s: GameState, d: Device): number =>
  cardsOn(d) - s.workloads.reduce((n, w) => n + (w.deviceId === d.id && w.clusterId ? w.gpus ?? 0 : 0), 0);

// What the workloads on a server book; web spaces inside a panel VM count in the VM's booking, a disk on a datastore on the datastore.
export function nodeUsed(s: GameState, deviceId: string): Resources {
  const used = { ...ZERO };
  for (const w of s.workloads) {
    if (w.replica?.toNode === deviceId) used.diskGb += w.diskGb;
    if (w.deviceId === deviceId && w.clusterId) { const b = booked(s, w); for (const k of KEYS) used[k] += w.datastore && k === "diskGb" ? 0 : b[k]; }
  }
  return used;
}

type Disk = Resources & { datastore?: string };
export const datastoreOn = (c: Cluster, r: Disk): boolean => !!r.datastore && c.datastores.some((x) => x.deviceId === r.datastore);
// What a VM books on a node of the cluster: none of its disk while that is on one of the cluster's datastores.
const onNode = (c: Cluster | undefined, r: Disk): Resources => (c && datastoreOn(c, r) ? { ...r, diskGb: 0 } : r);
export const isDatastore = (s: GameState, deviceId: string): boolean => s.clusters.some((c) => c.datastores.some((x) => x.deviceId === deviceId) || c.qdevice === deviceId);
export const datastoreUsed = (s: GameState, deviceId: string): number => s.workloads.reduce((n, w) => n + (w.datastore === deviceId ? w.diskGb + deltaGb(w) : 0), 0);
export const datastoreCapacity = (s: GameState, deviceId: string): number => {
  const d = s.devices.find((x) => x.id === deviceId);
  return d ? nodeCapacity(d).diskGb : 0;
};
export const datastoreUp = (s: GameState, x: Datastore): boolean => x.readyAt <= s.hour && working(s, x.deviceId);
export const datastoreFits = (s: GameState, deviceId: string, diskGb: number): boolean => datastoreUsed(s, deviceId) + diskGb <= datastoreCapacity(s, deviceId) + 1e-9;
// A server's fastest port.
export const portGbit = (s: GameState, deviceId: string): number => {
  const d = s.devices.find((v) => v.id === deviceId);
  return d ? Math.max(...modelById(d.model).ports.map((p) => p.gbit)) : 0;
};
// Fibre Channel runs at its year's speed, NFS and iSCSI at the server's fastest port.
export const datastoreGbit = (s: GameState, x: Datastore): number => (x.protocol === "fc" ? fcGbit(yearOf(s.hour)) : portGbit(s, x.deviceId));
// A new VM's disk goes on the cluster's first working datastore with room, otherwise on its node.
export const withDatastore = <R extends Resources>(s: GameState, c: Cluster, r: R): R & { datastore?: string } => {
  const x = c.datastores.find((v) => datastoreUp(s, v) && datastoreFits(s, v.deviceId, r.diskGb));
  return x ? { ...r, datastore: x.deviceId } : r;
};
// Before its hypervisor's shared-nothing year a VM with datastores moves live only with its disk on one of the cluster's
// datastores, to a node of the same cluster.
export const diskMovesLive = (s: GameState, c: Cluster, w: Workload, toId?: string): boolean => {
  const ds = c.platform ? softwareById(c.platform).datastores : undefined;
  return !ds || yearOf(s.hour) >= ds.sharedNothing || (datastoreOn(c, w) && !!toId && c.nodes.some((n) => n.deviceId === toId));
};
// Lines that share a guest per node rather than run one each, so they keep their fraction of a core everywhere.
const SHARED: Product[] = ["webHosting", "dns", "vpn"];
// What a workload books: its snapshot deltas on its disk, and on software that does not split cores whole vCPUs.
export function booked(s: GameState, w: Workload): Resources {
  const c = s.clusters.find((x) => x.id === w.clusterId), id = c?.panel ?? c?.platform;
  const r = w.snapshots?.length ? { ...w, diskGb: w.diskGb + deltaGb(w) } : w;
  if (!id || softwareById(id).split || Number.isInteger(w.vcpu)) return r;
  const product = s.services.find((v) => v.id === w.serviceId)?.product;
  return product && SHARED.includes(product) ? r : { ...r, vcpu: Math.ceil(w.vcpu) };
}

// What the management services of a cluster's software take.
export function controlPlaneUse(c: Pick<Cluster, "panel" | "platform">): Resources {
  const id = c.panel ?? c.platform;
  return id ? softwareById(id).controlPlane : ZERO;
}
// What a node holds for workloads: its capacity less the control plane it runs. Bars show booked against it.
export function bookable(s: GameState, d: Device): Resources {
  return minus(nodeCapacity(d, s), controlPlanesOn(s, d.id));
}
// What the control planes of every cluster run on a server take together.
export function controlPlanesOn(s: GameState, deviceId: string): Resources {
  const sum = { ...ZERO };
  for (const c of s.clusters) if (!c.vm && c.controlPlane === deviceId) { const u = controlPlaneUse(c); for (const k of KEYS) sum[k] += u[k]; }
  return sum;
}
// Whether the resources fit the disk of a pool; CPU and RAM never refuse a booking.
export const diskFits = (used: Resources, cap: Resources, r: Resources): boolean => used.diskGb + r.diskGb <= cap.diskGb + 1e-9;
// Whether a node can take r more once freed is released. Disk is the only limit, besides RAM within the installed RAM while
// the cluster's Memory reservation is on, and an ARM node never takes what needs x86.
export function nodeTakes(s: GameState, d: Device, disk: Disk, freed: Disk = ZERO): boolean {
  if (disk.arch === "x86" && modelById(d.model).server?.arch === "arm") return false;
  const c = clusterOf(s, d.id), r = onNode(c, disk), cap = bookable(s, d), used = minus(nodeUsed(s, d.id), onNode(c, freed));
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
const RANK = (c: Cluster) => (c.kind === "cloud" ? 0 : c.kind === "panel" ? 1 : 2);
export const hostOfVm = (s: GameState, vmId: string): Cluster | undefined => s.clusters.find((c) => c.vm === vmId);
export const hostsOfVm = (s: GameState, vmId: string): Cluster[] => s.clusters.filter((c) => c.vm === vmId).sort((a, b) => RANK(a) - RANK(b));
// The web spaces and service workloads inside one of the player's own VMs, across every software it runs.
export const insideVm = (s: GameState, vmId: string): Workload[] => {
  const ids = new Set(hostsOfVm(s, vmId).map((c) => c.id));
  return s.workloads.filter((w) => !!w.clusterId && ids.has(w.clusterId));
};
export const isOwnVm = (w: Workload): boolean => !w.serviceId;
// The server a panel host runs on: its bare-metal node or its VM's node.
export const anchorOf = (s: GameState, c: Cluster): string | null => c.nodes[0]?.deviceId ?? vmById(s, c.vm)?.deviceId ?? null;

// What a VM of that size holds for software: CPU and RAM at IN_VM of bare metal, less the panel.
export const vmCap = (r: Resources, panel: Resources): Resources => minus({ vcpu: r.vcpu * IN_VM, ramGb: r.ramGb * IN_VM, diskGb: r.diskGb }, panel);
// A panel VM's room: what it holds less every panel in it, and what their web spaces book. Only its disk limits the booking.
export function vmRoom(s: GameState, c: Cluster): { cap: Resources; used: Resources } {
  const vm = vmById(s, c.vm), used = { ...ZERO }, panels = { ...ZERO };
  if (!vm) return { cap: ZERO, used };
  for (const w of insideVm(s, vm.id)) for (const k of KEYS) used[k] += w[k];
  for (const h of hostsOfVm(s, vm.id)) { const u = controlPlaneUse(h); for (const k of KEYS) panels[k] += u[k]; }
  return { cap: vmCap(vm, panels), used };
}

// Whether a working node of the cluster has the disk for its control plane next to its workloads and the other control planes.
export function fitsControlPlane(s: GameState, c: Cluster, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !working(s, deviceId)) return false;
  return diskFits(nodeUsed(s, deviceId), bookable(s, d), controlPlaneUse(c));
}

// Whether the cluster sells the product line: web hosting on a panel host, virtual machines on a hypervisor cluster, game
// servers on either a game panel or a hypervisor cluster, DNS, VPN and storage on their own software, and products that need
// high availability only with automatic failover on.
export function supports(c: Cluster, p: Product): boolean {
  if (!kindsServing(p).includes(c.kind) || !(c.kind === "cloud" ? c.platform : c.panel)) return false;
  // Cloud computing needs an orchestration platform.
  if (p === "cloud" && c.platform !== "openstash") return false;
  return !PRODUCTS[p].ha || c.ha.failover;
}
// Whether the cluster's hypervisor balances VMs now: an included balancer, or a paid edition the cluster bought.
export const balances = (s: GameState, c: Cluster): boolean => {
  const b = c.platform ? balancerIn(softwareById(c.platform), yearOf(s.hour)) : null;
  return !!b && (b.fee === 0 || !!c.balancer);
};

// Whether the target cluster runs backup software that reads the source cluster's software this year.
export const backsUpCluster = (s: GameState, source: Cluster, target: Cluster): boolean =>
  target.kind === "backup" && !!target.panel && !target.switching && backsUp(softwareById(target.panel), source.panel ?? source.platform, yearOf(s.hour));
// The clusters the source can back up to.
export const backupTargets = (s: GameState, source: Cluster): Cluster[] => s.clusters.filter((t) => t.id !== source.id && backsUpCluster(s, source, t));
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
const NEEDS: Partial<Record<SoftwareKind, string>> = { panel: "error.needsPanel", dns: "error.needsDnsServer", vpn: "error.needsVpnServer", storage: "error.needsStorageServer" };
// Why a product found no place: no software that sells it, no failover for a product that needs it, or no room.
export function noRoomError(s: GameState, p: Product, clusterId: string | null = null): string {
  if (p === "gpu" && !s.unlocks.includes(GPU_SKILL)) return "error.needsResearch";
  if (PRODUCTS[p].runsOn === "server") return "error.noFreeServer";
  if (PRODUCTS[p].runsOn === "rack") return "error.needsDatacenter";
  const kind = kindServing(p), mine = s.clusters.filter((c) => (clusterId ? c.id === clusterId : true) && kindsServing(p).includes(c.kind) && (c.panel || c.platform));
  if (!mine.length) return NEEDS[kind ?? "cloud"] ?? "error.needsPlatform";
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

// Service software comes before a hypervisor when a workload looks for a cluster.
export const gameFirst = (a: Cluster, b: Cluster): number => Number(isService(b.kind)) - Number(isService(a.kind));

// The kind of software that serves a workload: the panel of a panel host, otherwise the hypervisor.
export const servedBy = (s: GameState, w: Workload): SoftwareKind => s.clusters.find((c) => c.id === w.clusterId)?.kind ?? "cloud";

// A workload lost its disk when the data of its server, or of the datastore its disk is on, was lost after the workload was
// placed there; a web space in a panel VM loses it with the VM.
export function lostDisk(s: GameState, w: Workload): boolean {
  const vm = vmOf(s, w);
  if (vm) return lostDisk(s, vm);
  if (w.corrupted) return true;
  const at = w.datastore ?? w.deviceId, d = at ? s.devices.find((x) => x.id === at) : undefined;
  return !!d && d.dataLost !== null && d.dataLost >= w.placedAt;
}

// The busiest resource's share of capacity.
export const load = (used: Resources, cap: Resources) => Math.max(...KEYS.map((k) => (cap[k] ? used[k] / cap[k] : 1)));
export const fits = (used: Resources, cap: Resources, r: Resources) => KEYS.every((k) => used[k] + r[k] <= cap[k] + 1e-9);

// Every cluster a server is a node of, one per software: the hypervisor first, then a hosting panel, then the rest.
export const clustersOf = (s: GameState, deviceId: string): Cluster[] =>
  s.clusters.filter((c) => c.nodes.some((n) => n.deviceId === deviceId)).sort((a, b) => RANK(a) - RANK(b));
// The server's cluster of that kind; without one, its hypervisor cluster, or its first cluster when it runs no hypervisor.
export const clusterOf = (s: GameState, deviceId: string, kind?: SoftwareKind): Cluster | undefined =>
  clustersOf(s, deviceId).find((c) => !kind || c.kind === kind);
// The clusters of a server or of one of the player's own VMs.
export const clustersOn = (s: GameState, machineId: string): Cluster[] =>
  s.devices.some((d) => d.id === machineId) ? clustersOf(s, machineId) : hostsOfVm(s, machineId);
// The one-server cluster a server is still installing its first software into.
export const installingOn = (s: GameState, deviceId: string): Cluster | undefined =>
  clustersOf(s, deviceId).find((c) => c.switching && !c.panel && !c.platform);

// A server or one of the player's own VMs.
export const machineOf = (s: GameState, id: string): Device | Workload | undefined => s.devices.find((d) => d.id === id) ?? vmById(s, id);
// Devices change in place, as the console's actions hold them; workloads are replaced.
export function setMachine(s: GameState, id: string, fn: (m: MachineState) => Partial<MachineState>): void {
  const d = s.devices.find((x) => x.id === id);
  if (d) { Object.assign(d, fn(d)); return; }
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...fn({ os: w.os ?? null, software: w.software ?? [] }) } : w));
}
const machinesOf = (c: Cluster): string[] => (c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId));
const softwareOfCluster = (c: Cluster): string[] => [c.panel, c.platform, c.switching?.to].filter((x): x is string => !!x);
// The cluster's software leaves the machine's list.
export const stripSoftware = (s: GameState, c: Cluster, machineId: string) =>
  setMachine(s, machineId, (m) => ({ software: m.software.filter((x) => !softwareOfCluster(c).includes(x.id)) }));

// Removes a cluster with nothing on it: backups to it stop, its security marks go and its machines lose its software.
export function dropCluster(s: GameState, id: string) {
  const c = s.clusters.find((x) => x.id === id);
  if (c) for (const m of machinesOf(c)) stripSoftware(s, c, m);
  const old = s.clusters;
  s.clusters = s.clusters.filter((x) => x.id !== id).map((x) => ({ ...x, jobs: x.jobs.filter((j) => j.targetId !== id) }));
  const gone = new Set(old.flatMap((x) => x.jobs.filter((j) => j.targetId === id).map((j) => j.id)));
  if (gone.size) s.workloads = s.workloads.map((w) => (w.points?.some((p) => gone.has(p.jobId)) ? { ...w, points: w.points.filter((p) => !gone.has(p.jobId)), backupAt: w.points.filter((p) => !gone.has(p.jobId)).reduce<number | null>((n, p) => (n === null || p.at > n ? p.at : n), null) } : w));
  const drop = (ids: string[]) => ids.filter((x) => x !== id);
  if (s.company.mail.kind === "self" && s.company.mail.clusterId === id) s.company = { ...s.company, mail: { kind: "free" } };
  s.security = { ...s.security, offline: drop(s.security.offline), hacked: drop(s.security.hacked), patched: drop(s.security.patched) };
}
export const workloadsOf = (s: GameState, serviceId: string): Workload[] => {
  const by = sweepGroups(s, "workloads", () => s.workloads, (w) => w.serviceId);
  return by ? by.get(serviceId) ?? [] : s.workloads.filter((w) => w.serviceId === serviceId);
};
export const workloadsOn = (s: GameState, deviceId: string): Workload[] => s.workloads.filter((w) => w.deviceId === deviceId);
// A server taken by a cluster or rented whole as a dedicated server.
export const serverTaken = (s: GameState, deviceId: string): boolean =>
  !!clusterOf(s, deviceId) || isDatastore(s, deviceId) || s.workloads.some((w) => w.deviceId === deviceId) || s.devices.some((d) => d.id === deviceId && burning(s, d));

// The scheduler: active, working nodes with the disk for it. Booking CPU and RAM past a node never refuses a placement, but
// a node whose installed RAM it still fits wins (pack picks the busiest of them, spread the idlest); with none, the node
// with the least RAM booked takes it and risks a freeze; roomyOnly refuses that fallback, for callers that try the next cluster first.
// Ties keep node order. A panel VM is its one node: it returns the VM's id while the VM runs and has the disk (and, with
// roomyOnly, the RAM).
export function pickNode(
  s: GameState, cluster: Cluster, r: Disk, skip: string | null = null, placement: Placement = cluster.placement, roomyOnly = false,
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

// Whether a workload leaves its node without downtime: a web space or container always, a VM only by live migration.
export const movesLive = (s: GameState, c: Cluster, w: Workload, fromId: string, toId: string): boolean => {
  if (!(c.kind === "cloud" || isService(c.kind) || isOwnVm(w))) return true;
  const from = s.devices.find((d) => d.id === fromId), to = s.devices.find((d) => d.id === toId);
  return !!c.platform && softwareById(c.platform).live && c.ha.live && !!from && !!to && liveBetween(s, from, to) && diskMovesLive(s, c, w, toId);
};

// Moves every workload it can live off a draining node; an emptied node goes into maintenance. Returns the workloads left.
export function moveOff(s: GameState, cluster: Cluster, deviceId: string): number {
  // ponytail: migrations are instant; economy.md's migration times and two moves per node come with link bandwidth.
  let left = 0;
  for (const w of s.workloads.filter((x) => x.deviceId === deviceId && x.clusterId === cluster.id)) {
    const to = pickNode(s, cluster, w, deviceId);
    if (!to || !movesLive(s, cluster, w, deviceId, to)) left++;
    else s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, deviceId: to, placedAt: s.hour } : x));
  }
  if (!left) setNodeState(s, deviceId, "maintenance", cluster.id);
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

// The node state of one software installation on a server; other software on the same server keeps its own.
export function setNodeState(s: GameState, deviceId: string, state: NodeState, clusterId: string) {
  s.clusters = s.clusters.map((c) => (c.id === clusterId ? { ...c, nodes: c.nodes.map((n) => (n.deviceId === deviceId ? { ...n, state } : n)) } : c));
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
  if (c?.vm) { const vm = vmById(s, c.vm); return !!vm && workloadOnline(s, vm) && !firewallBlocks(s, c); }
  if (c && w.deviceId && s.frozen.includes(w.deviceId)) return false;
  if (w.deviceId) {
    const d = s.devices.find((x) => x.id === w.deviceId);
    return !!d && !lostDisk(s, w) && linkStatus(s, d.id).online && (!w.datastore || working(s, w.datastore));
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
  const down = readOnlySweep(s, () => ids.filter((id) => !workloadsUp(s, id) && !serviceHeld(s, serviceById(s, id)!)));
  // Hours inside an announced maintenance window are no downtime for the SLA; a late announcement counts half.
  const hours = (id: string) => coverage(s, s.services.find((v) => v.id === id)!)?.factor ?? 1;
  if (down.length) s.downHours = { ...s.downHours, ...Object.fromEntries(down.map((id) => [id, (s.downHours[id] ?? 0) + hours(id)])) };
  return events;
}
