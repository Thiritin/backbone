import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { hasBackup } from "../../../../../sim/60-infra/apps";
import { phpInstalled, phpRunning, sslStatus } from "../../../../../sim/60-infra/webpanel";
import { setAccountPhp } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";
import { Bar, type Row } from "../PanelBase";

// User Level: the host's users, and for the picked one the account page the real panel shows after "Login as".
export function UserLevel({ game, c, rows }: { game: GameState; c: Cluster; rows: Row[] }) {
  const act = useStore((s) => s.act), [pick, setPick] = useState<string | null>(null);
  const serviceOf = (r: Row) => game.workloads.find((w) => w.id === r.id)?.serviceId ?? null;
  const owner = (r: Row) => game.customers.find((x) => x.id === game.services.find((v) => v.id === serviceOf(r))?.customerId)?.name ?? r.name;
  const row = rows.find((r) => r.id === pick), id = row && serviceOf(row);
  if (!row || !id) return (
    <table className="cx-readout">
      <thead><tr><th>{t("web.da.customers")}</th><th>{t("browser-consoles-2.domain")}</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {rows.map((r) => <tr key={r.id}><td><button className="da-link" onClick={() => setPick(r.id)}>{owner(r)}</button></td><td>{r.name}</td></tr>)}
      </tbody>
    </table>
  );
  return (
    <>
      <p><button className="da-link" onClick={() => setPick(null)}>{t("web.da.back")}</button></p>
      <h2>{owner(row)}</h2>
      <dl className="da-facts">
        {([["web.da.cpu", row.cpu], ["web.da.ram", row.ram], ["web.da.disk", row.disk]] as const).map(([k, use]) => <div key={k}><dt>{t(k)}</dt><dd><Bar use={use} /></dd></div>)}
        <div><dt>{t("web.da.domains")}</dt><dd>{row.name}</dd></div>
        {c.kind === "panel" && (
          <div><dt>PHP</dt><dd>
            <select aria-label="PHP" value={phpRunning(game, c, id)} onChange={(e) => act(setAccountPhp, id, e.target.value)}>
              {phpInstalled(game, c).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </dd></div>
        )}
        {sslStatus(game, id) !== "valid" || game.webpanel.ssl.expires[id] !== undefined ? <div><dt>SSL</dt><dd>{t(`web.ssl.${sslStatus(game, id)}`)}</dd></div> : null}
        <div><dt>{t("web.da.backup")}</dt><dd>{hasBackup(game, id) ? t("web.da.yes") : t("web.da.no")}</dd></div>
      </dl>
    </>
  );
}
