import { nowHours } from "../00-core/time";
import { isService, softwareById } from "../10-catalog/platforms";
import type { Resources } from "../10-catalog/products";
import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import {
  bookable, clusterOf, controlPlaneUp, hostOfVm, isOwnVm, liveBetween, lostDisk, noRoomError, nodeTakes, nodeUsed, pickNode, supports, vmOf, vmRoom, type Cluster, type Workload,
} from "../60-infra/cluster";
import { renumber, renumberError } from "../60-infra/addresses";
import { handJob, type How } from "../60-infra/handwork";
import { migrationHours } from "../60-infra/migration";
import { RECOVER_HOURS } from "../60-infra/power";
import { locationOf, working } from "../60-infra/status";
import { freezeTick } from "../60-infra/usage";
import {
  LAN_GB_PER_HOUR, LOSS_RESTORED, LOSS_RESTORED_MAX, lossReview, moveGbit, restoreHours, type LossItem,
} from "../85-products/products";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
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
  // An OS still installing is lost with the power, as on a server.
  const os = found.w.os && found.w.os.installedAt > nowHours(s) ? { os: null } : {};
  patch(s, id, { stopped: true, ...os });
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
// when their cluster has live migration on and the hypervisor can do it (between zones only over 10 Gbit/s or more, never
// off a failed node, and to a node toId of another CPU vendor only in compatibility mode); web spaces are back within a
// minute inside a zone.
export function migrationDowntime(s: GameState, w: Workload, gbit: number, otherZone: boolean, toId?: string): number {
  const c = s.clusters.find((x) => x.id === w.clusterId);
  const vm = isOwnVm(w) || c?.kind === "cloud" || (!!c && isService(c.kind));
  const from = s.devices.find((d) => d.id === w.deviceId), to = s.devices.find((d) => d.id === toId);
  const live = !!c?.platform && softwareById(c.platform).live && c.ha.live && !!from && working(s, from.id) && (!otherZone || gbit >= LIVE_ZONE_GBIT)
    && (!to || liveBetween(s, from, to));
  if (live || (!otherZone && !vm)) return 0;
  return Math.max(1, Math.ceil((w.diskGb + w.ramGb) / (gbit * LAN_GB_PER_HOUR)));
}

// Where a workload can move: active, working nodes of hypervisor clusters for a VM, other panel hosts for a web space, of
// clusters that sell its product and a link reaches, with the disk for its booking. to is a node's device id or a panel VM
// host's id; free is what it has left to book; down the hours the move takes it offline.
export interface MigrationTarget { to: string; name: string; clusterId: string; free: Resources; down: number }
export function migrationTargets(s: GameState, id: string): MigrationTarget[] {
  const found = clusterWorkload(s, id);
  if (!found) return [];
  const { w, c } = found, product = s.services.find((v) => v.id === w.serviceId)?.product;
  if (!controlPlaneUp(s, c)) return [];
  const takes = (to: Cluster) => (product ? supports(to, product) : to.kind === "cloud" && !!to.platform);
  return s.clusters.filter((to) => takes(to) && moveGbit(s, c.az, to.az) > 0).flatMap((to): MigrationTarget[] => {
    const down = migrationDowntime(s, w, moveGbit(s, c.az, to.az), c.az !== to.az);
    if (to.vm) {
      const room = vmRoom(s, to), free = left(room.cap, room.used);
      return to.id !== c.id && pickNode(s, to, w) ? [{ to: to.id, name: to.name, clusterId: to.id, free, down }] : [];
    }
    return to.nodes.flatMap((n) => {
      const d = s.devices.find((x) => x.id === n.deviceId);
      if (!d || n.state !== "active" || d.id === w.deviceId || !working(s, d.id)) return [];
      if (!nodeTakes(s, d, w)) return [];
      const free = left(bookable(s, d), nodeUsed(s, d.id));
      return [{ to: d.id, name: d.label ?? d.name, clusterId: to.id, free, down: migrationDowntime(s, w, moveGbit(s, c.az, to.az), c.az !== to.az, d.id) }];
    });
  });
}
// What is left to book; a booking past the physical amount leaves none.
const left = (a: Resources, b: Resources): Resources => ({ vcpu: Math.max(0, a.vcpu - b.vcpu), ramGb: Math.max(0, a.ramGb - b.ramGb), diskGb: Math.max(0, a.diskGb - b.diskGb) });

