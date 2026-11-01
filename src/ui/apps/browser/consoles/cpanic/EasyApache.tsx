import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { PHP, phpAt } from "../../../../../sim/10-catalog/platforms";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import { cmsOf } from "../../../../../sim/60-infra/apps";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { accountsOf, phpInstalled, phpOlder, phpRunning, POOL_MAX, poolOf, siteBroken } from "../../../../../sim/60-infra/webpanel";
import { phpDue, upgradePhp } from "../../../../../sim/90-actions/clusters";
import { setAccountPhp, setPhpPool } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";

// The legacy versions a host can still install: released, and older than its newest.
export const legacyVersions = (game: GameState, c: Cluster): string[] =>
  PHP.filter((p) => p.year <= yearOf(game.hour) && phpOlder(p.version, c.php)).map((p) => p.version).reverse();

// The PHP versions installed on a panel host and the version each account runs. The x3 era asks for a profile and a build; later
// each version has its own button.
export function PhpProfiles({ game, c, x3 }: { game: GameState; c: Cluster; x3: boolean }) {
  const act = useStore((s) => s.act), pool = poolOf(game, c.id), [pick, setPick] = useState<string[] | null>(null), [keep, setKeep] = useState(false);
  const chosen = pick ?? pool, building = game.hour <= c.phpUntil, now = phpAt(yearOf(game.hour));
  const toggle = (v: string) => setPick(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);
  const installed = phpInstalled(game, c), accounts = accountsOf(game, c.id);
  return (
    <>
      {phpDue(game, c) && (
        <p className="cx-acts">
          <button className="cx-btn primary" onClick={() => act(upgradePhp, c.id, keep)}>{t("web.ea.update", { version: now })}</button>
          <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> {t("web.ea.keep", { version: c.php })}</label>
        </p>
      )}
      <h2>{x3 ? t("web.ea.profile") : t("web.ea.phpVersions")}</h2>
      <table className="cx-readout">
        <thead><tr><th>{t("web.ea.phpVersion")}</th><th>{t("web.ea.status")}</th><th /></tr></thead>
        <tbody>
          <tr><td className="num">{c.php}</td><td><span className="cx-state ok">{t("web.ea.default")}</span></td><td /></tr>
          {legacyVersions(game, c).map((v) => {
            const on = x3 ? chosen.includes(v) : pool.includes(v);
            return (
              <tr key={v}>
                <td className="num">{x3 && <input type="checkbox" aria-label={v} checked={on} disabled={!on && chosen.length >= POOL_MAX} onChange={() => toggle(v)} />} {v}</td>
                <td>{on && <span className="cx-state">{t("web.ea.installed")}</span>}</td>
                <td>{!x3 && <button className="cx-btn" disabled={!on && pool.length >= POOL_MAX} onClick={() => act(setPhpPool, c.id, on ? pool.filter((x) => x !== v) : [...pool, v])}>{on ? t("web.ea.remove") : t("web.ea.install")}</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {x3 && <p className="cx-acts"><button className="cx-btn primary" disabled={building} onClick={() => { act(setPhpPool, c.id, chosen); setPick(null); }}>{building ? t("web.ea.building") : t("web.ea.build")}</button></p>}
      <h2>{t("web.ea.multiphp")}</h2>
      <table className="cx-readout">
        <thead><tr><th>{t("web.ea.domain")}</th><th>{t("web.ea.software")}</th><th>{t("web.ea.phpVersion")}</th><th>{t("web.ea.status")}</th></tr></thead>
        <tbody>
          {accounts.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("web.ea.none")}</td></tr>}
          {accounts.map((v) => {
            const app = cmsOf(v), bad = siteBroken(game, c, v.id);
            return (
              <tr key={v.id}>
                <td>{v.label}</td>
                <td>{app ? APP_NAME[app] : APP_NAME.static}</td>
                <td>
                  <select aria-label={v.label} value={phpRunning(game, c, v.id)} onChange={(e) => act(setAccountPhp, v.id, e.target.value)}>
                    {installed.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </td>
                <td><span className={`cx-state ${bad ? "bad" : "ok"}`}>{bad ? t("web.ea.incompatible") : t("web.ea.ok")}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
