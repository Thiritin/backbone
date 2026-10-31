// Backup jobs and restore points (economy.md, "Backup jobs and restore points").
import { chance, hashRng } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import { BACKUP_CHANGED, BACKUP_HOUR, idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { backsUpCluster, controlPlaneUp, lostDisk, vmRoom, type Cluster, type Workload } from "./cluster";
import { nodeUsage, diskFill } from "./usage";
import { raidUsable } from "./status";
import { LAN_GB_PER_HOUR, WAN_GB_PER_HOUR } from "../85-products/products";

export interface Keep { last: number; weekly: number }
export interface BackupJob {
  id: string; name: string; targetId: string; every: "daily" | "weekly"; hour: number;
  // null covers every workload of the cluster.
  workloadIds: string[] | null; keep: Keep; offsiteId: string | null; notify: boolean;
  lastRun: number | null; lastOk: boolean | null; lastReason?: "full" | "unreachable";
  // The hour the last failure alert went out.
  lastAlert?: number;
}
// bad is decided when the point is written and shows once a restore test verified it; an offsite copy is its own point,
// readyAt the hour its transfer is done; testDoneAt the hour a running restore test ends.
export interface RestorePoint { at: number; gb: number; jobId: string; verified: boolean; bad: boolean; offsite: boolean; readyAt?: number; testDoneAt?: number }
export const BAD_POINT = 0.01, BAD_OFFSITE = 0.03;

export const KEEP_DEFAULT: Keep = { last: 3, weekly: 0 };
export const KEEP_MAX: Keep = { last: 14, weekly: 8 };
export const MAX_JOBS = 4;

export const pointsOf = (w: Workload): RestorePoint[] => w.points ?? [];
export const jobById = (s: GameState, id: string): BackupJob | undefined => s.clusters.flatMap((c) => c.jobs).find((j) => j.id === id);

// A point a restore test showed to be bad is no backup.
const usable = (p: RestorePoint): boolean => !(p.verified && p.bad);
const newest = (a: RestorePoint[]) => a.reduce<RestorePoint | null>((n, p) => (!n || p.at > n.at ? p : n), null);

// The newest usable point stamps the workload's last backup.
export const syncBackupAt = (w: Workload): Workload => ({ ...w, backupAt: newest(pointsOf(w).filter(usable))?.at ?? null });

const repoOf = (s: GameState, c: Cluster, p: RestorePoint): Cluster | undefined => {
  const j = c.jobs.find((x) => x.id === p.jobId);
  return s.clusters.find((x) => x.id === (p.offsite ? j?.offsiteId : j?.targetId));
};

// Whether a copy survives: some good point sits in a repository cluster that still has a server or panel VM.
export function holdsCopy(s: GameState, w: Workload): boolean {
  const c = s.clusters.find((x) => x.id === w.clusterId), pts = pointsOf(w).filter(usable);
  if (!c || !pts.length) return true;
  return pts.some((p) => { const r = repoOf(s, c, p); return !r || r.nodes.length > 0 || !!r.vm; });
}

// The point a restore reads: the newest one in a reachable repository that no test showed to be bad, a primary copy before an offsite one.
export function usablePoint(s: GameState, c: Cluster, w: Workload): RestorePoint | null {
  const ok = pointsOf(w).filter((p) => usable(p) && (p.readyAt ?? 0) <= s.hour), up = (p: RestorePoint) => { const r = repoOf(s, c, p); return !!r && controlPlaneUp(s, r); };
  return newest(ok.filter((p) => !p.offsite && up(p))) ?? newest(ok.filter((p) => p.offsite && up(p))) ?? newest(ok.filter((p) => !p.offsite));
}

// The cluster that holds the point a restore reads, or else the first job's target.
export function backupTarget(s: GameState, c: Cluster, w: Workload): Cluster | undefined {
  const p = usablePoint(s, c, w);
  return (p && repoOf(s, c, p)) ?? s.clusters.find((x) => x.id === c.jobs[0]?.targetId);
}

// Hours a workload's copy takes over the link between its cluster and a repository.
export function linkHours(c: Cluster, target: Cluster | undefined, gb: number): number {
  return Math.max(1, Math.ceil(gb / (target && target.az === c.az ? LAN_GB_PER_HOUR : WAN_GB_PER_HOUR)));
}

// Disk the repository of a cluster holds: every point whose job writes there.
export function repoUsed(s: GameState, targetId: string): number {
  const jobs = new Map(s.clusters.flatMap((c) => c.jobs).map((j) => [j.id, j]));
  return s.workloads.reduce((n, w) => n + pointsOf(w).reduce((m, p) => m + ((p.offsite ? jobs.get(p.jobId)?.offsiteId : jobs.get(p.jobId)?.targetId) === targetId ? p.gb : 0), 0), 0);
}

export function repoRoom(s: GameState, target: Cluster): number {
  const vm = target.vm ? vmRoom(s, target) : null;
  return vm ? vm.cap.diskGb - vm.used.diskGb : target.nodes.reduce((n, x) => {
    const d = s.devices.find((y) => y.id === x.deviceId);
    return d ? n + raidUsable(d) - nodeUsage(s, d.id).used.diskGb : n;
  }, 0);
}

export const inJob = (j: BackupJob, w: Workload): boolean => !j.workloadIds || j.workloadIds.includes(w.id);

// Keeps the newest keep.last points and one per week for keep.weekly weeks, for the primary copies and the offsite ones apart;
// the oldest kept point of each becomes the full copy.
export function pruneJob(s: GameState, w: Workload, j: BackupJob): Workload {
  let points = pointsOf(w);
  for (const off of [false, true]) {
    const mine = points.filter((p) => p.jobId === j.id && p.offsite === off).sort((a, b) => b.at - a.at);
    const keep = new Set(mine.slice(0, j.keep.last)), weeks = new Set<number>();
    for (const p of mine.slice(j.keep.last)) {
      const wk = Math.floor(p.at / 168);
      if (weeks.size < j.keep.weekly && !weeks.has(wk)) { weeks.add(wk); keep.add(p); }
    }
    const oldest = mine.filter((p) => keep.has(p)).at(-1);
    points = points.filter((p) => p.jobId !== j.id || p.offsite !== off || keep.has(p))
      .map((p) => (p === oldest ? { ...p, gb: Math.max(p.gb, w.diskGb * diskFill(s, w, p.at)) } : p));
  }
  return syncBackupAt({ ...w, points });
}

type Why = "full" | "unreachable" | null;

// Records a run's result on the job; a failure raises one alert a day.
function settle(s: GameState, c: Cluster, job: BackupJob, why: Why, events: SimEvent[]): void {
  const j = s.clusters.find((x) => x.id === c.id)?.jobs.find((y) => y.id === job.id) ?? job;
  const alert = why !== null && j.notify && (j.lastAlert === undefined || s.hour - j.lastAlert >= 24);
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, jobs: x.jobs.map((y) => (y.id === j.id ? { ...y, lastRun: s.hour, lastOk: why === null, lastReason: why ?? undefined, ...(alert && { lastAlert: s.hour }) } : y)) } : x));
  if (alert) events.push({ app: "Locations", key: "event.backupFailed", params: { cluster: c.name, target: s.clusters.find((x) => x.id === j.targetId)?.name ?? "" } });
}

