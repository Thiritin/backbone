import { createGameServer } from "../60-infra/games";
import { betterHost } from "../60-infra/routes";
import { keepPhp } from "../60-infra/webpanel";
import { yearOf } from "../00-core/time";
import { CONTINUOUS } from "../20-world/datacenters";
import { modelById } from "../10-catalog/hardware";
import { marketPrice, PRODUCTS, sizeSpec, type Resources, type Sla, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { vmName } from "../30-customers/hostnames";
import type { GameState } from "../50-state";
import { balancerIn, balloons, clustersIn, conflict, isService, phpAt, softwareById, type Software, type SoftwareKind } from "../10-catalog/platforms";
import { HA_SKILL } from "../10-catalog/research";
import { serverOsAt } from "../10-catalog/server-os";
import { versionAt } from "../10-catalog/software-versions";
import { freezeTick } from "../60-infra/usage";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { withinOversell } from "../60-infra/oversell";
import { licenceBlock } from "../60-infra/licence";
import { markPatched, patchOut, vulnerable } from "../60-infra/security";
import {
  anchorOf, clusterOf, clustersOf, dropCluster, gameFirst, controlPlaneUp, controlPlaneUse, fitsControlPlane, HA_OFF, hostOfVm, hostsOfVm, insideVm, isOwnVm, KEYS, vmCap, moveOff, noRoomError, nodeTakes, pickNode, serverTaken,
  backsUpCluster, balances, datastoreFits, isDatastore, setMachine, withDatastore, setNodeState, stripSoftware, supports, vmById, vmRoom, workloadsOf, workloadsOn, type BackupEvery, type Cluster, type Ha, type Placement, type Workload,
} from "../60-infra/cluster";
import { burning, freeSlots, installedRamGb, locationOf, rackPower, working } from "../60-infra/status";
import { addService } from "./customers";
import { assignService } from "../60-infra/addresses";
import { isFloating } from "../60-infra/horizont";
import { deleteJob, saveJob } from "./backups";
import type { ActionResult } from "./hardware";
import { migrateWorkload } from "./vms";
import { buyLicenses, licenseDue } from "../85-products/products";
import { sizeOf } from "../30-market/spec";
import { quorumBlock } from "../60-infra/quorum";
import { editionAllows, poolRoom } from "../60-infra/vmwhere";
import { cephCapacity, cephOn, cephUsed } from "../60-infra/replica";

const fail = (error: string): ActionResult => ({ ok: false, error });
// economy.md, Panel VMs: the size the setup and the Products app suggest, and the smallest the player can book.
export const PANEL_VM_SIZE: Resources = { vcpu: 2, ramGb: 2, diskGb: 50 };
export const PANEL_VM_MIN: Resources = { vcpu: 1, ramGb: 1, diskGb: 10 };

const blank = (s: GameState, id: string, name: string, az: string, kind: SoftwareKind): Cluster => ({
  id, name, az, kind, placement: "pack", nodes: [], panel: null, platform: null, vm: null, controlPlane: null, switching: null, appSuite: false, datastores: [], packages: [],
  jobs: [], drs: "off", recs: [], acks: [], pools: [], php: phpAt(yearOf(s.hour)), phpUntil: -1, ha: { ...HA_OFF }, version: yearOf(s.hour), updatedAt: s.hour,
});
// The name a cluster in one of the player's VMs gets, by the kind of its software.
const PREFIX: Record<SoftwareKind, string> = { panel: "Web", cloud: "Cloud", game: "Game", mail: "Mail", dns: "DNS", vpn: "VPN", storage: "Storage", backup: "Backup" };

// The next free name of the pattern, numbered from 1.
export const freeName = (s: GameState, base: string): string => {
  for (let i = 1; ; i++) if (!s.clusters.some((c) => c.name === `${base} ${i}`)) return `${base} ${i}`;
};

// A server takes software when it is mounted, not rented whole or burning in, and none of its software runs it or shares
// a port with it.
export const freeServer = (s: GameState, d: GameState["devices"][number] | undefined, softwareId?: string): string | null => {
  if (!d) return "error.unknownDevice";
  if (!modelById(d.model).server) return "error.notServer";
  if (!d.rackId) return "error.notMounted";
  const taken = s.workloads.some((w) => w.deviceId === d.id && !w.clusterId) || burning(s, d) || isDatastore(s, d.id);
  if (taken || clustersOf(s, d.id).some((c) => runs(c, softwareId))) return "error.serverInUse";
  const sw = softwareId ? softwareById(softwareId) : undefined;
  return (sw && d.software.map((x) => conflict(sw, softwareById(x.id))).find((x) => x)) || null;
};
const runs = (c: Cluster, softwareId?: string): boolean => !!softwareId && [c.panel, c.platform, c.switching?.to].includes(softwareId);

// The software joins the machine's list, installing until doneAt.
function addSoftware(s: GameState, machineId: string, sw: Software, doneAt: number): void {
  setMachine(s, machineId, (m) => ({ software: [...m.software, { id: sw.id, version: versionAt(sw.id, s.hour).version, installedAt: s.hour, doneAt }] }));
}

// A VM made from a template: the OS is on its disk and booted from the start.
export const templateOs = (s: GameState, vmId: string, sw: Software): void =>
  setMachine(s, vmId, () => ({ os: { id: sw.os[0], version: serverOsAt(sw.os[0], yearOf(s.hour)).version, installedAt: s.hour } }));

// Installs software on a free server as a new one-server cluster whose control plane is busy for the install hours.
function installOnServer(s: GameState, deviceId: string, sw: Software, name: (label: string, loc: string) => string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId), bad = freeServer(s, d, sw.id);
  if (bad) return fail(bad);
  const loc = locationOf(s, d!)!, id = `clu${s.nextId++}`, slot = sw.kind === "cloud" ? "platform" : "panel";
  const c: Cluster = { ...blank(s, id, name(d!.label ?? d!.name, loc.name), loc.az, sw.kind), nodes: [{ deviceId, state: "active" }], controlPlane: deviceId };
  if (!fitsControlPlane(s, { ...c, [slot]: sw.id }, deviceId)) return fail(working(s, deviceId) ? "error.nodeFull" : "error.nodeDown");
  s.clusters = [...s.clusters, { ...c, switching: { kind: sw.kind, to: sw.id, doneAt: s.hour + sw.installHours } }];
  addSoftware(s, deviceId, sw, s.hour + sw.installHours);
  return { ok: true, id };
}

