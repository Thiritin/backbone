// economy.md, "Backup jobs and restore points": scheduled copies of a cluster's workloads to a backup cluster.
import { jobById, linkHours, KEEP_MAX, MAX_JOBS, newJob, pruneJob, runJob, syncBackupAt, type BackupJob } from "../60-infra/backups";
import { diskFill } from "../60-infra/usage";
import { backsUpCluster, controlPlaneUp } from "../60-infra/cluster";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { quorumBlock } from "../60-infra/quorum";

const fail = (error: string): ActionResult => ({ ok: false, error });
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export type JobDraft = Partial<Omit<BackupJob, "keep">> & { keep?: Partial<BackupJob["keep"]> };

// Adds a job (no id) or edits one; a new target starts a new chain of points.
export function saveJob(s: GameState, clusterId: string, draft: JobDraft): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (quorumBlock(s, c)) return fail("error.noQuorum");
  const old = draft.id ? c.jobs.find((j) => j.id === draft.id) : undefined;
  if (draft.id && !old) return fail("error.unknownJob");
  if (!old && c.jobs.length >= MAX_JOBS) return fail("error.jobLimit");
  const base = old ?? newJob(`job${s.nextId}`, draft.targetId ?? "");
  const targetId = draft.targetId ?? base.targetId, t = s.clusters.find((x) => x.id === targetId);
  if (!t || t.id === c.id || t.kind !== "backup") return fail("error.backupTarget");
  if (!backsUpCluster(s, c, t)) return fail("error.backupIncompatible");
  const offsiteId = draft.offsiteId === undefined ? base.offsiteId : draft.offsiteId, o = s.clusters.find((x) => x.id === offsiteId);
  if (offsiteId !== null && (!o || o.id === c.id || o.id === t.id || o.kind !== "backup" || !backsUpCluster(s, c, o))) return fail("error.backupTarget");
  if (o && o.az === t.az) return fail("error.offsiteZone");
  if (draft.every && draft.every !== "daily" && draft.every !== "weekly") return fail("error.backupTarget");
  const job: BackupJob = {
    ...base, ...draft, id: base.id, targetId, every: draft.every ?? base.every, offsiteId, notify: draft.notify ?? base.notify,
    name: (draft.name ?? base.name).trim().slice(0, 40) || base.name,
    hour: clamp(draft.hour ?? base.hour, 0, 23),
    keep: { last: clamp(draft.keep?.last ?? base.keep.last, 1, KEEP_MAX.last), weekly: clamp(draft.keep?.weekly ?? base.keep.weekly, 0, KEEP_MAX.weekly) },
  };
  if (!old) s.nextId++;
  if (old && old.targetId !== targetId) dropPoints(s, new Set([old.id]));
  else if (old && old.offsiteId !== offsiteId) dropPoints(s, new Set([old.id]), true);
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, jobs: old ? x.jobs.map((j) => (j === old ? job : j)) : [...x.jobs, job] } : x));
  if (old) for (const w of s.workloads.filter((w) => w.clusterId === c.id)) s.workloads = s.workloads.map((x) => (x.id === w.id ? pruneJob(s, x, job) : x));
  return { ok: true };
}

const dropPoints = (s: GameState, ids: Set<string>, offsiteOnly = false) => {
  const hit = (p: { jobId: string; offsite: boolean }) => ids.has(p.jobId) && (!offsiteOnly || p.offsite);
  s.workloads = s.workloads.map((w) => (w.points?.some(hit) ? syncBackupAt({ ...w, points: w.points.filter((p) => !hit(p)) }) : w));
};

// Removes a job together with the restore points it wrote.
export function deleteJob(s: GameState, clusterId: string, jobId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (!c.jobs.some((j) => j.id === jobId)) return fail("error.unknownJob");
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, jobs: x.jobs.filter((j) => j.id !== jobId) } : x));
  dropPoints(s, new Set([jobId]));
  return { ok: true };
}

// Runs a job now instead of at its hour.
export function runJobNow(s: GameState, clusterId: string, jobId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), j = c?.jobs.find((x) => x.id === jobId);
  if (!c || !j) return fail("error.unknownJob");
  runJob(s, c, j, []);
  return { ok: true };
}

// Applies a job's retention at once.
export function pruneNow(s: GameState, clusterId: string, jobId: string): ActionResult {
  const j = s.clusters.find((x) => x.id === clusterId)?.jobs.find((x) => x.id === jobId);
  if (!j) return fail("error.unknownJob");
  s.workloads = s.workloads.map((w) => pruneJob(s, w, j));
  return { ok: true };
}

// Runs the first job that covers a workload for that workload alone.
export function backupNow(s: GameState, workloadId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = s.clusters.find((x) => x.id === w?.clusterId);
  const j = c?.jobs.find((x) => !x.workloadIds || x.workloadIds.includes(workloadId));
  if (!c || !j) return fail("error.unknownJob");
  runJob(s, c, j, [], workloadId);
  return { ok: true };
}

// Deletes one restore point.
export function removePoint(s: GameState, workloadId: string, at: number, jobId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId);
  const p = w?.points?.find((x) => x.at === at && x.jobId === jobId);
  if (!w || !p) return fail("error.unknownPoint");
  const j = jobById(s, jobId), left = syncBackupAt({ ...w, points: w.points!.filter((y) => y !== p) });
  s.workloads = s.workloads.map((x) => (x.id === w.id ? (j ? pruneJob(s, left, j) : left) : x));
  return { ok: true };
}

// Reads a restore point back from its repository, which takes as long as a restore and leaves the workload running; afterwards the point shows as good or bad.
export function testRestore(s: GameState, workloadId: string, pointAt: number, offsite = false): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = s.clusters.find((x) => x.id === w?.clusterId);
  const p = w?.points?.find((x) => x.at === pointAt && x.offsite === offsite);
  if (!w || !c || !p) return fail("error.unknownPoint");
  if (p.verified || p.testDoneAt !== undefined || (p.readyAt ?? 0) > s.hour) return fail("error.testBusy");
  const j = c.jobs.find((x) => x.id === p.jobId), repo = s.clusters.find((x) => x.id === (offsite ? j?.offsiteId : j?.targetId));
  if (!repo || !controlPlaneUp(s, repo)) return fail("error.backupUnavailable");
  const done = s.hour + linkHours(c, repo, w.diskGb * diskFill(s, w, p.at));
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, points: x.points!.map((y) => (y === p ? { ...y, testDoneAt: done } : y)) } : x));
  return { ok: true };
}