// Moves a workload to a node of its cluster, to another cluster in a zone a link reaches, or a web space into a panel VM
// host (to is then the host's id). A service that changes location is renumbered; announced says its customer agreed to the move.
export function migrateWorkload(s: GameState, id: string, toId: string, announced = false): ActionResult {
  const found = clusterWorkload(s, id);
  if (!found) return fail("error.unknownWorkload");
  const { w, c } = found, vmHost = s.clusters.find((x) => x.id === toId && x.vm), to = vmHost ?? clusterOf(s, toId);
  const d = s.devices.find((x) => x.id === toId);
  if (!to || (!vmHost && !d)) return fail("error.notNode");
  if (c.kind === "panel" && to.id !== c.id) return migrateWebspace(s, id, to.id);
  if (w.deviceId === toId || w.clusterId === vmHost?.id) return fail("error.sameHost");
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  if (!controlPlaneUp(s, c) || !controlPlaneUp(s, to)) return fail("error.controlPlaneDown");
  const product = s.services.find((v) => v.id === w.serviceId)?.product;
  if (product ? !supports(to, product) : to.kind !== "cloud") return fail(product ? noRoomError(s, product, to.id) : "error.needsPlatform");
  if (vmHost) {
    if (!pickNode(s, vmHost, w)) return fail("error.nodeFull");
  } else {
    if (to.nodes.find((n) => n.deviceId === toId)?.state !== "active" || !working(s, toId)) return fail("error.nodeDown");
    if (!nodeTakes(s, d!, w)) return fail("error.nodeFull");
  }
  const gbit = moveGbit(s, c.az, to.az);
  if (!gbit) return fail("error.noZoneLink");
  const [fromLoc, toLoc] = [c.az, to.az].map((az) => s.locations.find((l) => l.az === az)), ids = w.serviceId ? [w.serviceId] : [];
  const noAddress = fromLoc && toLoc && renumberError(s, ids, fromLoc, toLoc);
  if (noAddress) return fail(noAddress);
  const down = migrationDowntime(s, w, gbit, c.az !== to.az, vmHost ? undefined : toId);
  patch(s, id, { deviceId: vmHost ? null : toId, clusterId: to.id, placedAt: s.hour, busyUntil: s.hour + down, stuck: undefined });
  if (c.az !== to.az) {
    s.services = s.services.map((v) => (v.id === w.serviceId ? { ...v, zone: to.az } : v));
    if (fromLoc && toLoc) renumber(s, ids, fromLoc, toLoc, () => announced);
  }
  freezeTick(s);
  return { ok: true };
}

// Why the web space cannot move to the panel host, or null.
export function webspaceBlock(s: GameState, w: Workload, c: Cluster, to: Cluster): string | null {
  if (to.id === c.id) return "error.sameHost";
  if (to.kind !== "panel" || !to.panel) return "error.noPanelHost";
  if (lostDisk(s, w)) return "error.lostDisk";
  if (w.busyUntil > s.hour || w.migrating) return "error.workloadBusy";
  if (!controlPlaneUp(s, c) || !controlPlaneUp(s, to)) return "error.controlPlaneDown";
  if (!pickNode(s, to, w)) return "error.nodeFull";
  if (!moveGbit(s, c.az, to.az)) return "error.noZoneLink";
  const [a, b] = [c.az, to.az].map((az) => s.locations.find((l) => l.az === az));
  return a && b && w.serviceId ? renumberError(s, [w.serviceId], a, b) : null;
}

// The panel hosts a web space can move to, each with the hours the hand task takes.
export interface WebspaceTarget { clusterId: string; name: string; panel: string; hours: number }
export function webspaceTargets(s: GameState, id: string): WebspaceTarget[] {
  const found = clusterWorkload(s, id);
  if (!found || found.c.kind !== "panel") return [];
  const { w, c } = found;
  return s.clusters.filter((to) => !webspaceBlock(s, w, c, to))
    .map((to) => ({ clusterId: to.id, name: to.name, panel: softwareById(to.panel!).name, hours: migrationHours(s, w, to) }));
}

// Starts moving a web space to another panel host: a hand task of migrationHours during which the site stays up, followed
// by a ten minute cutover (migrationTick). It costs no money.
export function migrateWebspace(s: GameState, workloadId: string, toClusterId: string, announced = false): ActionResult {
  const found = clusterWorkload(s, workloadId), to = s.clusters.find((x) => x.id === toClusterId);
  if (!found) return fail("error.unknownWorkload");
  if (!to) return fail("error.unknownCluster");
  const { w, c } = found;
  if (c.kind !== "panel" || !w.serviceId) return fail("error.notWebspace");
  const bad = webspaceBlock(s, w, c, to);
  if (bad) return fail(bad);
  patch(s, w.id, { migrating: { clusterId: to.id, doneAt: s.hour + migrationHours(s, w, to), ...(announced && { announced: true as const }) } });
  return { ok: true };
}

const openItem = (s: GameState, workloadId: string): LossItem | undefined =>
  s.lossReports.flatMap((r) => r.items).filter((i) => i.workloadId === workloadId && !i.restored).at(-1);