// Installs a hosting panel straight on a free mounted server: a bare-metal panel host for web hosting only.
export function installPanel(s: GameState, deviceId: string, panelId: string): ActionResult {
  const sw = softwareById(panelId);
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  return installOnServer(s, deviceId, sw, (label) => (s.clusters.some((c) => c.name === label) ? freeName(s, label) : label));
}

// Installs a hypervisor on a free mounted server, named after the server like a panel host.
export function installHypervisor(s: GameState, deviceId: string, platformId: string): ActionResult {
  const sw = softwareById(platformId);
  if (sw.id !== platformId || sw.kind !== "cloud") return fail("error.unknownSoftware");
  return installOnServer(s, deviceId, sw, (label) => (s.clusters.some((c) => c.name === label) ? freeName(s, label) : label));
}

// Creates one of the player's own VMs on a hypervisor cluster, empty until software is installed in it. A cluster still
// installing its hypervisor takes the VM.
export function createVm(s: GameState, clusterId: string, size: Resources, poolId: string | null = null): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || (!c.platform && c.switching?.kind !== "cloud")) return fail("error.needsPlatform");
  if (c.platform && !controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  { const q = quorumBlock(s, c); if (q) return fail(q); }
  if (KEYS.some((k) => !Number.isFinite(size[k]) || size[k] < PANEL_VM_MIN[k])) return fail("error.vmSize");
  if (cephOn(c) && cephUsed(s, c) + size.diskGb > cephCapacity(s, c)) return fail("error.cephFull");
  if (poolId !== null && !poolRoom(s, c, poolId, size)) return fail(c.pools.some((p) => p.id === poolId) ? "error.poolFull" : "error.unknownPool");
  const disk = withDatastore(s, c, size), node = pickNode(s, c, disk, null, c.drs === "partial" || c.drs === "full" ? "spread" : c.placement);
  if (!node) return fail("error.noCapacity");
  const vm = workload(s, "", { ...disk, clusterId: c.id, deviceId: node, os: null, software: [], ...(poolId && { poolId }), ...(c.platform === "openstash" && { groupIds: ["default"] }) });
  s.workloads = [...s.workloads, vm];
  return { ok: true, id: vm.id };
}

