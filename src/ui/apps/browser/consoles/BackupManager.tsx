import { useState } from "react";
import { t } from "../../../../i18n/en";
import { formatClock } from "../../../../sim/00-core/time";
import { APP_NAME } from "../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../sim/50-state";
import { KEEP_MAX, pointsOf, type RestorePoint } from "../../../../sim/60-infra/backups";
import { backupTargets, controlPlaneUp, type Cluster, type Workload } from "../../../../sim/60-infra/cluster";
import { backupNow, restoreSite, runJobNow, saveJob } from "../../../../sim/90-actions/backups";
import { setBackup } from "../../../../sim/90-actions/clusters";
import { disk } from "../../hw";
import { usePageAct } from "../pageAct";

type View = "list" | "schedule" | "storage" | number;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const size = (gb: number) => disk(Math.round(gb * 10) / 10);

// One copy per site and hour; the primary copy stands for its offsite twin.
function pointAt(w: Workload, at: number): RestorePoint | undefined {
  return pointsOf(w).filter((p) => p.at === at).sort((a, b) => Number(a.offsite) - Number(b.offsite))[0];
}

function statusOf(pts: RestorePoint[]): { label: string; tone: string } {
  if (pts.some((p) => p.verified && p.bad)) return { label: t("panel-backup.bad"), tone: "bad" };
  return pts.every((p) => p.verified) ? { label: t("panel-backup.verified"), tone: "ok" } : { label: t("panel-backup.ok"), tone: "ok" };
}

function storageState(game: GameState, x: Cluster): { label: string; tone: string } {
  if (controlPlaneUp(game, x)) return { label: t("panel-backup.online"), tone: "ok" };
  const off = !x.vm && x.nodes.length > 0 && x.nodes.every((n) => game.devices.find((d) => d.id === n.deviceId)?.on === false);
  return { label: t(off ? "panel-backup.halted" : "panel-backup.unreachable"), tone: "bad" };
}

