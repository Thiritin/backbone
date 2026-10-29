import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { marketPrice, PRODUCTS, sizeSpec, type Resources, type Sla, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { vmName } from "../30-customers/hostnames";
import type { GameState } from "../50-state";
import { clustersIn, phpAt, softwareById, type Software, type SoftwareKind } from "../10-catalog/platforms";
import { HA_SKILL } from "../10-catalog/research";
import { freezeTick } from "../60-infra/usage";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { markPatched, patchOut, vulnerable } from "../60-infra/security";
import {
  anchorOf, bookable, clusterOf, controlPlaneUp, controlPlaneUse, fitsControlPlane, HA_OFF, hostOfVm, isOwnVm, KEYS, vmCap, moveOff, noRoomError, nodeUsed, pickNode, serverTaken,
  setNodeState, supports, vmById, vmRoom, workloadsOf, workloadsOn, type BackupEvery, type Cluster, type Ha, type Placement, type Workload,
} from "../60-infra/cluster";
import { freeSlots, installedRamGb, locationOf, rackPower, working } from "../60-infra/status";
import { addService } from "./customers";
import { assignService } from "../60-infra/addresses";
import type { ActionResult } from "./hardware";
import { sizeOf } from "../30-market/spec";

const fail = (error: string): ActionResult => ({ ok: false, error });
// economy.md, Panel VMs: the size the setup and the Products app suggest, and the smallest the player can book.
export const PANEL_VM_SIZE: Resources = { vcpu: 2, ramGb: 2, diskGb: 50 };
export const PANEL_VM_MIN: Resources = { vcpu: 1, ramGb: 1, diskGb: 10 };

const blank = (s: GameState, id: string, name: string, az: string, kind: SoftwareKind): Cluster => ({
  id, name, az, kind, placement: "pack", nodes: [], panel: null, platform: null, vm: null, controlPlane: null, switching: null,
  backup: { targetId: null, every: "off" }, php: phpAt(yearOf(s.hour)), phpUntil: -1, ha: { ...HA_OFF }, version: yearOf(s.hour), updatedAt: s.hour,
});
// The next free name of the pattern, numbered from 1.
const freeName = (s: GameState, base: string): string => {
  for (let i = 1; ; i++) if (!s.clusters.some((c) => c.name === `${base} ${i}`)) return `${base} ${i}`;
};

// A server must be mounted and free of clusters and customers to take software.
const freeServer = (s: GameState, d: GameState["devices"][number] | undefined): string | null => {
  if (!d) return "error.unknownDevice";
  if (!modelById(d.model).server) return "error.notServer";
  if (!d.rackId) return "error.notMounted";
  return serverTaken(s, d.id) ? "error.serverInUse" : null;
};

// Installs software on a free server as a new one-server cluster whose control plane is busy for the install hours.
function installOnServer(s: GameState, deviceId: string, sw: Software, name: (label: string, loc: string) => string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId), bad = freeServer(s, d);
  if (bad) return fail(bad);
  const loc = locationOf(s, d!)!, id = `clu${s.nextId++}`, slot = sw.kind === "cloud" ? "platform" : "panel";
  const c: Cluster = { ...blank(s, id, name(d!.label ?? d!.name, loc.name), loc.az, sw.kind), nodes: [{ deviceId, state: "active" }], controlPlane: deviceId };
  if (!fitsControlPlane(s, { ...c, [slot]: sw.id }, deviceId)) return fail(working(s, deviceId) ? "error.nodeFull" : "error.nodeDown");
  s.clusters = [...s.clusters, { ...c, switching: { kind: sw.kind, to: sw.id, doneAt: s.hour + sw.installHours } }];
  return { ok: true, id };
}

// Installs a hosting panel straight on a free mounted server: a bare-metal panel host for web hosting only.
export function installPanel(s: GameState, deviceId: string, panelId: string): ActionResult {
  const sw = softwareById(panelId);
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  return installOnServer(s, deviceId, sw, (label) => (s.clusters.some((c) => c.name === label) ? freeName(s, label) : label));
}