// Deletes one of the player's own VMs with the software installed in it, once nothing runs on that software.
export function deleteVm(s: GameState, vmId: string): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  { const q = quorumBlock(s, s.clusters.find((x) => x.id === vm.clusterId)); if (q) return fail(q); }
  if (insideVm(s, vm.id).length) return fail("error.softwareInUse");
  for (const h of hostsOfVm(s, vm.id)) dropCluster(s, h.id);
  s.workloads = s.workloads.filter((w) => w.id !== vm.id);
  // A volume outlives its instance; a floating IP stays allocated, unmapped.
  s.clusters = s.clusters.map((x) => (x.id !== vm.clusterId ? x : { ...x,
    volumes: x.volumes?.map((v) => (v.attachedTo === vm.id ? { ...v, attachedTo: null } : v)),
    floating: x.floating?.map((f) => (f.workloadId === vm.id ? { ...f, workloadId: null } : f)) }));
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.holder === vm.id && isFloating(s, a.ip) ? { ...a, holder: null } : a)) };
  return { ok: true };
}

// Installs a panel in one of the player's own VMs: a panel host whose web hosting capacity is the VM's booking. On a
// cluster still installing its hypervisor, the panel follows the hypervisor.
export function installPanelInVm(s: GameState, vmId: string, panelId: string): ActionResult {
  const vm = vmById(s, vmId), sw = softwareById(panelId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  if (hostsOfVm(s, vm.id).some((h) => runs(h, panelId))) return fail("error.onePanel");
  const c = s.clusters.find((x) => x.id === vm.clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.platform && !controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  if (sizeError(vm, sw.controlPlane)) return fail("error.vmSize");
  const after = Math.max(s.hour, c.switching?.doneAt ?? s.hour);
  return { ok: true, id: hostInVm(s, vm.id, c.az, sw, after + sw.installHours) };
}

// Adds the software to one of the player's VMs as a cluster of its own, installing until doneAt; returns the cluster id.
export function hostInVm(s: GameState, vmId: string, az: string, sw: Software, doneAt: number): string {
  const id = `clu${s.nextId++}`;
  s.clusters = [...s.clusters, { ...blank(s, id, freeName(s, PREFIX[sw.kind]), az, sw.kind), vm: vmId, switching: { kind: sw.kind, to: sw.id, doneAt } }];
  addSoftware(s, vmId, sw, doneAt);
  return id;
}

// A new VM with a panel in it, as the guided setup and the Products app book it; returns the panel host id.
export function createPanelVm(s: GameState, clusterId: string, panelId: string, size: Resources = PANEL_VM_SIZE): ActionResult {
  const sw = softwareById(panelId);
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  const bad = sizeError(size, sw.controlPlane);
  if (bad) return fail(bad);
  if (s.cash < licenseDue(s, "", sw.os[0], sw.id)) return fail("error.noCash");
  const vm = createVm(s, clusterId, size);
  if (!vm.ok) return vm;
  templateOs(s, vm.id!, sw);
  const done = installPanelInVm(s, vm.id!, panelId);
  if (done.ok) buyLicenses(s, vm.id!, sw.os[0], sw.id);
  return done;
}

const sizeError = (r: Resources, panel: Resources): string | null =>
  KEYS.some((k) => !Number.isFinite(r[k]) || r[k] < PANEL_VM_MIN[k] || vmCap(r, panel)[k] < 0) ? "error.vmSize" : null;

// Books a panel VM bigger or smaller: its disk must still hold its web spaces and fit on its node.
export function resizePanelVm(s: GameState, hostId: string, size: Resources): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId), vm = c && vmById(s, c.vm);
  if (!c || !vm) return fail("error.notPanelVm");
  const panel = controlPlaneUse({ panel: c.panel ?? c.switching?.to ?? null, platform: null });
  const bad = sizeError(size, panel);
  if (bad) return fail(bad);
  const inside = vmRoom(s, c).used, cap = vmCap(size, panel);
  if (inside.diskGb > cap.diskGb + 1e-9) return fail("error.vmTooSmall");
  const d = vm.deviceId ? s.devices.find((x) => x.id === vm.deviceId) : undefined;
  if ((d && !nodeTakes(s, d, { ...size, datastore: vm.datastore }, vm)) || (vm.datastore && !datastoreFits(s, vm.datastore, size.diskGb - vm.diskGb))) return fail("error.nodeFull");
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, ...size } : w));
  freezeTick(s);
  return { ok: true };
}

