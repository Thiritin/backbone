import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { accountsOf } from "../../../../../sim/60-infra/webpanel";
import { startTransfer } from "../../../../../sim/90-actions/webpanel";
import { usePageAct } from "../../pageAct";

// WHM > Transfers > Transfer Tool in its three steps: the remote server, the accounts, the transfer itself.
export function TransferTool({ game, c, x3 }: { game: GameState; c: Cluster; x3: boolean }) {
  const act = usePageAct(), [picked, setPicked] = useState<string[]>([]);
  const accounts = accountsOf(game, c.id).filter((v) => v.spec.transferFrom);
  const open = accounts.filter((v) => game.webpanel.transfers[v.id]?.status !== "running" && game.webpanel.transfers[v.id]?.status !== "done");
  const from = open.find((v) => picked.includes(v.id))?.spec.transferFrom ?? open[0]?.spec.transferFrom ?? "";
  const runs = accounts.filter((v) => game.webpanel.transfers[v.id]);
  return (
    <>
      <h2>{x3 ? t("web.xfer.copy") : t("web.xfer.step1")}</h2>
      <div className="cx-form cp-form">
        <label className="cx-field"><span>{t("web.xfer.host")}</span><input readOnly value={from} /></label>
        <label className="cx-field"><span>{t("web.xfer.user")}</span><input readOnly value="root" /></label>
        <label className="cx-field"><span>{t("web.xfer.password")}</span><input readOnly type="password" value="********" /></label>
      </div>
      <h2>{t("web.xfer.step2")}</h2>
      <table className="cx-readout">
        <tbody>
          {open.length === 0 && <tr><td className="cx-empty">{t("web.xfer.none")}</td></tr>}
          {open.map((v) => (
            <tr key={v.id}>
              <td><input type="checkbox" aria-label={v.label} checked={picked.includes(v.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, v.id] : picked.filter((id) => id !== v.id))} /></td>
              <td>{v.label}</td><td>{v.spec.transferFrom}</td><td className="num">{t("web.xfer.size", { gb: v.spec.diskGb })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cx-acts"><button className="cx-btn primary" disabled={!picked.some((id) => open.some((v) => v.id === id))} onClick={() => { for (const id of picked) act(startTransfer, c.id, id); setPicked([]); }}>{t("web.xfer.start")}</button></p>
      <h2>{t("web.xfer.step3")}</h2>
      <table className="cx-readout">
        <thead><tr><th>{t("web.xfer.account")}</th><th>{t("web.xfer.progress")}</th><th>{t("web.xfer.status")}</th></tr></thead>
        <tbody>
          {runs.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("web.xfer.noRuns")}</td></tr>}
          {runs.map((v) => {
            const r = game.webpanel.transfers[v.id], pct = r.status === "running" ? Math.min(99, Math.round(((game.hour - r.startedAt) / Math.max(1, r.doneAt - r.startedAt)) * 100)) : 100;
            return (
              <tr key={v.id}>
                <td>{v.label}</td>
                <td><span className="cx-bar" data-level={r.status === "failed" ? "bad" : undefined}><i style={{ width: `${pct}%` }} /></span>{formatClock(r.doneAt)}</td>
                <td><span className={`cx-state ${r.status === "failed" ? "bad" : r.status === "done" ? "ok" : "accent"}`}>{t(`web.xfer.${r.status}`)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
