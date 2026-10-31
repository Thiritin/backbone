// Backup jobs and restore points (economy.md, "Backup jobs and restore points").
import { dateOf } from "../00-core/time";
import { BACKUP_CHANGED, BACKUP_HOUR } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { backsUpCluster, controlPlaneUp, lostDisk, vmRoom, type Cluster, type Workload } from "./cluster";
import { nodeUsage, diskFill } from "./usage";
import { raidUsable } from "./status";

export interface Keep { last: number; weekly: number }
export interface BackupJob {
  id: string; name: string; targetId: string; every: "daily" | "weekly"; hour: number;
  // null covers every workload of the cluster.
  workloadIds: string[] | null; keep: Keep; offsiteId: string | null; notify: boolean;
  lastRun: number | null; lastOk: boolean | null; lastReason?: "full" | "unreachable";
}
export interface RestorePoint { at: number; gb: number; jobId: string; verified: boolean; bad: boolean; offsite: boolean }

export const KEEP_DEFAULT: Keep = { last: 3, weekly: 0 };
export const KEEP_MAX: Keep = { last: 14, weekly: 8 };
export const MAX_JOBS = 4;

export const pointsOf = (w: Workload): RestorePoint[] => w.points ?? [];
export const jobById = (s: GameState, id: string): BackupJob | undefined => s.clusters.flatMap((c) => c.jobs).find((j) => j.id === id);

// The newest point stamps the workload's last backup.
export const syncBackupAt = (w: Workload): Workload => ({ ...w, backupAt: pointsOf(w).reduce<number | null>((n, p) => (n === null || p.at > n ? p.at : n), null) });

// The cluster that holds a workload's newest copy, or else its first job's target.
export function backupTarget(s: GameState, c: Cluster, w: Workload): Cluster | undefined {
  const last = pointsOf(w).reduce<RestorePoint | null>((n, p) => (!n || p.at > n.at ? p : n), null);
  const id = (last && c.jobs.find((j) => j.id === last.jobId)?.targetId) ?? c.jobs[0]?.targetId;
  return s.clusters.find((x) => x.id === id);
}

// Disk the repository of a cluster holds: every point whose job writes there.
export function repoUsed(s: GameState, targetId: string): number {
  const jobs = new Map(s.clusters.flatMap((c) => c.jobs).map((j) => [j.id, j]));
  return s.workloads.reduce((n, w) => n + pointsOf(w).reduce((m, p) => m + (jobs.get(p.jobId)?.targetId === targetId ? p.gb : 0), 0), 0);
}

export function repoRoom(s: GameState, target: Cluster): number {
  const vm = target.vm ? vmRoom(s, target) : null;
  return vm ? vm.cap.diskGb - vm.used.diskGb : target.nodes.reduce((n, x) => {
    const d = s.devices.find((y) => y.id === x.deviceId);
    return d ? n + raidUsable(d) - nodeUsage(s, d.id).used.diskGb : n;
  }, 0);
}

export const inJob = (j: BackupJob, w: Workload): boolean => !j.workloadIds || j.workloadIds.includes(w.id);

// Keeps the newest keep.last points and one per week for keep.weekly weeks; the oldest kept point becomes the full copy.
export function pruneJob(s: GameState, w: Workload, j: BackupJob): Workload {
  const mine = pointsOf(w).filter((p) => p.jobId === j.id).sort((a, b) => b.at - a.at);
  const keep = new Set(mine.slice(0, j.keep.last));
  const weeks = new Set<number>();
  for (const p of mine.slice(j.keep.last)) {
    const wk = Math.floor(p.at / 168);
    if (weeks.size < j.keep.weekly && !weeks.has(wk)) { weeks.add(wk); keep.add(p); }
  }
  const kept = mine.filter((p) => keep.has(p));
  const oldest = kept.at(-1);
  const points = pointsOf(w).filter((p) => p.jobId !== j.id || keep.has(p))
    .map((p) => (p === oldest ? { ...p, gb: Math.max(p.gb, w.diskGb * diskFill(s, w, p.at)) } : p));
  return syncBackupAt({ ...w, points });
}

// One run of a job: a point per workload; stops at a full repository.
export function runJob(s: GameState, c: Cluster, j: BackupJob, events: SimEvent[]): void {
  const target = s.clusters.find((x) => x.id === j.targetId);
  let reason: "full" | "unreachable" | null = null;
  if (!target || !backsUpCluster(s, c, target) || !controlPlaneUp(s, target)) reason = "unreachable";
  else {
    let used = repoUsed(s, target.id);
    const room = repoRoom(s, target);
    s.workloads = s.workloads.map((w) => {
      if (reason || w.clusterId !== c.id || !inJob(j, w) || lostDisk(s, w) || w.busyUntil > s.hour) return w;
      const full = w.diskGb * diskFill(s, w, s.hour), first = !pointsOf(w).some((p) => p.jobId === j.id);
      const gb = first ? full : full * BACKUP_CHANGED;
      if (used + gb > room) { reason = "full"; return w; }
      used += gb;
      return pruneJob(s, { ...w, points: [...pointsOf(w), { at: s.hour, gb, jobId: j.id, verified: false, bad: false, offsite: false }] }, j);
    });
  }
  const ok = reason === null;
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, jobs: x.jobs.map((y) => (y.id === j.id ? { ...y, lastRun: s.hour, lastOk: ok, lastReason: reason ?? undefined } : y)) } : x));
  if (!ok) events.push({ app: "Locations", key: "event.backupFailed", params: { cluster: c.name, target: target?.name ?? "" } });
}

// Hourly: every job whose hour has come runs (weekly ones on Sundays).
export function runBackups(s: GameState, events: SimEvent[]): void {
  const d = dateOf(s.hour);
  for (const c of s.clusters) {
    for (const j of c.jobs) {
      if (j.hour !== d.getUTCHours() || (j.every === "weekly" && d.getUTCDay() !== 0)) continue;
      runJob(s, c, j, events);
    }
  }
}

export const newJob = (id: string, targetId: string, every: "daily" | "weekly" = "daily"): BackupJob => ({
  id, name: "Backup", targetId, every, hour: BACKUP_HOUR, workloadIds: null, keep: { ...KEEP_DEFAULT }, offsiteId: null, notify: true, lastRun: null, lastOk: null,
});

// Saves from before jobs: the single schedule becomes one job, and a workload with a backup gets one point.
export function fillBackups(s: GameState): GameState {
  const known = new Set(s.clusters.map((c) => c.id));
  let n = 0;
  s.clusters = s.clusters.map((c) => {
    const old = (c as unknown as { backup?: { targetId: string | null; every: string } }).backup;
    const { backup: _drop, ...rest } = c as Cluster & { backup?: unknown };
    const jobs = ((!c.jobs.length && old?.targetId && old.every !== "off") ? [newJob(`job-old-${n++}`, old.targetId, old.every as "daily" | "weekly")] : c.jobs).filter((j) => known.has(j.targetId));
    return { ...rest, jobs } as Cluster;
  });
  const first = new Map(s.clusters.filter((c) => c.jobs.length).map((c) => [c.id, c.jobs[0].id]));
  s.workloads = s.workloads.map((w) => {
    const jobId = w.clusterId && first.get(w.clusterId);
    if (w.points || w.backupAt === null || !jobId) return w;
    return { ...w, points: [{ at: w.backupAt, gb: w.diskGb * diskFill(s, w, w.backupAt), jobId, verified: false, bad: false, offsite: false }] };
  });
  return s;
}
