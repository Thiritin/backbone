import { softwareById } from "../10-catalog/platforms";
import type { Resources } from "../10-catalog/products";
import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { bookable, clusterOf, controlPlaneUp, lostDisk, noRoomError, nodeUsed, pickNode, supports, type Workload } from "../60-infra/cluster";
import { working } from "../60-infra/status";
import { freezeTick } from "../60-infra/usage";
import {
  LAN_GB_PER_HOUR, LOSS_RESTORED, LOSS_RESTORED_MAX, lossReview, restoreHours, zoneLinkGbit, type LossItem,
} from "../85-products/products";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const VMS = new Set(["vps", "cloud"]);
// Below 10 Gbit/s a move between zones is cold: the workload is offline for the whole transfer.
const LIVE_ZONE_GBIT = 10;

const patch = (s: GameState, id: string, p: Partial<Workload>) => {
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w));
};

function clusterWorkload(s: GameState, id: string) {
  const w = s.workloads.find((x) => x.id === id);
  const c = w?.clusterId ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
  return w && c ? { w, c } : null;
}

export function stopWorkload(s: GameState, id: string): ActionResult {
  const found = clusterWorkload(s, id);
  if (!found) return fail("error.unknownWorkload");
  if (found.w.stopped) return fail("error.alreadyStopped");
  patch(s, id, { stopped: true });
  freezeTick(s);
  return { ok: true };
}

export function startWorkload(s: GameState, id: string): ActionResult {
  const found = clusterWorkload(s, id);
  if (!found) return fail("error.unknownWorkload");
  if (!found.w.stopped) return fail("error.alreadyRunning");
  if (!controlPlaneUp(s, found.c)) return fail("error.controlPlaneDown");
  if (lostDisk(s, found.w)) return fail("error.lostDisk");
  patch(s, id, { stopped: false });
  freezeTick(s);
  return { ok: true };
}

// Hours a workload is offline while it moves over a link. economy.md, Workloads and migration: virtual machines move live
// when the platform supports it (between zones only over 10 Gbit/s or more); other workloads are back within a minute.
export function migrationDowntime(s: GameState, w: Workload, gbit: number, otherZone: boolean): number {
  const product = s.services.find((v) => v.id === w.serviceId)?.product ?? "vps";
  const live = softwareById(s.clusters.find((c) => c.id === w.clusterId)?.platform ?? "").live && (!otherZone || gbit >= LIVE_ZONE_GBIT);
  if (live || (!otherZone && !VMS.has(product))) return 0;
  return Math.max(1, Math.ceil((w.diskGb + w.ramGb) / (gbit * LAN_GB_PER_HOUR)));
}

// The nodes a workload can move to: active, working nodes of clusters that serve its product and a link reaches, with room
// for its booking. free is what each node has left to book; down the hours the move takes it offline.
export interface MigrationTarget { deviceId: string; clusterId: string; free: Resources; down: number }
export function migrationTargets(s: GameState, id: string): MigrationTarget[] {
  const found = clusterWorkload(s, id);
  if (!found) return [];
  const { w, c } = found, product = s.services.find((v) => v.id === w.serviceId)?.product;
  return s.clusters.filter((to) => (!product || supports(to, product)) && zoneLinkGbit(s, c.az, to.az) > 0).flatMap((to) => to.nodes.flatMap((n) => {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active" || d.id === w.deviceId || !working(s, d.id)) return [];
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    const free = { vcpu: cap.vcpu - used.vcpu, ramGb: cap.ramGb - used.ramGb, diskGb: cap.diskGb - used.diskGb };
    if (KEYS.some((k) => w[k] > free[k] + 1e-9)) return [];
    return [{ deviceId: d.id, clusterId: to.id, free, down: migrationDowntime(s, w, zoneLinkGbit(s, c.az, to.az), c.az !== to.az) }];
  }));
}
const KEYS = ["vcpu", "ramGb", "diskGb"] as const;

// Moves a workload to a node of its cluster, or of a cluster in another zone that a link reaches.
export function migrateWorkload(s: GameState, id: string, toDeviceId: string): ActionResult {
  const found = clusterWorkload(s, id);
  if (!found) return fail("error.unknownWorkload");
  const { w, c } = found, to = clusterOf(s, toDeviceId), d = s.devices.find((x) => x.id === toDeviceId);
  if (!to || !d) return fail("error.notNode");
  if (w.deviceId === toDeviceId) return fail("error.sameHost");
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour) return fail("error.workloadBusy");
  if (!controlPlaneUp(s, c) || !controlPlaneUp(s, to)) return fail("error.controlPlaneDown");
  const product = s.services.find((v) => v.id === w.serviceId)?.product;
  if (product && !supports(to, product)) return fail(noRoomError(s, product, to.id));
  if (to.nodes.find((n) => n.deviceId === toDeviceId)?.state !== "active" || !working(s, toDeviceId)) return fail("error.nodeDown");
  const cap = bookable(s, d), used = nodeUsed(s, toDeviceId);
  if ((["vcpu", "ramGb", "diskGb"] as const).some((k) => used[k] + w[k] > cap[k] + 1e-9)) return fail("error.nodeFull");
  const gbit = zoneLinkGbit(s, c.az, to.az);
  if (!gbit) return fail("error.noZoneLink");
  const down = migrationDowntime(s, w, gbit, c.az !== to.az);
  patch(s, id, { deviceId: toDeviceId, clusterId: to.id, placedAt: s.hour, busyUntil: s.hour + down });
  if (c.az !== to.az) s.services = s.services.map((v) => (v.id === w.serviceId ? { ...v, zone: to.az } : v));
  freezeTick(s);
  return { ok: true };
}

const openItem = (s: GameState, workloadId: string): LossItem | undefined =>
  s.lossReports.flatMap((r) => r.items).filter((i) => i.workloadId === workloadId && !i.restored).at(-1);

// Brings a lost workload back on a working node: from its last backup, which takes the volume's size ÷ the link speed,
// or on an empty disk without one.
export function restoreWorkload(s: GameState, id: string): ActionResult {
  const found = clusterWorkload(s, id);
  if (!found) return fail("error.unknownWorkload");
  const { w, c } = found;
  if (!lostDisk(s, w)) return fail("error.notLost");
  if (!controlPlaneUp(s, c)) return fail("error.controlPlaneDown");
  const target = s.clusters.find((x) => x.id === c.backup.targetId);
  if (w.backupAt !== null && (!target || !controlPlaneUp(s, target))) return fail("error.backupUnavailable");
  const node = pickNode(s, c, w);
  if (!node) return fail("error.noCapacity");
  const hours = w.backupAt !== null ? restoreHours(s, w) : 0;
  const lostAt = s.devices.find((d) => d.id === w.deviceId)?.dataLost ?? s.hour;
  patch(s, id, { deviceId: node, placedAt: s.hour, busyUntil: s.hour + hours, stopped: false });
  const item = openItem(s, id);
  if (item) {
    s.lossReports = s.lossReports.map((r) => ({ ...r, items: r.items.map((i) => (i === item ? { ...i, restored: true } : i)) }));
    const cus = s.customers.find((x) => x.id === item.customerId);
    if (cus && w.backupAt !== null) {
      bump(cus, Math.max(LOSS_RESTORED_MAX, LOSS_RESTORED - Math.max(0, lostAt - w.backupAt)));
      lossReview(s, cus);
    }
  }
  return { ok: true };
}