// Minutes a VM is down while its hypervisor restarts it at the new size.
const RESIZE_MINUTES = 10;

// Books one of the player's own VMs bigger or smaller, as far as its server has the disk. Only RAM growth is live, and only
// on a hypervisor that balloons; any other change restarts the VM.
export function resizeVm(s: GameState, vmId: string, size: Resources): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (hostOfVm(s, vm.id)) return fail("error.softwareInUse");
  const bad = sizeError(size, { vcpu: 0, ramGb: 0, diskGb: 0 });
  if (bad) return fail(bad);
  { const pc = s.clusters.find((x) => x.id === vm.clusterId); if (pc && vm.poolId && !poolRoom(s, pc, vm.poolId, size, vm.id)) return fail("error.poolFull"); }
  const d = vm.deviceId ? s.devices.find((x) => x.id === vm.deviceId) : undefined;
  if ((d && !nodeTakes(s, d, { ...size, datastore: vm.datastore }, vm)) || (vm.datastore && !datastoreFits(s, vm.datastore, size.diskGb - vm.diskGb))) return fail("error.nodeFull");
  const c = s.clusters.find((x) => x.id === vm.clusterId);
  const live = !!c?.platform && balloons(softwareById(c.platform), yearOf(s.hour)) && size.ramGb >= vm.ramGb && size.vcpu === vm.vcpu && size.diskGb === vm.diskGb;
  const busyUntil = live || vm.stopped ? vm.busyUntil : Math.max(vm.busyUntil, s.hour + RESIZE_MINUTES / 60);
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, ...size, busyUntil } : w));
  freezeTick(s);
  return { ok: true };
}

// Removes an empty panel host: its server is free again, its VM is deleted.
export function removePanelHost(s: GameState, hostId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || c.kind !== "panel") return fail("error.notPanelHost");
  if (s.workloads.some((w) => w.clusterId === c.id)) return fail("error.nodeNotEmpty");
  dropCluster(s, c.id);
  if (c.vm) s.workloads = s.workloads.filter((w) => w.id !== c.vm);
  return { ok: true };
}

// Moves the control plane to another working node of its cluster with room for it.
export function moveControlPlane(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (!c.nodes.some((n) => n.deviceId === deviceId)) return fail("error.notNode");
  if (c.controlPlane === deviceId) return fail("error.sameHost");
  if (!working(s, deviceId)) return fail("error.nodeDown");
  if (!fitsControlPlane(s, c, deviceId)) return fail("error.nodeFull");
  update(s, c.id, (x) => ({ ...x, controlPlane: deviceId }));
  return { ok: true };
}

// The cluster's first backup job: off removes it, anything else points it at a target on that schedule.
export function setBackup(s: GameState, clusterId: string, targetId: string | null, every: BackupEvery): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), t = s.clusters.find((x) => x.id === targetId);
  if (!c) return fail("error.unknownCluster");
  if (targetId !== null && (!t || t.id === c.id || t.kind !== "backup")) return fail("error.backupTarget");
  if (t && !backsUpCluster(s, c, t)) return fail("error.backupIncompatible");
  if (every !== "off" && targetId === null) return fail("error.backupTarget");
  const first = c.jobs[0];
  if (every === "off") return first ? deleteJob(s, clusterId, first.id) : { ok: true };
  return saveJob(s, clusterId, { id: first?.id, targetId: targetId!, every });
}