// Installs a hypervisor on a free mounted server: a one-server hypervisor cluster that servers with the same hypervisor join.
export function installHypervisor(s: GameState, deviceId: string, platformId: string): ActionResult {
  const sw = softwareById(platformId);
  if (sw.id !== platformId || sw.kind !== "cloud") return fail("error.unknownSoftware");
  return installOnServer(s, deviceId, sw, (_, loc) => freeName(s, loc));
}

// Creates one of the player's own VMs on a hypervisor cluster, empty until software is installed in it. A cluster still
// installing its hypervisor takes the VM.
export function createVm(s: GameState, clusterId: string, size: Resources): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || (!c.platform && c.switching?.kind !== "cloud")) return fail("error.needsPlatform");
  if (c.platform && !controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  if (KEYS.some((k) => !Number.isFinite(size[k]) || size[k] < PANEL_VM_MIN[k])) return fail("error.vmSize");
  const node = pickNode(s, c, size);
  if (!node) return fail("error.noCapacity");
  const vm = workload(s, "", { ...size, clusterId: c.id, deviceId: node });
  s.workloads = [...s.workloads, vm];
  return { ok: true, id: vm.id };
}

// Deletes one of the player's own VMs once no software runs in it.
export function deleteVm(s: GameState, vmId: string): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (hostOfVm(s, vm.id)) return fail("error.softwareInUse");
  s.workloads = s.workloads.filter((w) => w.id !== vm.id);
  return { ok: true };
}

// Installs a panel in one of the player's own VMs: a panel host whose web hosting capacity is the VM's booking. On a
// cluster still installing its hypervisor, the panel follows the hypervisor.
export function installPanelInVm(s: GameState, vmId: string, panelId: string): ActionResult {
  const vm = vmById(s, vmId), sw = softwareById(panelId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  if (hostOfVm(s, vm.id)) return fail("error.onePanel");
  const c = s.clusters.find((x) => x.id === vm.clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.platform && !controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  if (sizeError(vm, sw.controlPlane)) return fail("error.vmSize");
  const id = `clu${s.nextId++}`, after = Math.max(s.hour, c.switching?.doneAt ?? s.hour);
  s.clusters = [...s.clusters, { ...blank(s, id, freeName(s, sw.kind === "mail" ? "Mail" : "Web"), c.az, sw.kind), vm: vm.id, switching: { kind: sw.kind, to: panelId, doneAt: after + sw.installHours } }];
  return { ok: true, id };
}

// A new VM with a panel in it, as the guided setup and the Products app book it; returns the panel host id.
export function createPanelVm(s: GameState, clusterId: string, panelId: string, size: Resources = PANEL_VM_SIZE): ActionResult {
  const sw = softwareById(panelId);
  if (sw.id !== panelId || sw.kind === "cloud") return fail("error.unknownSoftware");
  const bad = sizeError(size, sw.controlPlane);
  if (bad) return fail(bad);
  const vm = createVm(s, clusterId, size);
  return vm.ok ? installPanelInVm(s, vm.id!, panelId) : vm;
}

const sizeError = (r: Resources, panel: Resources): string | null =>
  KEYS.some((k) => !Number.isFinite(r[k]) || r[k] < PANEL_VM_MIN[k] || vmCap(r, panel)[k] < 0) ? "error.vmSize" : null;

// Books a panel VM bigger or smaller: it must still hold its web spaces and fit on its node.
export function resizePanelVm(s: GameState, hostId: string, size: Resources): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId), vm = c && vmById(s, c.vm);
  if (!c || !vm) return fail("error.notPanelVm");
  const panel = controlPlaneUse({ panel: c.panel ?? c.switching?.to ?? null, platform: null });
  const bad = sizeError(size, panel);
  if (bad) return fail(bad);
  const inside = vmRoom(s, c).used, cap = vmCap(size, panel);
  if (KEYS.some((k) => inside[k] > cap[k] + 1e-9)) return fail("error.vmTooSmall");
  const d = vm.deviceId ? s.devices.find((x) => x.id === vm.deviceId) : undefined;
  if (d) {
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    if (KEYS.some((k) => used[k] - vm[k] + size[k] > cap[k] + 1e-9)) return fail("error.nodeFull");
  }
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, ...size } : w));
  freezeTick(s);
  return { ok: true };
}

