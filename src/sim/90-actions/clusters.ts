import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { marketPrice, PRODUCTS, sizeSpec, type Resources, type Sla, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { phpAt, softwareById, type SoftwareKind } from "../10-catalog/platforms";
import { HA_SKILL } from "../10-catalog/research";
import { freezeTick } from "../60-infra/usage";
import { PHP_UPGRADE_HOURS } from "../60-infra/php";
import { markPatched, patchOut, vulnerable } from "../60-infra/security";
import {
  anchorOf, bookable, clusterOf, controlPlaneUp, controlPlaneUse, fitsControlPlane, HA_OFF, KEYS, moveOff, noRoomError, nodeUsed, pickNode, serverTaken,
  setNodeState, supports, vmById, vmRoom, workloadsOf, workloadsOn, type BackupEvery, type Cluster, type Ha, type Placement, type Workload,
} from "../60-infra/cluster";
import { freeSlots, locationOf, rackPower, working } from "../60-infra/status";
import { addService } from "./customers";
import type { ActionResult } from "./hardware";
import { sizeOf } from "../30-market/spec";

const fail = (error: string): ActionResult => ({ ok: false, error });
export const CLUSTER_NAME_MAX = 40;
// economy.md, Panel VMs: the size the setup and the Products app suggest, and the smallest the player can book.
export const PANEL_VM_SIZE: Resources = { vcpu: 2, ramGb: 2, diskGb: 50 };
export const PANEL_VM_MIN: Resources = { vcpu: 1, ramGb: 1, diskGb: 10 };

const blank = (s: GameState, id: string, name: string, az: string, kind: SoftwareKind): Cluster => ({
  id, name, az, kind, placement: "pack", nodes: [], panel: null, platform: null, vm: null, controlPlane: null, switching: null,
  backup: { targetId: null, every: "off" }, php: phpAt(yearOf(s.hour)), phpUntil: -1, ha: { ...HA_OFF },
});
const validName = (s: GameState, name: string): string | null => {
  const n = name.trim();
  if (!n || n.length > CLUSTER_NAME_MAX) return "error.clusterName";
  return s.clusters.some((c) => c.name === n) ? "error.clusterNameTaken" : null;
};
// The next free name of the pattern, numbered from 1.
const freeName = (s: GameState, base: string): string => {
  for (let i = 1; ; i++) if (!s.clusters.some((c) => c.name === `${base} ${i}`)) return `${base} ${i}`;
};

// A new hypervisor cluster runs nothing until a hypervisor is installed on it with setSoftware.
export function createCluster(s: GameState, locationId: string, name: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  const bad = validName(s, name);
  if (bad) return fail(bad);
  const id = `clu${s.nextId++}`;
  s.clusters = [...s.clusters, blank(s, id, name.trim(), loc.az, "cloud")];
  return { ok: true, id };
}

// Installs a hosting panel straight on a free mounted server: a bare-metal panel host for web hosting only.
export function installPanel(s: GameState, deviceId: string, panelId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId), sw = softwareById(panelId);
  if (!d) return fail("error.unknownDevice");
  if (sw.id !== panelId || sw.kind !== "panel") return fail("error.unknownSoftware");
  if (!modelById(d.model).server) return fail("error.notServer");
  if (!d.rackId) return fail("error.notMounted");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  const loc = locationOf(s, d)!, id = `clu${s.nextId++}`, label = d.label ?? d.name;
  const name = s.clusters.some((c) => c.name === label) ? freeName(s, label) : label;
  const host: Cluster = { ...blank(s, id, name, loc.az, "panel"), nodes: [{ deviceId, state: "active" }], controlPlane: deviceId };
  if (!fitsControlPlane(s, { ...host, panel: panelId }, deviceId)) return fail(working(s, deviceId) ? "error.nodeFull" : "error.nodeDown");
  s.clusters = [...s.clusters, { ...host, switching: { kind: "panel", to: panelId, doneAt: s.hour + sw.installHours } }];
  return { ok: true, id };
}

// Creates one of the player's own VMs on a hypervisor cluster and installs a panel in it: a panel host whose web hosting
// capacity is the VM's booking. A cluster still installing its hypervisor takes the VM; the panel follows the hypervisor.
export function createPanelVm(s: GameState, clusterId: string, panelId: string, size: Resources = PANEL_VM_SIZE): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), sw = softwareById(panelId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || (!c.platform && c.switching?.kind !== "cloud")) return fail("error.needsPlatform");
  if (sw.id !== panelId || sw.kind !== "panel") return fail("error.unknownSoftware");
  if (c.platform && !controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  const bad = sizeError(size, sw.controlPlane);
  if (bad) return fail(bad);
  const node = pickNode(s, c, size);
  if (!node) return fail("error.noCapacity");
  const vm = workload(s, "", { ...size, clusterId: c.id, deviceId: node }), id = `clu${s.nextId++}`;
  const after = Math.max(s.hour, c.switching?.doneAt ?? s.hour);
  s.workloads = [...s.workloads, vm];
  s.clusters = [...s.clusters, { ...blank(s, id, freeName(s, "Web"), c.az, "panel"), vm: vm.id, switching: { kind: "panel", to: panelId, doneAt: after + sw.installHours } }];
  return { ok: true, id };
}