const update = (s: GameState, id: string, fn: (c: Cluster) => Cluster) => {
  s.clusters = s.clusters.map((c) => (c.id === id ? fn(c) : c));
};

// Joins an empty server of the zone that runs the cluster's software to the cluster; the server's own cluster goes away.
// A panel host takes a second server from the year its panel clusters, and keeps one before.
export function addNode(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const panel = c.kind === "panel" || isService(c.kind), id = c.panel ?? c.platform;
  if (panel && (c.vm || !id || !clustersIn(softwareById(id), yearOf(s.hour)))) return fail("error.panelHostOneServer");
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const mine = clustersOf(s, d.id), own = mine.find((x) => x.id === c.id) ?? mine.find((x) => x.kind === c.kind && runs(x, id ?? undefined)) ?? clusterOf(s, d.id, c.kind);
  if (own?.id === c.id) return fail("error.alreadyNode");
  if (!own || own.kind !== c.kind || !(own.panel ?? own.platform) || own.switching) return fail(panel ? "error.noPanel" : "error.noHypervisor");
  if (locationOf(s, d)?.az !== c.az) return fail("error.otherZone");
  if ((own.panel ?? own.platform) !== id) return fail(panel ? "error.otherPanel" : "error.otherHypervisor");
  if (workloadsOn(s, d.id).some((w) => w.clusterId === own.id)) return fail("error.nodeNotEmpty");
  const kept = d.software;
  leave(s, own.id, d.id);
  d.software = kept;
  update(s, c.id, (x) => ({ ...x, nodes: [...x.nodes, { deviceId, state: "active" }], controlPlane: x.controlPlane ?? deviceId }));
  return { ok: true };
}

// A node leaves its cluster; its control plane moves to the next node, and the last node takes the cluster with it.
export const leave = (s: GameState, clusterId: string, deviceId: string) => {
  const c = s.clusters.find((x) => x.id === clusterId)!, nodes = c.nodes.filter((n) => n.deviceId !== deviceId);
  stripSoftware(s, c, deviceId);
  if (!nodes.length) return dropCluster(s, c.id);
  update(s, c.id, (x) => ({ ...x, nodes, controlPlane: x.controlPlane === deviceId ? nodes[0].deviceId : x.controlPlane }));
};

// A panel host is due an upgrade on an older PHP, or on the current one while a released patch is missing.
export const phpDue = (s: GameState, c: Cluster): boolean => c.kind === "panel" && (c.php !== phpAt(yearOf(s.hour)) || (patchOut(s) && vulnerable(s, c)));

// One panel host to the current PHP version with any released security patch; its sites run slower for the next hour.
// With keep the previous version stays installed in the pool and takes the accounts whose app does not run on the new one.
export function upgradePhp(s: GameState, hostId: string, keep?: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "panel") return fail("error.notPanelHost");
  if (!phpDue(s, c)) return fail(vulnerable(s, c) ? "error.patchPending" : "error.phpCurrent");
  update(s, c.id, (x) => ({ ...x, php: phpAt(yearOf(s.hour)), phpUntil: s.hour + PHP_UPGRADE_HOURS }));
  if (keep && c.php !== phpAt(yearOf(s.hour))) keepPhp(s, c.id, c.php);
  markPatched(s, c.id);
  return { ok: true };
}

// Every panel host due an upgrade that runs on the server, as a technician does it on site.
export function upgradeNodePhp(s: GameState, deviceId: string): ActionResult {
  const mine = s.clusters.filter((c) => c.kind === "panel" && anchorOf(s, c) === deviceId), due = mine.filter((c) => phpDue(s, c));
  if (!due.length) return mine.length ? upgradePhp(s, mine[0].id) : fail("error.notPanelHost");
  for (const c of due) upgradePhp(s, c.id);
  return { ok: true };
}

