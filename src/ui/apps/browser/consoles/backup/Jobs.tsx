import { useState } from "react";
import { dateOf, formatClock, hourOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { backupTargets, type Cluster, type Workload } from "../../../../../sim/60-infra/cluster";
import { KEEP_MAX, MAX_JOBS, nextRun, pointsOf, type BackupJob } from "../../../../../sim/60-infra/backups";
import { backupNow, deleteJob, pruneNow, removePoint, runJobNow, saveJob, type JobDraft } from "../../../../../sim/90-actions/backups";
import { restoreWorkload } from "../../../../../sim/90-actions/vms";
import { lostDisk } from "../../../../../sim/60-infra/cluster";
import { LOCALE } from "../../../../../i18n/lang";
import { t } from "../../../../../i18n/en";
import { disk } from "../../../hw";
import { useStore } from "../../../../store";
import "./backup.css";

export type Skin = "proxmocks" | "veeham" | "backula" | "pbs";
export const skinOf = (panel: string | null): Skin => (panel === "veeham" ? "veeham" : panel === "backula" ? "backula" : "pbs");

const result = (j: BackupJob) => j.lastOk === null ? t("bk.never") : j.lastOk ? t("bk.success") : j.lastReason === "unreachable" ? t("bk.failedUnreachable") : t("bk.failedFull");
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

// The form of one job; the retention label follows the console.
function JobEditor({ game, c, job, skin, done }: { game: GameState; c: Cluster; job?: BackupJob; skin: Skin; done: () => void }) {
  const act = useStore((s) => s.act), targets = backupTargets(game, c), vms = game.workloads.filter((w) => w.clusterId === c.id && !w.template);
  const [d, setD] = useState<JobDraft & { keep: { last: number; weekly: number } }>({
    id: job?.id, name: job?.name ?? t("bk.defaultName"), targetId: job?.targetId ?? targets[0]?.id, every: job?.every ?? "daily", hour: job?.hour ?? 2,
    workloadIds: job?.workloadIds ?? null, keep: job?.keep ?? { last: 3, weekly: 0 }, notify: job?.notify ?? true,
  });
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
  const some = d.workloadIds !== null && d.workloadIds !== undefined;
  const toggle = (id: string) => setD({ ...d, workloadIds: d.workloadIds!.includes(id) ? d.workloadIds!.filter((x) => x !== id) : [...d.workloadIds!, id] });
  return (
    <form className="bk-edit" onSubmit={(e) => { e.preventDefault(); if (act(saveJob, c.id, d).ok) done(); }}>
      <label className="cx-field">{t("bk.name")}<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
      <label className="cx-field">{t("bk.storage")}<select value={d.targetId} onChange={(e) => setD({ ...d, targetId: e.target.value })}>{targets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label className="cx-field">{t("bk.schedule")}<select value={d.every} onChange={(e) => setD({ ...d, every: e.target.value as "daily" | "weekly" })}><option value="daily">{t("bk.daily")}</option><option value="weekly">{t("bk.weekly")}</option></select></label>
      <label className="cx-field">{t("bk.hour")}<input type="number" min={0} max={23} value={d.hour} onChange={(e) => setD({ ...d, hour: num(e.target.value, 0, 23) })} /></label>
      <label className="cx-field">{t("bk.selection")}<select value={some ? "some" : "all"} onChange={(e) => setD({ ...d, workloadIds: e.target.value === "all" ? null : vms.map((w) => w.id) })}><option value="all">{t("bk.selAll")}</option><option value="some">{t("bk.selSome")}</option></select></label>
      {some && <div className="bk-pick">{vms.map((w) => <label key={w.id}><input type="checkbox" checked={d.workloadIds!.includes(w.id)} onChange={() => toggle(w.id)} />{w.hostname ?? w.id}</label>)}</div>}
      <label className="cx-field">{t(`bk.keep.${skin}`)}<input type="number" min={1} max={KEEP_MAX.last} value={d.keep.last} onChange={(e) => setD({ ...d, keep: { ...d.keep, last: num(e.target.value, 1, KEEP_MAX.last) } })} /></label>
      <label className="cx-field">{t("bk.keepWeekly")}<input type="number" min={0} max={KEEP_MAX.weekly} value={d.keep.weekly} onChange={(e) => setD({ ...d, keep: { ...d.keep, weekly: num(e.target.value, 0, KEEP_MAX.weekly) } })} /></label>
      <div className="cx-tools"><button className="cx-btn primary" type="submit" disabled={!d.targetId}>{t("bk.save")}</button><button className="cx-btn" type="button" onClick={done}>{t("bk.cancel")}</button></div>
    </form>
  );
}

// The jobs of one source cluster (Proxmocks Datacenter > Backup) or of every cluster that writes to a repository (backup consoles).
export function JobsPanel({ game, source, target, skin }: { game: GameState; source?: Cluster; target?: Cluster; skin: Skin }) {
  const act = useStore((s) => s.act), [edit, setEdit] = useState<{ c: Cluster; job?: BackupJob } | null>(null);
  const rows = game.clusters.filter((c) => (source ? c.id === source.id : true)).flatMap((c) => c.jobs.filter((j) => !target || j.targetId === target.id).map((j) => ({ c, j })));
  const can = source && backupTargets(game, source).length > 0 && source.jobs.length < MAX_JOBS;
  return (
    <>
      {source && <div className="cx-tools"><button className="cx-btn primary" disabled={!can} onClick={() => setEdit({ c: source })}>{t("bk.add")}</button></div>}
      {rows.length === 0 ? <p className="cx-empty">{t("browser-consoles-1.bkNoJobs")}</p> : (
        <table className="cx-table bk-jobs">
          <thead><tr><th>{t("bk.name")}</th>{!source && <th>{t("bk.source")}</th>}<th>{t("bk.storage")}</th><th>{t("bk.schedule")}</th><th>{t("bk.objects")}</th><th>{t("bk.retention")}</th><th>{t("bk.lastResult")}</th><th>{t("bk.nextRun")}</th><th /></tr></thead>
          <tbody>
            {rows.map(({ c, j }) => (
              <tr key={j.id}>
                <td><b>{j.name}</b></td>{!source && <td>{c.name}</td>}
                <td>{game.clusters.find((x) => x.id === j.targetId)?.name}</td>
                <td>{j.every === "daily" ? t("bk.dailyAt", { time: hh(j.hour) }) : t("bk.weeklyAt", { time: hh(j.hour) })}</td>
                <td className="num">{j.workloadIds ? j.workloadIds.length : t("bk.selAll")}</td>
                <td className="num">{t("bk.retentionValue", { last: j.keep.last, weekly: j.keep.weekly })}</td>
                <td><span className={`cx-state ${j.lastOk === false ? "bad" : j.lastOk ? "ok" : ""}`}>{result(j)}</span></td>
                <td className="num">{formatClock(nextRun(j, game.hour))}</td>
                <td className="cx-tools">
                  <button className="cx-btn" onClick={() => setEdit({ c, job: j })}>{t("bk.edit")}</button>
                  <button className="cx-btn" onClick={() => act(runJobNow, c.id, j.id)}>{t("bk.runNow")}</button>
                  {skin === "pbs" && <button className="cx-btn" onClick={() => act(pruneNow, c.id, j.id)}>{t("bk.prune")}</button>}
                  <button className="cx-btn danger" onClick={() => act(deleteJob, c.id, j.id)}>{t("bk.remove")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && <JobEditor key={edit.job?.id ?? "new"} game={game} c={edit.c} job={edit.job} skin={skin} done={() => setEdit(null)} />}
    </>
  );
}

// The restore points of one workload, newest first, with Restore for a lost one, Remove and Backup now.
export function PointsPanel({ game, c, w }: { game: GameState; c: Cluster; w: Workload }) {
  const act = useStore((s) => s.act), pts = [...pointsOf(w)].sort((a, b) => b.at - a.at), covered = c.jobs.some((j) => !j.workloadIds || j.workloadIds.includes(w.id));
  return (
    <>
      <div className="cx-tools">
        <button className="cx-btn primary" disabled={!covered} onClick={() => act(backupNow, w.id)}>{t("bk.backupNow")}</button>
        <button className="cx-btn" disabled={!lostDisk(game, w) || !pts.length} onClick={() => act(restoreWorkload, w.id)}>{t("bk.restore")}</button>
      </div>
      {pts.length === 0 ? <p className="cx-empty">{t("bk.noPoints")}</p> : (
        <table className="cx-table">
          <thead><tr><th>{t("bk.date")}</th><th>{t("bk.job")}</th><th>{t("bk.size")}</th><th /></tr></thead>
          <tbody>
            {pts.map((p) => (
              <tr key={`${p.jobId}-${p.at}`}>
                <td className="num">{formatClock(p.at)}</td><td>{c.jobs.find((j) => j.id === p.jobId)?.name}</td><td className="num">{disk(Math.round(p.gb * 10) / 10)}</td>
                <td><button className="cx-btn" onClick={() => act(removePoint, w.id, p.at, p.jobId)}>{t("bk.remove")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

// A month of days, filled where a restore point of the repository exists, with that day's points beside it.
export function Calendar({ game, target }: { game: GameState; target: Cluster }) {
  const jobs = new Map(game.clusters.flatMap((c) => c.jobs).map((j) => [j.id, j]));
  const pts = game.workloads.flatMap((w) => pointsOf(w).filter((p) => jobs.get(p.jobId)?.targetId === target.id).map((p) => ({ w, p })));
  const [pick, setPick] = useState<number | null>(null);
  const now = dateOf(game.hour), y = now.getUTCFullYear(), m = now.getUTCMonth();
  const first = hourOf(new Date(Date.UTC(y, m, 1))), count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), lead = (dateOf(first).getUTCDay() + 6) % 7;
  const byDay = (h: number) => pts.filter((x) => x.p.at >= h && x.p.at < h + 24);
  return (
    <div className="bk-cal">
      <p className="bk-month">{dateOf(first).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" })}</p>
      <table className="bk-grid"><tbody>
        {Array.from({ length: Math.ceil((count + lead) / 7) }, (_, r) => (
          <tr key={r}>{Array.from({ length: 7 }, (_, k) => {
            const n = r * 7 + k - lead, h = first + n * 24;
            return <td key={k}>{n >= 0 && n < count && <button className="bk-day" data-has={byDay(h).length > 0} aria-pressed={pick === h} onClick={() => setPick(h)}>{n + 1}</button>}</td>;
          })}</tr>
        ))}
      </tbody></table>
      {pick !== null && (
        <ul className="bk-side">
          {byDay(pick).length === 0 && <li className="cx-empty">{t("bk.noPoints")}</li>}
          {byDay(pick).map(({ w, p }) => <li key={`${w.id}-${p.jobId}-${p.at}`}>{formatClock(p.at)} {w.hostname ?? w.id} {disk(Math.round(p.gb * 10) / 10)}</li>)}
        </ul>
      )}
    </div>
  );
}