const sizeError = (r: Resources, panel: Resources): string | null =>
  KEYS.some((k) => !Number.isFinite(r[k]) || r[k] < Math.max(PANEL_VM_MIN[k], panel[k])) ? "error.vmSize" : null;

// Books a panel VM bigger or smaller: it must still hold its web spaces and fit on its node.
export function resizePanelVm(s: GameState, hostId: string, size: Resources): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId), vm = c && vmById(s, c.vm);
  if (!c || !vm) return fail("error.notPanelVm");
  const panel = controlPlaneUse({ panel: c.panel ?? c.switching?.to ?? null, platform: null });
  const bad = sizeError(size, panel);
  if (bad) return fail(bad);
  const inside = vmRoom(s, c).used;
  if (KEYS.some((k) => inside[k] + panel[k] > size[k] + 1e-9)) return fail("error.vmTooSmall");
  const d = vm.deviceId ? s.devices.find((x) => x.id === vm.deviceId) : undefined;
  if (d) {
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    if (KEYS.some((k) => used[k] - vm[k] + size[k] > cap[k] + 1e-9)) return fail("error.nodeFull");
  }
  s.workloads = s.workloads.map((w) => (w.id === vm.id ? { ...w, ...size } : w));
  freezeTick(s);
  return { ok: true };
}

// Removes an empty panel host: its server is free again, its VM is deleted.
export function removePanelHost(s: GameState, hostId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c || c.kind !== "panel") return fail("error.notPanelHost");
  if (s.workloads.some((w) => w.clusterId === c.id)) return fail("error.nodeNotEmpty");
  s.clusters = s.clusters.filter((x) => x.id !== c.id).map((x) => (x.backup.targetId === c.id ? { ...x, backup: { targetId: null, every: "off" } } : x));
  if (c.vm) s.workloads = s.workloads.filter((w) => w.id !== c.vm);
  const drop = (ids: string[]) => ids.filter((id) => id !== c.id);
  s.security = { ...s.security, offline: drop(s.security.offline), hacked: drop(s.security.hacked), patched: drop(s.security.patched) };
  return { ok: true };
}

// Installs the cluster's control plane, a hypervisor on a hypervisor cluster or a panel on a panel host, or replaces it
// once nothing runs on the cluster. The control plane is busy for the software's install hours; its license is billed monthly.
export function setSoftware(s: GameState, clusterId: string, id: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const sw = softwareById(id);
  if (sw.id !== id) return fail("error.unknownSoftware");
  if (sw.kind !== c.kind) return fail("error.wrongKind");
  if (c.switching) return fail("error.switching");
  const slot = sw.kind === "panel" ? "panel" : "platform";
  if (c[slot] === id) return fail("error.sameSoftware");
  if (!c.controlPlane && !c.vm) return fail("error.noNodes");
  if (c[slot] && s.workloads.some((w) => w.clusterId === c.id)) return fail("error.softwareInUse");
  if (c.controlPlane && !fitsControlPlane(s, { ...c, [slot]: id }, c.controlPlane)) return fail(working(s, c.controlPlane) ? "error.nodeFull" : "error.nodeDown");
  update(s, c.id, (x) => ({ ...x, switching: { kind: sw.kind, to: id, doneAt: s.hour + sw.installHours } }));
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

// Adds a free mounted server of the zone to a hypervisor cluster; a panel host keeps its one server.
export function addNode(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud") return fail("error.panelHostOneServer");
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!modelById(d.model).server) return fail("error.notServer");
  if (!d.rackId) return fail("error.notMounted");
  if (locationOf(s, d)?.az !== c.az) return fail("error.otherZone");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  // The first node runs the control plane.
  update(s, c.id, (x) => ({ ...x, nodes: [...x.nodes, { deviceId, state: "active" }], controlPlane: x.controlPlane ?? deviceId }));
  return { ok: true };
}

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

// A node leaves its hypervisor cluster once nothing runs on it; its control plane moves to the next node.
export function removeNode(s: GameState, deviceId: string): ActionResult {
  const c = clusterOf(s, deviceId);
  if (!c) return fail("error.notNode");
  if (c.kind === "panel") return fail("error.panelHostOneServer");
  if (workloadsOn(s, deviceId).length) return fail("error.nodeNotEmpty");
  update(s, c.id, (x) => {
    const nodes = x.nodes.filter((n) => n.deviceId !== deviceId);
    return { ...x, nodes, controlPlane: x.controlPlane === deviceId ? nodes[0]?.deviceId ?? null : x.controlPlane };
  });
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
  stopped: false, busyUntil: 0, backupAt: null, ...w,
});

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
    const d = s.devices.find((x) => x.rackId && (modelById(x.model).server?.ramGb ?? 0) >= size.ramGb && inZone(locationOf(s, x)?.az ?? "") && !serverTaken(s, x.id));
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
  if (!placed.ok) {
    Object.assign(s, { services: s.services.filter((v) => v.id !== id), nextId });
    return placed;
  }
  return { ok: true, id };
}