// A node leaves its cluster (the hypervisor's unless named) once nothing of it runs on it, uninstalling its software; a
// panel host keeps at least one.
export function removeNode(s: GameState, deviceId: string, clusterId?: string): ActionResult {
  const c = clusterId ? clustersOf(s, deviceId).find((x) => x.id === clusterId) : clusterOf(s, deviceId);
  if (!c) return fail("error.notNode");
  if ((c.kind === "panel" || isService(c.kind)) && c.nodes.length < 2) return fail("error.panelHostOneServer");
  if (workloadsOn(s, deviceId).some((w) => w.clusterId === c.id)) return fail("error.nodeNotEmpty");
  leave(s, c.id, deviceId);
  return { ok: true };
}

// Cordon, uncordon, drain and evacuate act on one software installation on a server (docs/design/shop.md, section 5);
// without a cluster id they take the server's first one.
const nodeOf = (s: GameState, deviceId: string, clusterId?: string): Cluster | undefined =>
  clusterId ? clustersOf(s, deviceId).find((x) => x.id === clusterId) : clusterOf(s, deviceId);
const nodeAction = (s: GameState, deviceId: string, state: "active" | "cordoned", clusterId?: string): ActionResult => {
  const c = nodeOf(s, deviceId, clusterId);
  if (!c) return fail("error.notNode");
  { const q = quorumBlock(s, c); if (q) return fail(q); }
  setNodeState(s, deviceId, state, c.id);
  return { ok: true };
};
export const cordon = (s: GameState, deviceId: string, clusterId?: string): ActionResult => nodeAction(s, deviceId, "cordoned", clusterId);
export const uncordon = (s: GameState, deviceId: string, clusterId?: string): ActionResult => nodeAction(s, deviceId, "active", clusterId);

// Moves every workload that can move live and fits elsewhere now; the rest follow each hour as room appears.
export function drain(s: GameState, deviceId: string, clusterId?: string): ActionResult {
  const c = nodeOf(s, deviceId, clusterId);
  if (!c) return fail("error.notNode");
  { const q = quorumBlock(s, c); if (q) return fail(q); }
  setNodeState(s, deviceId, "draining", c.id);
  moveOff(s, s.clusters.find((x) => x.id === c.id)!, deviceId);
  return { ok: true };
}

// Moves everything that fits elsewhere now, cold where live is not possible; what fits nowhere stays and drains later.
export function evacuate(s: GameState, deviceId: string, clusterId?: string): ActionResult {
  const c = nodeOf(s, deviceId, clusterId);
  if (!c) return fail("error.notNode");
  { const q = quorumBlock(s, c); if (q) return fail(q); }
  setNodeState(s, deviceId, "draining", c.id);
  for (const w of s.workloads.filter((x) => x.deviceId === deviceId && x.clusterId === c.id)) {
    const to = pickNode(s, s.clusters.find((x) => x.id === c.id)!, w, deviceId);
    // A VM the migration refuses, such as one whose disk died with the node, restarts on the new node as it is.
    if (to && !migrateWorkload(s, w.id, to).ok) s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, deviceId: to, placedAt: s.hour } : x));
  }
  moveOff(s, s.clusters.find((x) => x.id === c.id)!, deviceId);
  return { ok: true };
}

export function setPlacement(s: GameState, clusterId: string, placement: Placement): ActionResult {
  if (!s.clusters.some((c) => c.id === clusterId)) return fail("error.unknownCluster");
  update(s, clusterId, (c) => ({ ...c, placement }));
  return { ok: true };
}

// Memory reservation: refuses placements and moves that would book more RAM than a node has installed.
export function setRamGuard(s: GameState, clusterId: string, on: boolean): ActionResult {
  if (!s.clusters.some((c) => c.id === clusterId)) return fail("error.unknownCluster");
  if (!s.unlocks.includes("memoryReservation")) return fail("error.missingSkill");
  update(s, clusterId, (c) => ({ ...c, ramGuard: on }));
  return { ok: true };
}

