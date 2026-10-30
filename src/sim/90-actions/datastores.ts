// economy.md, Datastores: servers attached to a VMwhere cluster as shared storage for VM disks.
import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import { DATASTORE_ATTACH_HOURS, DATASTORE_FROM, DATASTORES_MAX, FC_HBA_PRICE, LIVE_DISK_MOVE, softwareById, type DatastoreProtocol } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import {
  controlPlaneUp, datastoreFits, deltaGb, datastoreGbit, datastoreUp, lostDisk, nodeTakes, serverTaken, type Cluster, type Datastore,
} from "../60-infra/cluster";
import { locationOf, raidUsable } from "../60-infra/status";
import { LAN_GB_PER_HOUR } from "../85-products/products";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const update = (s: GameState, id: string, datastores: Datastore[]) => {
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, datastores } : c));
};

// Whether the server can become a datastore of the cluster, or why not.
export function datastoreBlock(s: GameState, c: Cluster, deviceId: string): string | null {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return "error.unknownDevice";
  if (!modelById(d.model).server) return "error.notServer";
  if (!raidUsable(d)) return "error.noDrives";
  if (locationOf(s, d)?.az !== c.az) return "error.otherZone";
  return serverTaken(s, d.id) || d.software.length ? "error.serverInUse" : null;
}

// Attaches a free server with drives in the cluster's zone as a datastore, usable an hour later. Fibre Channel buys a host
// adapter for every node of the cluster.
export function attachDatastore(s: GameState, clusterId: string, deviceId: string, protocol: DatastoreProtocol): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || !c.platform || !softwareById(c.platform).datastores) return fail("error.noDatastores");
  if (!controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  if (c.datastores.length >= DATASTORES_MAX) return fail("error.datastoresFull");
  if (!(protocol in DATASTORE_FROM) || yearOf(s.hour) < DATASTORE_FROM[protocol]) return fail("error.protocolTooNew");
  const bad = datastoreBlock(s, c, deviceId);
  if (bad) return fail(bad);
  const cost = protocol === "fc" ? FC_HBA_PRICE * c.nodes.length : 0;
  if (s.cash < cost) return fail("error.noCash");
  if (cost) {
    s.cash = Math.round((s.cash - cost) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key: "ledger.fcAdapters", params: { cluster: c.name, count: c.nodes.length }, amount: -cost }];
  }
  update(s, c.id, [...c.datastores, { deviceId, protocol, readyAt: s.hour + DATASTORE_ATTACH_HOURS }]);
  return { ok: true };
}

// Frees a datastore no disk is on.
export function detachDatastore(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (!c.datastores.some((x) => x.deviceId === deviceId)) return fail("error.notDatastore");
  if (s.workloads.some((w) => w.datastore === deviceId)) return fail("error.datastoreNotEmpty");
  update(s, c.id, c.datastores.filter((x) => x.deviceId !== deviceId));
  return { ok: true };
}

// Hours a disk move takes a VM offline: before Storage vMotion the copy at the slower datastore's speed, at least one.
export function diskMoveDowntime(s: GameState, diskGb: number, via: Datastore[]): number {
  if (yearOf(s.hour) >= LIVE_DISK_MOVE || !via.length) return 0;
  const gbit = Math.min(...via.map((x) => datastoreGbit(s, x)));
  return Math.max(1, Math.ceil(diskGb / (gbit * LAN_GB_PER_HOUR)));
}

// Moves a VM's disk with its snapshot deltas between its node (to null) and a datastore of its cluster with room.
export function moveDisk(s: GameState, workloadId: string, to: string | null): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!w || !c || !w.deviceId) return fail("error.unknownWorkload");
  if ((w.datastore ?? null) === to) return fail("error.diskThere");
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  if (!controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  const target = to ? c.datastores.find((x) => x.deviceId === to) : undefined, disk = w.diskGb + deltaGb(w);
  if (to && !target) return fail("error.notDatastore");
  if (target && !datastoreUp(s, target)) return fail("error.datastoreDown");
  if (target && !datastoreFits(s, target.deviceId, disk)) return fail("error.nodeFull");
  const node = s.devices.find((x) => x.id === w.deviceId);
  if (!to && (!node || !nodeTakes(s, node, { ...w, diskGb: disk, datastore: undefined }, w))) return fail("error.nodeFull");
  const via = c.datastores.filter((x) => x.deviceId === to || x.deviceId === w.datastore);
  const down = diskMoveDowntime(s, disk, via);
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, datastore: to ?? undefined, placedAt: s.hour, busyUntil: Math.max(x.busyUntil, s.hour + down) } : x));
  return { ok: true };
}
