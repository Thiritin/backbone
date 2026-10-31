import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { phpAt } from "../../../../../sim/10-catalog/platforms";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { poolOf } from "../../../../../sim/60-infra/webpanel";
import { phpDue, upgradePhp } from "../../../../../sim/90-actions/clusters";
import { updateDue, updateSoftware } from "../../../../../sim/90-actions/software";
import { rebuildHost, setPhpPool } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";
import { legacyVersions } from "../cpanic/EasyApache";

// Admin Level > Custom Build. Until 2018 it is the build script's option list; later a table of software with Update and Rebuild.
export function CustomBuild({ game, c, late }: { game: GameState; c: Cluster; late: boolean }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour), pool = poolOf(game, c.id), php2 = pool[0] ?? "";
  const building = game.hour <= c.phpUntil, legacy = legacyVersions(game, c);
  const pickPhp2 = (v: string) => act(setPhpPool, c.id, v ? [v] : []);
  const select = (
    <select aria-label={t("web.da.php2")} value={php2} onChange={(e) => pickPhp2(e.target.value)}>
      <option value="">{t("web.da.noPhp2")}</option>
      {legacy.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );
  const rebuild = <button className="cx-btn primary" disabled={building} onClick={() => act(rebuildHost, c.id)}>{building ? t("web.da.rebuilding") : t("web.da.rebuild")}</button>;
  if (!late) return (
    <>
      <pre className="da-pre">{`php1_release=${c.php}\nphp2_release=${php2 || t("web.da.noPhp2")}\nphp1_mode=fastcgi`}</pre>
      <p className="cx-acts">
        <label>{t("web.da.php2")} {select}</label>
        {phpDue(game, c) && <button className="cx-btn" onClick={() => act(upgradePhp, c.id)}>{t("web.da.update")} {t("web.da.php1")}</button>}
        {updateDue(game, c) && <button className="cx-btn" onClick={() => act(updateSoftware, c.id)}>{t("web.da.update")} {t("web.da.panel")}</button>}
        {rebuild}
      </p>
    </>
  );
  return (
    <>
      <table className="cx-readout">
        <thead><tr><th>{t("web.da.software")}</th><th>{t("web.da.current")}</th><th>{t("web.da.latest")}</th><th /></tr></thead>
        <tbody>
          <tr><td>{t("web.da.php1")}</td><td className="num">{c.php}</td><td className="num">{phpAt(year)}</td><td>{phpDue(game, c) && <button className="cx-btn" onClick={() => act(upgradePhp, c.id)}>{t("web.da.update")}</button>}</td></tr>
          <tr><td>{t("web.da.php2")}</td><td className="num">{php2 || t("web.da.noPhp2")}</td><td>{select}</td><td /></tr>
          <tr><td>{t("web.da.panel")}</td><td className="num">{c.version}</td><td className="num">{year}</td><td>{updateDue(game, c) && <button className="cx-btn" onClick={() => act(updateSoftware, c.id)}>{t("web.da.update")}</button>}</td></tr>
        </tbody>
      </table>
      <p className="cx-acts">{rebuild}</p>
    </>
  );
}