// High availability on a hypervisor cluster, once researched. Auto-balancing moves VMs live, so it needs live migration,
// and live migration needs a hypervisor that can do it.
export function setHa(s: GameState, clusterId: string, feature: keyof Ha, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud") return fail("error.needsPlatform");
  if (!s.unlocks.includes(HA_SKILL)) return fail("error.missingSkill");
  if (on && feature === "live" && c.platform && !softwareById(c.platform).live) return fail("error.noLiveMigration");
  if (on && feature === "failover" && !editionAllows(c, "failover")) return fail("error.needsEdition");
  if (on && feature === "balance" && !c.ha.live) return fail("error.needsLiveMigration");
  if (on && feature === "balance" && !balances(s, c)) return fail("error.needsBalancer");
  if (on && feature === "balance" && !editionAllows(c, "drs")) return fail("error.needsEdition");
  const ha = { ...c.ha, [feature]: on, ...(feature === "live" && !on ? { balance: false } : {}) };
  update(s, c.id, (x) => ({ ...x, ha, ...(ha.balance !== c.ha.balance && { drs: ha.balance ? "full" as const : "off" as const }) }));
  return { ok: true };
}

// Buys or cancels the balancer edition of a hypervisor cluster; cancelling turns auto-balancing off.
export function setBalancer(s: GameState, clusterId: string, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const b = c.platform ? balancerIn(softwareById(c.platform), yearOf(s.hour)) : null;
  if (!b || b.fee === 0) return fail("error.noBalancer");
  update(s, c.id, (x) => ({ ...x, balancer: on, ...(!on && { ha: { ...x.ha, balance: false }, drs: "off" as const }) }));
  return { ok: true };
}

export const workload = (s: GameState, serviceId: string, w: Partial<Workload>): Workload => ({
  id: `wl${s.nextId++}`, serviceId, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, vcpu: 0, ramGb: 0, diskGb: 0, placedAt: s.hour,
  stopped: false, busyUntil: 0, backupAt: null, ...hostnameOf(s, serviceId), ...w,
});

// A customer workload carries its service's hostname, the player's own VM gets the next vmNNN.
const hostnameOf = (s: GameState, serviceId: string): { hostname?: string } => {
  const hostname = serviceId ? s.services.find((v) => v.id === serviceId)?.hostname : vmName(s);
  return hostname ? { hostname } : {};
};

