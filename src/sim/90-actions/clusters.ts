import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { marketPrice, planOf, PRODUCTS, type Sla } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { DEFAULT_PANEL, DEFAULT_PLATFORM, softwareById, SWITCH_FEE, SWITCH_PER_HOUR } from "../10-catalog/platforms";
import {
  clusterOf, controlPlaneUp, fitsControlPlane, moveOff, pickNode, servedBy, serverTaken, setNodeState, workloadsOf, workloadsOn,
  type BackupEvery, type Cluster, type Placement, type Workload,
} from "../60-infra/cluster";
import { freeSlots, locationOf, rackPower, working } from "../60-infra/status";
import { addService } from "./customers";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
export const CLUSTER_NAME_MAX = 40;

export function createCluster(s: GameState, locationId: string, name: string, panel = DEFAULT_PANEL, platform = DEFAULT_PLATFORM): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  const n = name.trim();
  if (!n || n.length > CLUSTER_NAME_MAX) return fail("error.clusterName");
  if (s.clusters.some((c) => c.name === n)) return fail("error.clusterNameTaken");
  if (softwareById(panel).id !== panel || softwareById(panel).kind !== "panel" || softwareById(platform).id !== platform || softwareById(platform).kind !== "cloud") return fail("error.unknownSoftware");
  const id = `clu${s.nextId++}`;
  s.clusters = [...s.clusters, {
    id, name: n, az: loc.az, placement: "pack", nodes: [], panel, platform, controlPlane: null, switching: null, backup: { targetId: null, every: "off" },
  }];
  return { ok: true, id };
}

// Moves to other software: every workload it serves goes offline for an hour per 4 of them, at a fee per workload.
export function setSoftware(s: GameState, clusterId: string, id: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const sw = softwareById(id);
  if (sw.id !== id) return fail("error.unknownSoftware");
  if (c.switching) return fail("error.switching");
  if ((sw.kind === "panel" ? c.panel : c.platform) === id) return fail("error.sameSoftware");
  const moved = s.workloads.filter((w) => w.clusterId === c.id && servedBy(s, w) === sw.kind).length;
  const fee = SWITCH_FEE * moved;
  if (fee > s.cash) return fail("error.noCash");
  s.cash = Math.round((s.cash - fee) * 100) / 100;
  if (fee > 0) s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.switch", params: { cluster: c.name, name: sw.name }, amount: -fee }];
  update(s, c.id, (x) => ({ ...x, switching: { kind: sw.kind, to: id, doneAt: s.hour + Math.max(1, Math.ceil(moved / SWITCH_PER_HOUR)) } }));
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

export function addNode(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!modelById(d.model).server) return fail("error.notServer");
  if (!d.rackId) return fail("error.notMounted");
  if (locationOf(s, d)?.az !== c.az) return fail("error.otherZone");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  // The first node hosts the control plane.
  update(s, c.id, (x) => ({ ...x, nodes: [...x.nodes, { deviceId, state: "active" }], controlPlane: x.controlPlane ?? deviceId }));
  return { ok: true };
}

// A node leaves its cluster once nothing runs on it; its control plane moves to the next node.
export function removeNode(s: GameState, deviceId: string): ActionResult {
  const c = clusterOf(s, deviceId);
  if (!c) return fail("error.notNode");
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

const workload = (s: GameState, serviceId: string, w: Partial<Workload>): Workload => ({
  id: `wl${s.nextId++}`, serviceId, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, vcpu: 0, ramGb: 0, diskGb: 0, placedAt: s.hour,
  stopped: false, busyUntil: 0, backupAt: null, ...w,
});

// Places a service on hardware by its product: a cluster workload (in clusterId, or the first cluster of its zone with room),
// a whole free server for dedicated, rack units with power for colocation. A service without a zone takes the zone it lands in.
export function placeService(s: GameState, serviceId: string, clusterId: string | null = null): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.endedAt !== null) return fail("error.unknownService");
  if (workloadsOf(s, v.id).length) return fail("error.placed");
  const spec = PRODUCTS[v.product], plan = planOf(v.product, v.plan), size = plan.size(yearOf(s.hour));
  const inZone = (az: string) => v.zone === null || v.zone === az;
  let w: Workload | null = null, az = "";
  if (spec.runsOn === "none") return { ok: true };
  if (spec.runsOn === "cluster") {
    // ponytail: no high-availability clusters yet, so HA products can't be placed.
    if (spec.ha) return fail("error.needsHaCluster");
    for (const c of s.clusters.filter((x) => (clusterId ? x.id === clusterId : inZone(x.az)))) {
      const node = controlPlaneUp(s, c) ? pickNode(s, c, size) : null;
      if (node) { w = workload(s, v.id, { ...size, clusterId: c.id, deviceId: node }); az = c.az; break; }
    }
    const target = clusterId ? s.clusters.find((x) => x.id === clusterId) : undefined;
    if (!w) return fail(target && !controlPlaneUp(s, target) ? "error.controlPlaneDown" : "error.noCapacity");
  } else if (spec.runsOn === "server") {
    const d = s.devices.find((x) => x.rackId && (modelById(x.model).server?.ramGb ?? 0) >= size.ramGb && inZone(locationOf(s, x)?.az ?? "") && !serverTaken(s, x.id));
    if (!d) return fail("error.noFreeServer");
    w = workload(s, v.id, { deviceId: d.id });
    az = locationOf(s, d)!.az;
  } else {
    const units = plan.units!, watts = plan.watts!;
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

export interface Order { label: string; plan?: string | null; zone?: string | null; clusterId?: string | null; sla?: Sla; price?: number }

// Signs a contract with the catalog's terms and places it; nothing is recorded when it can't be placed.
// price is per hour for hourly products and per year for yearly ones; it defaults to the market reference.
export function provisionService(s: GameState, customerId: string, product: Product, order: Order): ActionResult {
  if (!s.customers.some((c) => c.id === customerId && c.churnedAt === null)) return fail("error.unknownCustomer");
  const spec = PRODUCTS[product], plan = planOf(product, order.plan ?? null), sla = order.sla ?? "basic";
  const reference = marketPrice(product, plan.id, yearOf(s.hour), sla);
  const price = order.price ?? (spec.period === "hour" ? reference / 730 : reference);
  const nextId = s.nextId;
  const id = addService(s, customerId, product, order.label, price, spec.period, spec.commitMonths, order.zone ?? null, plan.id, sla);
  const placed = placeService(s, id, order.clusterId ?? null);
  if (!placed.ok) {
    Object.assign(s, { services: s.services.filter((v) => v.id !== id), nextId });
    return placed;
  }
  return { ok: true, id };
}
