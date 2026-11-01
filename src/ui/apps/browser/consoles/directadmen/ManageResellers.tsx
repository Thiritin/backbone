import { t } from "../../../../../i18n/en";
import { suspendService, unsuspendService } from "../../../../../sim/90-actions/holds";
import { resellersOn } from "../../../../../sim/30-customers/resellers";
import { serviceHeld } from "../../../../../sim/45-billing/billing";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { useStore } from "../../../../store";

// Admin level > Manage Resellers: the host's reseller blocks with their fill, and Suspend.
export function ManageResellers({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), list = resellersOn(game, c.id);
  return (
    <table className="cx-readout">
      <thead><tr><th>{t("web.rs.reseller")}</th><th>{t("web.rs.accounts")}</th><th>{t("web.rs.disk")}</th><th>{t("web.rs.fill")}</th><th /></tr></thead>
      <tbody>
        {list.length === 0 && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {list.map((v) => {
          const r = game.webpanel.resellers[v.customerId], held = serviceHeld(game, v);
          return (
            <tr key={v.id}>
              <td>{game.customers.find((x) => x.id === v.customerId)?.name}</td>
              <td className="num">{Math.round((r?.accounts ?? 0) * (r?.fillRate ?? 0))} / {v.spec.accounts}</td>
              <td className="num">{v.spec.diskGb} GB</td>
              <td className="num">{Math.round((r?.fillRate ?? 0) * 100)} %</td>
              <td><button className="cx-btn" onClick={() => act(held ? unsuspendService : suspendService, v.id)}>{held ? t("web.rs.resume") : t("web.rs.suspend")}</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