// Places a service on hardware by its product: a cluster workload (in clusterId, or the first cluster of its zone that sells
// it with room; on deviceId when given; inside the VM of a panel VM host), a whole free server for dedicated, rack units with power for colocation. A service without a zone
// takes the zone it lands in. A custom service books its own resources.
export function placeService(s: GameState, serviceId: string, clusterId: string | null = null, deviceId: string | null = null): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.endedAt !== null) return fail("error.unknownService");
  if (workloadsOf(s, v.id).length) return fail("error.placed");
  const spec = PRODUCTS[v.product], size = v.pkgBook ?? sizeOf(v.spec);
  const inZone = (az: string) => v.zone === null || v.zone === az;
  let w: Workload | null = null, az = "", capped = false, blocked = "";
  if (spec.runsOn === "none") return { ok: true };
  if (spec.runsOn === "cluster") {
    const candidates = s.clusters.filter((x) => (clusterId ? x.id === clusterId : inZone(x.az)) && supports(x, v.product)).sort((a, b) => gameFirst(a, b) || betterHost(s)(a, b));
    // A cluster with the RAM for it wins; with none, the first cluster with the disk takes it past its RAM.
    for (const roomyOnly of [true, false]) {
      for (const c of candidates) {
        const disk = withDatastore(s, c, size);
        const room = withinOversell(s, c, disk), why = licenceBlock(s, c);
        if (why) { blocked = why; continue; }
        if (!room) capped = true;
        const node = controlPlaneUp(s, c) && room ? pickNode(s, deviceId ? { ...c, nodes: c.nodes.filter((n) => n.deviceId === deviceId) } : c, disk, null, c.placement, roomyOnly) : null;
        if (node) { w = workload(s, v.id, { ...disk, clusterId: c.id, deviceId: c.vm ? null : node }); az = c.az; break; }
      }
      if (w) break;
    }
    const target = clusterId ? s.clusters.find((x) => x.id === clusterId) : undefined;
    if (!w && blocked) return fail(blocked);
    if (!w && capped) return fail("error.oversellCap");
    if (!w) return fail(target && supports(target, v.product) && !controlPlaneUp(s, target) ? "error.controlPlaneDown" : noRoomError(s, v.product, clusterId));
  } else if (spec.runsOn === "server") {
    const d = s.devices.find((x) => x.rackId && installedRamGb(x) >= size.ramGb && inZone(locationOf(s, x)?.az ?? "") && !serverTaken(s, x.id));
    if (!d) return fail("error.noFreeServer");
    w = workload(s, v.id, { deviceId: d.id });
    az = locationOf(s, d)!.az;
  } else {
    const units = v.spec.units ?? 1, watts = v.spec.watts ?? 0;
    for (const r of s.racks) {
      const loc = s.locations.find((l) => l.id === r.locationId)!;
      const p = rackPower(s, r.id), slot = freeSlots(s, r.id, units).at(-1);
      if (!loc.dc || !inZone(loc.az) || r.arriveAt !== null || slot === undefined || p.watts + watts > CONTINUOUS.share * p.limitWatts) continue;
      w = workload(s, v.id, { rackId: r.id, slot, units, watts });
      az = loc.az;
      break;
    }
    if (!w) return fail("error.noRackSpace");
  }
  if (v.pkgBook && (["vcpu", "ramGb", "diskGb"] as const).some((k) => size[k] < v.spec[k])) w = { ...w, promised: sizeOf(v.spec) };
  s.workloads = [...s.workloads, w];
  if (v.zone === null) s.services = s.services.map((x) => (x.id === v.id ? { ...x, zone: az } : x));
  return { ok: true, id: w.id };
}

// spec defaults to the line's smallest size this year.
export interface Order { label: string; zone?: string | null; clusterId?: string | null; sla?: Sla; price?: number; spec?: Spec; deviceId?: string | null;
  // A package the order books: its name, what it books and the sold size when that is more. username is web hosting's login.
  pkg?: { name: string; book: Resources; promised?: Resources }; username?: string;
  // Game servers: the title, when the buyer names one.
  title?: string }

// Signs a contract with the catalog's terms and places it; nothing is recorded when it can't be placed.
// price is per hour for hourly products and per year for yearly ones; it defaults to the market reference.
export function provisionService(s: GameState, customerId: string, product: Product, order: Order): ActionResult {
  if (!s.customers.some((c) => c.id === customerId && c.churnedAt === null)) return fail("error.unknownCustomer");
  const spec = PRODUCTS[product], sla = order.sla ?? "basic", want = order.spec ?? sizeSpec(product, 0, yearOf(s.hour));
  const reference = marketPrice(product, want, yearOf(s.hour), sla);
  const price = order.price ?? (spec.period === "hour" ? reference / 730 : reference);
  const nextId = s.nextId;
  const id = addService(s, customerId, product, order.label, price, spec.period, spec.commitMonths, order.zone ?? null, want, sla);
  if (order.pkg || order.username) s.services = s.services.map((v) => (v.id === id ? { ...v, ...(order.pkg && { pkg: order.pkg.name, pkgBook: order.pkg.book }), ...(order.username && { username: order.username }) } : v));
  const placed = placeService(s, id, order.clusterId ?? null, order.deviceId ?? null);
  const noAddress = placed.ok ? assignService(s, id) : null;
  if (noAddress) {
    Object.assign(s, { services: s.services.filter((v) => v.id !== id), workloads: s.workloads.filter((w) => w.serviceId !== id), nextId });
    return fail(noAddress);
  }
  if (!placed.ok) {
    Object.assign(s, { services: s.services.filter((v) => v.id !== id), nextId });
    return placed;
  }
  if (product === "gameServer") createGameServer(s, id, order.title);
  return { ok: true, id };
}