// Removes a cluster with nothing on it: backups to it stop and its security marks go.
export function dropCluster(s: GameState, id: string) {
  s.clusters = s.clusters.filter((x) => x.id !== id).map((x) => (x.backup.targetId === id ? { ...x, backup: { targetId: null, every: "off" } } : x));
  const drop = (ids: string[]) => ids.filter((x) => x !== id);
  if (s.company.mail.kind === "self" && s.company.mail.clusterId === id) s.company = { ...s.company, mail: { kind: "none" } };
  s.security = { ...s.security, offline: drop(s.security.offline), hacked: drop(s.security.hacked), patched: drop(s.security.patched) };
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

// Backups of every workload in the cluster to another cluster, daily or weekly at night.
export function setBackup(s: GameState, clusterId: string, targetId: string | null, every: BackupEvery): ActionResult {
  if (!s.clusters.some((c) => c.id === clusterId)) return fail("error.unknownCluster");
  if (targetId !== null && (targetId === clusterId || !s.clusters.some((c) => c.id === targetId))) return fail("error.backupTarget");
  if (every !== "off" && targetId === null) return fail("error.backupTarget");
  update(s, clusterId, (c) => ({ ...c, backup: { targetId, every } }));
  return { ok: true };
}

const update = (s: GameState, id: string, fn: (c: Cluster) => Cluster) => {
  s.clusters = s.clusters.map((c) => (c.id === id ? fn(c) : c));
};

// Joins an empty server of the zone that runs the cluster's software to the cluster; the server's own cluster goes away.
// A panel host takes a second server from the year its panel clusters, and keeps one before.
export function addNode(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const panel = c.kind === "panel", id = c.panel ?? c.platform;
  if (panel && (c.vm || !id || !clustersIn(softwareById(id), yearOf(s.hour)))) return fail("error.panelHostOneServer");
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const own = clusterOf(s, d.id);
  if (own?.id === c.id) return fail("error.alreadyNode");
  if (!own || own.kind !== c.kind || !(own.panel ?? own.platform) || own.switching) return fail(panel ? "error.noPanel" : "error.noHypervisor");
  if (locationOf(s, d)?.az !== c.az) return fail("error.otherZone");
  if ((own.panel ?? own.platform) !== id) return fail(panel ? "error.otherPanel" : "error.otherHypervisor");
  if (workloadsOn(s, d.id).length) return fail("error.nodeNotEmpty");
  leave(s, own.id, d.id);
  update(s, c.id, (x) => ({ ...x, nodes: [...x.nodes, { deviceId, state: "active" }], controlPlane: x.controlPlane ?? deviceId }));
  return { ok: true };
}

// A node leaves its cluster; its control plane moves to the next node, and the last node takes the cluster with it.
const leave = (s: GameState, clusterId: string, deviceId: string) => {
  const c = s.clusters.find((x) => x.id === clusterId)!, nodes = c.nodes.filter((n) => n.deviceId !== deviceId);
  if (!nodes.length) return dropCluster(s, c.id);
  update(s, c.id, (x) => ({ ...x, nodes, controlPlane: x.controlPlane === deviceId ? nodes[0].deviceId : x.controlPlane }));
};

// A panel host is due an upgrade on an older PHP, or on the current one while a released patch is missing.
export const phpDue = (s: GameState, c: Cluster): boolean => c.kind === "panel" && (c.php !== phpAt(yearOf(s.hour)) || (patchOut(s) && vulnerable(s, c)));

// One panel host to the current PHP version with any released security patch; its sites run slower for the next hour.
export function upgradePhp(s: GameState, hostId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "panel") return fail("error.notPanelHost");
  if (!phpDue(s, c)) return fail(vulnerable(s, c) ? "error.patchPending" : "error.phpCurrent");
  update(s, c.id, (x) => ({ ...x, php: phpAt(yearOf(s.hour)), phpUntil: s.hour + PHP_UPGRADE_HOURS }));
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

// A node leaves its cluster once nothing runs on it, uninstalling its software; a panel host keeps at least one.
export function removeNode(s: GameState, deviceId: string): ActionResult {
  const c = clusterOf(s, deviceId);
  if (!c) return fail("error.notNode");
  if (c.kind === "panel" && c.nodes.length < 2) return fail("error.panelHostOneServer");
  if (workloadsOn(s, deviceId).length) return fail("error.nodeNotEmpty");
  leave(s, c.id, deviceId);
  return { ok: true };
}

const nodeAction = (s: GameState, deviceId: string, state: "active" | "cordoned"): ActionResult => {
  if (!clusterOf(s, deviceId)) return fail("error.notNode");
  setNodeState(s, deviceId, state);
  return { ok: true };
};
export const cordon = (s: GameState, deviceId: string): ActionResult => nodeAction(s, deviceId, "cordoned");
export const uncordon = (s: GameState, deviceId: string): ActionResult => nodeAction(s, deviceId, "active");

// Moves every workload that fits elsewhere now; the rest follow each hour as room appears.
export function drain(s: GameState, deviceId: string): ActionResult {
  const c = clusterOf(s, deviceId);
  if (!c) return fail("error.notNode");
  setNodeState(s, deviceId, "draining");
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
  if (on && feature === "balance" && !c.ha.live) return fail("error.needsLiveMigration");
  const ha = { ...c.ha, [feature]: on, ...(feature === "live" && !on ? { balance: false } : {}) };
  update(s, c.id, (x) => ({ ...x, ha }));
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
  const spec = PRODUCTS[v.product], size = sizeOf(v.spec);
  const inZone = (az: string) => v.zone === null || v.zone === az;
  let w: Workload | null = null, az = "";
  if (spec.runsOn === "none") return { ok: true };
  if (spec.runsOn === "cluster") {
    for (const c of s.clusters.filter((x) => (clusterId ? x.id === clusterId : inZone(x.az)) && supports(x, v.product))) {
      const node = controlPlaneUp(s, c) ? pickNode(s, deviceId ? { ...c, nodes: c.nodes.filter((n) => n.deviceId === deviceId) } : c, size, null, !!deviceId) : null;
      if (node) { w = workload(s, v.id, { ...size, clusterId: c.id, deviceId: c.vm ? null : node }); az = c.az; break; }
    }
    const target = clusterId ? s.clusters.find((x) => x.id === clusterId) : undefined;
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
      if (!loc.dc || !inZone(loc.az) || r.arriveAt !== null || slot === undefined || p.watts + watts > p.limitWatts) continue;
      w = workload(s, v.id, { rackId: r.id, slot, units, watts });
      az = loc.az;
      break;
    }
    if (!w) return fail("error.noRackSpace");
  }
  s.workloads = [...s.workloads, w];
  if (v.zone === null) s.services = s.services.map((x) => (x.id === v.id ? { ...x, zone: az } : x));
  return { ok: true, id: w.id };
}

// spec defaults to the line's smallest size this year.
export interface Order { label: string; zone?: string | null; clusterId?: string | null; sla?: Sla; price?: number; spec?: Spec; deviceId?: string | null }

// Signs a contract with the catalog's terms and places it; nothing is recorded when it can't be placed.
// price is per hour for hourly products and per year for yearly ones; it defaults to the market reference.
export function provisionService(s: GameState, customerId: string, product: Product, order: Order): ActionResult {
  if (!s.customers.some((c) => c.id === customerId && c.churnedAt === null)) return fail("error.unknownCustomer");
  const spec = PRODUCTS[product], sla = order.sla ?? "basic", want = order.spec ?? sizeSpec(product, 0, yearOf(s.hour));
  const reference = marketPrice(product, want, yearOf(s.hour), sla);
  const price = order.price ?? (spec.period === "hour" ? reference / 730 : reference);
  const nextId = s.nextId;
  const id = addService(s, customerId, product, order.label, price, spec.period, spec.commitMonths, order.zone ?? null, want, sla);
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
  return { ok: true, id };
}