// One run of a job: a point per workload; stops at a full repository.
export function runJob(s: GameState, c: Cluster, j: BackupJob, events: SimEvent[], only?: string): void {
  const target = s.clusters.find((x) => x.id === j.targetId);
  let why: Why = null;
  if (!target || !backsUpCluster(s, c, target) || !controlPlaneUp(s, target)) why = "unreachable";
  else {
    let used = repoUsed(s, target.id);
    const room = repoRoom(s, target);
    s.workloads = s.workloads.map((w) => {
      if (why || w.clusterId !== c.id || (only && w.id !== only) || !inJob(j, w) || lostDisk(s, w) || w.busyUntil > s.hour) return w;
      const full = w.diskGb * diskFill(s, w, s.hour), first = !pointsOf(w).some((p) => p.jobId === j.id && !p.offsite);
      const gb = first ? full : full * BACKUP_CHANGED;
      if (used + gb > room) { why = "full"; return w; }
      used += gb;
      const bad = chance(hashRng(s.seed, idNum(w.id), s.hour), BAD_POINT);
      return pruneJob(s, { ...w, points: [...pointsOf(w), { at: s.hour, gb, jobId: j.id, verified: false, bad, offsite: false }] }, j);
    });
  }
  settle(s, c, j, why, events);
}