// Brings a lost workload back on a working node: from its last backup, which takes the volume's size ÷ the link speed,
// or on an empty disk without one. A web space in a panel VM comes back with the VM, and so do the others in it.
export function restoreWorkload(s: GameState, id: string): ActionResult {
  const lost = s.workloads.find((x) => x.id === id), vm = lost && vmOf(s, lost);
  const found = clusterWorkload(s, vm?.id ?? id);
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
  patch(s, w.id, { deviceId: node, placedAt: s.hour, busyUntil: s.hour + hours, stopped: false, stuck: undefined, corrupted: undefined, recoverDoneAt: undefined, recoverFailed: undefined });
  const host = isOwnVm(w) ? hostOfVm(s, w.id) : undefined;
  const back = [w.id, ...(host ? s.workloads.filter((x) => x.clusterId === host.id).map((x) => x.id) : [])];
  for (const item of back.map((x) => openItem(s, x))) {
    if (!item) continue;
    s.lossReports = s.lossReports.map((r) => ({ ...r, items: r.items.map((i) => (i === item ? { ...i, restored: true } : i)) }));
    const cus = s.customers.find((x) => x.id === item.customerId);
    if (cus && w.backupAt !== null) {
      bump(cus, Math.max(LOSS_RESTORED_MAX, LOSS_RESTORED - Math.max(0, lostAt - w.backupAt)));
      lossReview(s, cus);
    }
  }
  return { ok: true };
}

// Starts repairing a workload a pulled plug corrupted: 30 minutes of work at the server, after which most come back fine and
// the rest need a restore from backup. A workload whose recovery failed is restored instead.
export function recover(s: GameState, id: string): ActionResult {
  const w = s.workloads.find((x) => x.id === id), d = w?.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  if (!w || !d) return fail("error.unknownWorkload");
  if (!w.corrupted) return fail("error.notCorrupted");
  if (w.recoverDoneAt !== undefined) return fail("error.recovering");
  if (w.recoverFailed) return fail("error.needsRestore");
  if (!working(s, d.id)) return fail("error.unresponsive");
  patch(s, id, { recoverDoneAt: s.hour + RECOVER_HOURS });
  return { ok: true };
}

// Hand work to move the drives into the other server.
export const RESCUE_HOURS = 1;

// Where a workload stuck on a server that is off or failed, with its cluster's control plane down, can be recovered by hand:
// active, working nodes of another cluster in the same location that sell its product and have room.
export function rescueTargets(s: GameState, id: string): MigrationTarget[] {
  const found = clusterWorkload(s, id);
  if (!found) return [];
  const { w, c } = found, from = s.devices.find((d) => d.id === w.deviceId);
  if (!from || working(s, from.id) || controlPlaneUp(s, c) || lostDisk(s, w) || c.kind === "panel" || w.busyUntil > s.hour || w.migrating) return [];
  const product = s.services.find((v) => v.id === w.serviceId)?.product, here = locationOf(s, from)?.id;
  const takes = (to: Cluster) => (product ? supports(to, product) : to.kind === "cloud" && !!to.platform);
  return s.clusters.filter((to) => to.id !== c.id && !to.vm && controlPlaneUp(s, to) && takes(to)).flatMap((to) => to.nodes.flatMap((n): MigrationTarget[] => {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active" || !working(s, d.id) || !nodeTakes(s, d, w) || locationOf(s, d)?.id !== here) return [];
    const down = migrationDowntime(s, w, moveGbit(s, c.az, to.az), c.az !== to.az, d.id);
    return [{ to: d.id, name: d.label ?? d.name, clusterId: to.id, free: left(bookable(s, d), nodeUsed(s, d.id)), down }];
  }));
}

// Recovers a workload off a server that is off or failed onto a node of another cluster in the same location, as hand work:
// offline for the wait, the hand work and the copy.
export function rescueWorkload(s: GameState, id: string, toId: string, how: How | boolean = false): ActionResult {
  const w = s.workloads.find((x) => x.id === id), from = w && s.devices.find((d) => d.id === w.deviceId);
  if (!w || !from) return fail("error.unknownWorkload");
  if (working(s, from.id)) return fail("error.powerOffFirst");
  const c = s.clusters.find((x) => x.id === w.clusterId), to = clusterOf(s, toId), d = s.devices.find((x) => x.id === toId);
  if (!c || !to || !d || to.vm || to.id === c.id) return fail("error.notNode");
  if (locationOf(s, d)?.id !== locationOf(s, from)?.id) return fail("error.otherLocation");
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  if (!controlPlaneUp(s, to)) return fail("error.controlPlaneDown");
  const product = s.services.find((v) => v.id === w.serviceId)?.product;
  if (product ? !supports(to, product) : to.kind !== "cloud") return fail(product ? noRoomError(s, product, to.id) : "error.needsPlatform");
  if (to.nodes.find((n) => n.deviceId === toId)?.state !== "active" || !working(s, toId)) return fail("error.nodeDown");
  if (!nodeTakes(s, d, w)) return fail("error.nodeFull");
  const job = handJob(s, from.label ?? from.name, locationOf(s, from), how, RESCUE_HOURS, 1);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  const down = migrationDowntime(s, w, moveGbit(s, c.az, to.az), c.az !== to.az, toId);
  patch(s, id, { deviceId: toId, clusterId: to.id, placedAt: s.hour, busyUntil: s.hour + job.commit() + down, stuck: undefined, stopped: false });
  if (c.az !== to.az) s.services = s.services.map((v) => (v.id === w.serviceId ? { ...v, zone: to.az } : v));
  freezeTick(s);
  return { ok: true };
}
