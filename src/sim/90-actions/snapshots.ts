// economy.md, Snapshots: up to three per VM on a hypervisor with datastores, each delta booking disk on the VM's storage.
import { nowHours } from "../00-core/time";
import { SNAPSHOT_GROWTH, SNAPSHOTS_MAX, softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { controlPlaneUp, hostsOfVm, isOwnVm, lostDisk, type Workload } from "../60-infra/cluster";
import type { ActionResult } from "./hardware";
import { settleLoss } from "./vms";

const fail = (error: string): ActionResult => ({ ok: false, error });
// A reverted VM is down as long as a resize restart.
const RESTART_HOURS = 10 / 60;

const snapshotting = (s: GameState, w: Workload): boolean => {
  const c = s.clusters.find((x) => x.id === w.clusterId);
  return !!w.deviceId && c?.kind === "cloud" && !!c.platform && !!softwareById(c.platform).datastores;
};
// Its storage lost the data since it was placed; a pulled plug's corruption alone leaves the snapshots.
const diskGone = (s: GameState, w: Workload): boolean => lostDisk(s, { ...w, corrupted: undefined });
const patch = (s: GameState, id: string, p: Partial<Workload>) => {
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w));
};

function vmFor(s: GameState, workloadId: string): Workload | string {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!w || !c) return "error.unknownWorkload";
  if (!snapshotting(s, w)) return "error.noSnapshots";
  return controlPlaneUp(s, c) ? w : "error.controlPlaneDown";
}

// Freezes the VM's disk and, for an own VM, its finished OS and software installs.
export function takeSnapshot(s: GameState, workloadId: string): ActionResult & { id?: string } {
  const w = vmFor(s, workloadId);
  if (typeof w === "string") return fail(w);
  if (lostDisk(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  if ((w.snapshots?.length ?? 0) >= SNAPSHOTS_MAX) return fail("error.snapshotsFull");
  const now = nowHours(s), id = `snap${s.nextId++}`;
  const machine = isOwnVm(w) ? {
    os: w.os && w.os.installedAt <= now ? w.os : null,
    software: (w.software ?? []).filter((x) => x.doneAt === null || x.doneAt <= now),
  } : undefined;
  patch(s, w.id, { snapshots: [...(w.snapshots ?? []), { id, at: s.hour, deltaGb: 0, ...(machine && { machine }) }] });
  return { ok: true, id };
}

// Returns the VM to the snapshot: newer snapshots go, this one starts an empty delta, and the VM restarts. A snapshot older
// than a pulled plug's corruption brings the data back.
export function revertSnapshot(s: GameState, workloadId: string, snapshotId: string): ActionResult {
  const w = vmFor(s, workloadId);
  if (typeof w === "string") return fail(w);
  const at = w.snapshots?.findIndex((x) => x.id === snapshotId) ?? -1, snap = w.snapshots?.[at];
  if (!snap) return fail("error.unknownSnapshot");
  if (diskGone(s, w)) return fail("error.lostDisk");
  if (w.busyUntil > s.hour || w.migrating) return fail("error.workloadBusy");
  // A panel or other software the VM hosts a cluster with has to come back with it.
  if (snap.machine && hostsOfVm(s, w.id).some((c) => !snap.machine!.software.some((x) => x.id === (c.panel ?? c.platform)))) return fail("error.softwareInUse");
  const heals = !!w.corrupted && snap.at < (w.corruptedAt ?? Infinity);
  patch(s, w.id, {
    snapshots: [...w.snapshots!.slice(0, at), { ...snap, deltaGb: 0 }],
    busyUntil: w.stopped ? w.busyUntil : s.hour + RESTART_HOURS,
    ...(snap.machine && { os: snap.machine.os, software: snap.machine.software }),
    ...(heals && { corrupted: undefined, noticed: undefined, recoverDoneAt: undefined, recoverFailed: undefined, corruptedAt: undefined }),
  });
  if (heals) settleLoss(s, w, w.corruptedAt ?? s.hour, snap.at);
  return { ok: true };
}

// Drops the snapshot and frees its delta.
export function deleteSnapshot(s: GameState, workloadId: string, snapshotId: string): ActionResult {
  const w = vmFor(s, workloadId);
  if (typeof w === "string") return fail(w);
  if (!w.snapshots?.some((x) => x.id === snapshotId)) return fail("error.unknownSnapshot");
  const rest = w.snapshots.filter((x) => x.id !== snapshotId);
  patch(s, w.id, { snapshots: rest.length ? rest : undefined });
  return { ok: true };
}

// Hourly: each delta grows by its daily share of the VM's disk up to the whole disk, also past the storage's room, which
// only placement checks. A VM whose disk is gone, or that left a hypervisor with snapshots, loses them.
export function snapshotTick(s: GameState): void {
  if (!s.workloads.some((w) => w.snapshots)) return;
  s.workloads = s.workloads.map((w) => {
    if (!w.snapshots) return w;
    if (!snapshotting(s, w) || diskGone(s, w)) return { ...w, snapshots: undefined };
    const step = (w.diskGb * SNAPSHOT_GROWTH) / 24;
    return { ...w, snapshots: w.snapshots.map((x) => ({ ...x, deltaGb: Math.min(w.diskGb, x.deltaGb + step) })) };
  });
}