// docs/design/plans/panel-ops.md, Backup Manager: Plesk's Backup Manager over the host's job and its sites' restore points.
export function BackupManager({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), [view, setView] = useState<View>("list"), job = c.jobs[0];
  const sites = game.workloads.filter((w) => w.clusterId === c.id && w.serviceId);
  const hours = [...new Set(sites.flatMap((w) => pointsOf(w).map((p) => p.at)))].sort((a, b) => b - a);
  const backUp = () => {
    if (job) return act(runJobNow, c.id, job.id);
    for (const w of sites) if (!act(backupNow, w.id).ok) return;
  };
  const back = <button className="cx-btn" onClick={() => setView("list")}>{t("panel-backup.back")}</button>;

  if (view === "schedule") return <Schedule game={game} c={c} done={() => setView("list")} />;
  if (view === "storage") return <Storage game={game} c={c} done={() => setView("list")} />;
  if (typeof view === "number") {
    const busy = sites.some((w) => game.webpanel.restoring[w.serviceId!]);
    return (
      <>
        <h4 className="cx-h">{formatClock(view)}</h4>
        <div className="cx-tools">{back}</div>
        <table className="cx-table">
          <thead><tr><th>{t("panel-backup.domain")}</th><th>{t("panel-backup.size")}</th><th>{t("panel-backup.version")}</th><th>{t("readouts.status")}</th><th /></tr></thead>
          <tbody>{sites.flatMap((w) => {
            const p = pointAt(w, view), site = game.services.find((v) => v.id === w.serviceId);
            if (!p) return [];
            const run = game.webpanel.restoring[w.serviceId!], st = statusOf([p]);
            return [(
              <tr key={w.id}>
                <td><b>{site?.domain ?? w.hostname}</b></td>
                <td className="num">{size(p.gb)}</td>
                <td className="num">{p.appVersion !== undefined && site?.spec.app ? `${APP_NAME[site.spec.app]} ${p.appVersion}` : "-"}</td>
                <td>{run ? <span className="cx-state">{t("panel-backup.restoring", { hours: Math.max(1, Math.ceil(run.until - game.hour)) })}</span> : <span className={`cx-state ${st.tone}`}>{st.label}</span>}</td>
                <td><button className="cx-btn" disabled={busy} onClick={() => act(restoreSite, c.id, w.serviceId!, view)}>{t("panel-backup.restore")}</button></td>
              </tr>
            )];
          })}</tbody>
        </table>
      </>
    );
  }
  return (
    <>
      <div className="cx-tools">
        <button className="cx-btn primary" onClick={backUp}>{t("panel-backup.backUp")}</button>
        <button className="cx-btn" onClick={() => setView("schedule")}>{t("panel-backup.schedule")}</button>
        <button className="cx-btn" onClick={() => setView("storage")}>{t("panel-backup.storage")}</button>
      </div>
      {hours.length === 0 ? <p className="cx-empty">{t("panel-backup.empty")}</p> : (
        <table className="cx-table">
          <thead><tr><th>{t("panel-backup.created")}</th><th>{t("panel-backup.size")}</th><th>{t("panel-backup.type")}</th><th>{t("readouts.status")}</th><th>{t("panel-backup.comment")}</th></tr></thead>
          <tbody>{hours.map((at) => {
            const pts = sites.map((w) => pointAt(w, at)).filter((p): p is RestorePoint => !!p), st = statusOf(pts);
            return (
              <tr key={at}>
                <td><button className="cx-link" onClick={() => setView(at)}>{formatClock(at)}</button></td>
                <td className="num">{size(pts.reduce((n, p) => n + p.gb, 0))}</td>
                <td>{t("panel-backup.full")}</td>
                <td><span className={`cx-state ${st.tone}`}>{st.label}</span></td>
                <td />
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </>
  );
}

// Scheduled Backup Settings: the host's first job, created on the first backup server when there is none.
function Schedule({ game, c, done }: { game: GameState; c: Cluster; done: () => void }) {
  const act = usePageAct(), job = c.jobs[0];
  const [d, setD] = useState({ on: !!job, every: job?.every ?? "daily", hour: job?.hour ?? 2, keep: job?.keep.last ?? 3 });
  const save = () => {
    const r = !d.on ? act(setBackup, c.id, null, "off")
      : act(saveJob, c.id, { id: job?.id, targetId: job?.targetId ?? backupTargets(game, c)[0]?.id, every: d.every, hour: d.hour, keep: { last: d.keep } });
    if (r.ok) done();
  };
  return (
    <form className="cx-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h4 className="cx-h">{t("panel-backup.schedule")}</h4>
      <label><input type="checkbox" role="switch" checked={d.on} onChange={(e) => setD({ ...d, on: e.target.checked })} /> {t("panel-backup.activate")}</label>
      <label className="cx-field">{t("panel-backup.every")}
        <select value={d.every} disabled={!d.on} onChange={(e) => setD({ ...d, every: e.target.value as "daily" | "weekly" })}>
          <option value="daily">{t("panel-backup.daily")}</option><option value="weekly">{t("panel-backup.weekly")}</option>
        </select>
      </label>
      <label className="cx-field">{t("panel-backup.at")}
        <select value={d.hour} disabled={!d.on} onChange={(e) => setD({ ...d, hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}</option>)}</select>
      </label>
      <label className="cx-field">{t("panel-backup.keep")}
        <input type="number" min={1} max={KEEP_MAX.last} value={d.keep} disabled={!d.on} onChange={(e) => setD({ ...d, keep: Math.min(KEEP_MAX.last, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <div className="cx-tools"><button className="cx-btn primary" type="submit">{t("panel-backup.okButton")}</button><button className="cx-btn" type="button" onClick={done}>{t("panel-backup.cancel")}</button></div>
    </form>
  );
}

// Remote Storage Settings: the backup server the host's job writes to.
function Storage({ game, c, done }: { game: GameState; c: Cluster; done: () => void }) {
  const act = usePageAct(), job = c.jobs[0], targets = backupTargets(game, c), [pick, setPick] = useState(job?.targetId ?? targets[0]?.id ?? "");
  return (
    <form className="cx-form" onSubmit={(e) => { e.preventDefault(); if (act(setBackup, c.id, pick, job?.every ?? "daily").ok) done(); }}>
      <h4 className="cx-h">{t("panel-backup.storage")}</h4>
      {targets.length === 0 ? <p className="cx-empty">{t("browser-consoles-2.noBackupServer")}</p> : (
        <table className="cx-table">
          <thead><tr><th /><th>{t("panel-backup.server")}</th><th>{t("readouts.status")}</th></tr></thead>
          <tbody>{targets.map((x) => {
            const st = storageState(game, x);
            return (
              <tr key={x.id}>
                <td><input type="radio" name="target" aria-label={x.name} checked={pick === x.id} onChange={() => setPick(x.id)} /></td>
                <td>{x.name}</td>
                <td><span className={`cx-state ${st.tone}`}>{st.label}</span></td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <div className="cx-tools"><button className="cx-btn primary" type="submit" disabled={!pick}>{t("panel-backup.okButton")}</button><button className="cx-btn" type="button" onClick={done}>{t("panel-backup.cancel")}</button></div>
    </form>
  );
}
