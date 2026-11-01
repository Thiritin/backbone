import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import { appVulns, cmsOf, hasBackup } from "../../../../../sim/60-infra/apps";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { accountsOf } from "../../../../../sim/60-infra/webpanel";
import { massUpdateSites, rollbackSite } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";

// WordPrass Toolkit from 2015 on, the Applications list with one Update link per site before.
export function Toolkit({ game, c, late }: { game: GameState; c: Cluster; late: boolean }) {
  const act = useStore((s) => s.act), [picked, setPicked] = useState<string[]>([]), [details, setDetails] = useState(false);
  const sites = accountsOf(game, c.id).filter((v) => cmsOf(v)), year = yearOf(game.hour);
  const flag = (id: string) => (game.webpanel.appBroken[id] !== undefined ? "broken" : appVulns(game, game.services.find((v) => v.id === id)!).length ? "vulnerable" : "ok");
  const vulnerable = sites.filter((v) => flag(v.id) === "vulnerable").length;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const behind = sites.filter((v) => (v.spec.appVersion ?? 0) < year).map((v) => v.id);
  return (
    <>
      {late && (
        <>
          <p>{t("web.tk.summary", { vulnerable, current: sites.length - vulnerable })}</p>
          <p className="cx-acts">
            <button className="cx-btn primary" disabled={!picked.length} onClick={() => { act(massUpdateSites, c.id, picked); setPicked([]); }}>{t("web.tk.update")}</button>
            <button className="cx-btn" disabled={!behind.length} onClick={() => act(massUpdateSites, c.id, behind)}>{t("web.tk.updateAll")}</button>
            <button className="cx-btn" aria-pressed={details} onClick={() => setDetails(!details)}>{t("web.tk.check")}</button>
          </p>
        </>
      )}
      <table className="cx-readout">
        <thead><tr>{late && <th />}<th>{t("web.tk.site")}</th><th>{t("web.tk.version")}</th><th>{t("web.tk.status")}</th>{late && details && <><th>{t("web.tk.notified")}</th><th>{t("web.tk.backup")}</th><th>{t("web.tk.managed")}</th></>}<th /></tr></thead>
        <tbody>
          {sites.length === 0 && <tr><td colSpan={7} className="cx-empty">{t("web.tk.none")}</td></tr>}
          {sites.map((v) => {
            const f = flag(v.id), worst = appVulns(game, v)[0];
            return (
              <tr key={v.id}>
                {late && <td><input type="checkbox" aria-label={v.label} checked={picked.includes(v.id)} onChange={() => toggle(v.id)} /></td>}
                <td>{v.label}</td>
                <td className="num">{APP_NAME[v.spec.app!]} {v.spec.appVersion ?? 0}</td>
                <td><span className={`cx-state ${f === "ok" ? "ok" : "bad"}`}>{t(`web.tk.${f}`)}</span>{f === "vulnerable" && worst && <span className="cx-sub">{t("web.tk.exposed", { severity: t(`web.tk.sev.${worst.severity}`), days: worst.days })}</span>}</td>
                {late && details && <><td>{game.sites.notified.some((x) => x.startsWith(`${v.id}|`)) ? t("web.tk.yes") : t("web.tk.no")}</td><td>{hasBackup(game, v.id) ? t("web.tk.yes") : t("web.tk.no")}</td><td>{v.spec.managedUpdates ? t("web.tk.yes") : t("web.tk.no")}</td></>}
                <td>
                  {f === "broken"
                    ? <button className="cx-btn" onClick={() => act(rollbackSite, v.id)}>{t("web.tk.rollback")}</button>
                    : (v.spec.appVersion ?? 0) < year && <button className="cx-btn" onClick={() => act(massUpdateSites, c.id, [v.id])}>{t("web.tk.updateOne")}</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