// Copies each workload's newest point to the job's offsite repository over the internet.
function copyOffsite(s: GameState, c: Cluster, j: BackupJob, events: SimEvent[]): void {
  const off = s.clusters.find((x) => x.id === j.offsiteId);
  let why: Why = null;
  if (!off || !backsUpCluster(s, c, off) || !controlPlaneUp(s, off)) why = "unreachable";
  else {
    let used = repoUsed(s, off.id);
    const room = repoRoom(s, off);
    s.workloads = s.workloads.map((w) => {
      if (why || w.clusterId !== c.id || !inJob(j, w)) return w;
      const mine = pointsOf(w).filter((p) => p.jobId === j.id), p = newest(mine.filter((x) => !x.offsite));
      if (!p || mine.some((x) => x.offsite && x.at === p.at)) return w;
      const gb = mine.some((x) => x.offsite) ? p.gb : Math.max(p.gb, w.diskGb * diskFill(s, w, p.at));
      if (used + gb > room) { why = "full"; return w; }
      used += gb;
      const bad = p.bad || chance(hashRng(s.seed, idNum(w.id), p.at, 1), BAD_OFFSITE);
      return pruneJob(s, { ...w, points: [...pointsOf(w), { ...p, gb, bad, verified: false, offsite: true, readyAt: s.hour + Math.ceil(gb / WAN_GB_PER_HOUR), testDoneAt: undefined }] }, j);
    });
  }
  if (why) settle(s, c, j, why, events);
}

// A finished restore test shows whether the point was good.
function finishTests(s: GameState): void {
  const done = (p: RestorePoint) => p.testDoneAt !== undefined && p.testDoneAt <= s.hour;
  if (!s.workloads.some((w) => w.points?.some(done))) return;
  s.workloads = s.workloads.map((w) => (w.points?.some(done) ? syncBackupAt({ ...w, points: w.points.map((p) => (done(p) ? { ...p, testDoneAt: undefined, verified: true } : p)) }) : w));
}

// Hourly: every job whose hour has come runs (weekly ones on Sundays), offsite copies go out three hours later on Sundays.
export function runBackups(s: GameState, events: SimEvent[]): void {
  finishTests(s);
  const d = dateOf(s.hour), e = dateOf(s.hour - 3);
  for (const c of s.clusters) {
    for (const j of c.jobs) {
      if (j.hour === d.getUTCHours() && (j.every === "daily" || d.getUTCDay() === 0)) runJob(s, c, j, events);
      if (j.offsiteId && j.hour === e.getUTCHours() && e.getUTCDay() === 0) copyOffsite(s, c, j, events);
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

// The hour a job runs next, counting the current hour once it has not run in it yet.
export function nextRun(j: BackupJob, from: number): number {
  for (let h = from; h < from + 24 * 8; h++) {
    const d = dateOf(h);
    if (d.getUTCHours() === j.hour && (j.every === "daily" || d.getUTCDay() === 0)) return h;
  }
  return from;
}
