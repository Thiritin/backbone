import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { EXPIRY_CHOICES, isOwnclod, shareExpired, sharesOf, storageOnCluster } from "../../../../../sim/60-infra/netsvc-storage";
import { deleteShare, extendShare, setSharePolicy } from "../../../../../sim/90-actions/netsvc-storage";
import { useStore } from "../../../../store";
import type { PanelProps } from "../PanelBase";

const day = (h: number) => dateOf(h).toLocaleDateString(LOCALE, { timeZone: "UTC" });

// The "Shared by link" list of every customer on the cluster and the admin default for how long a link lives.
export function Shares({ game, c }: { game: PanelProps["game"]; c: PanelProps["c"] }) {
  const act = useStore((s) => s.act), services = storageOnCluster(game, c.id).filter((v) => isOwnclod(game, v));
  return (
    <>
      <label className="oc-policy">{t("netsvc.shareDefaultExpiry")} <select value={game.netsvc.policy.shareExpiryDays} onChange={(e) => act(setSharePolicy, Number(e.target.value))}>
        {EXPIRY_CHOICES.map((n) => <option key={n} value={n}>{n === 0 ? t("netsvc.shareNoExpiry") : t("netsvc.days", { n })}</option>)}
      </select></label>
      {services.map((v) => (
        <section key={v.id}>
          <h2>{v.label}</h2>
          <table className="cx-table">
            <thead><tr><th>{t("netsvc.shareName")}</th><th>{t("netsvc.shareCreated")}</th><th>{t("netsvc.shareExpires")}</th><th>{t("netsvc.sharePassword")}</th><th /></tr></thead>
            <tbody>{sharesOf(game, v).map((x) => (
              <tr key={x.id} data-expired={shareExpired(game, x)}>
                <td><b>{x.name}</b></td>
                <td className="num">{day(x.createdAt)}</td>
                <td className="num">{x.expiresAt === null ? t("netsvc.shareNever") : shareExpired(game, x) ? t("netsvc.shareExpired") : day(x.expiresAt)}</td>
                <td>{x.password ? "*" : ""}</td>
                <td className="cx-acts">
                  {shareExpired(game, x) && <button onClick={() => act(extendShare, v.id, x.id)}>{t("netsvc.shareExtend")}</button>}
                  <button onClick={() => act(deleteShare, v.id, x.id)}>{t("netsvc.shareDelete")}</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      ))}
    </>
  );
}
