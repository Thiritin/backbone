import { t } from "../../../../../i18n/en";
import { ecHealth, ecParity } from "../../../../../sim/60-infra/netsvc-storage";
import { setParity } from "../../../../../sim/90-actions/netsvc-storage";
import type { PanelProps } from "../PanelBase";
import { usePageAct } from "../../pageAct";

const STATE = { healthy: "netsvc.ecHealthy", degraded: "netsvc.ecDegraded", offline: "netsvc.ecOffline" } as const;

// Drive states of the cluster, the health of its erasure set and the parity that sets how many drives may fail.
export function Drives({ game, c }: { game: PanelProps["game"]; c: PanelProps["c"] }) {
  const act = usePageAct(), h = ecHealth(game, c.id);
  return (
    <section className="mn-drives">
      <h2>{t("netsvc.drives")}</h2>
      <p className="mn-ec" data-state={h.state}>
        {t("netsvc.ecHealth")}: <b>{t(STATE[h.state])}</b>
        {h.healing !== null && <> {t("netsvc.ecHealing")} <progress max={1} value={h.healing} /></>}
      </p>
      <label>{t("netsvc.ecParity")} <select value={ecParity(game, c.id)} onChange={(e) => act(setParity, c.id, Number(e.target.value))}>
        {[2, 4].map((n) => <option key={n} value={n}>EC:{n}</option>)}
      </select></label>
      <p className="cx-note num">{t("netsvc.ecSet", { n: h.set })}</p>
      <table className="cx-table">
        <thead><tr><th>{t("netsvc.drives")}</th><th /></tr></thead>
        <tbody>{h.drives.map((x) => (
          <tr key={x.component.id}>
            <td>{x.deviceId}/{x.component.id}</td>
            <td>{x.online ? (x.healing !== null ? t("netsvc.ecHealing") : t("netsvc.driveOnline")) : t("netsvc.driveOffline")}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
