import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { CERT_WARN_DAYS, certsOf, isAnyconnekt, vpnOf, vpnOnCluster } from "../../../../../sim/60-infra/netsvc-vpn";
import { reissueCert, renewCert, revokeCert, setAutoEnroll } from "../../../../../sim/90-actions/netsvc-vpn";
import type { PanelProps } from "../PanelBase";
import { usePageAct } from "../../pageAct";

// The identity certificates of each gateway with the ASDM columns; Delete before 2016 and Revoke after it remove a certificate from use.
export function IdentityCerts({ game, c, era }: { game: PanelProps["game"]; c: PanelProps["c"]; era: string }) {
  const act = usePageAct(), services = vpnOnCluster(game, c.id);
  if (!services.length) return <p className="cx-empty">{t("browser-consoles-1.nothingYet")}</p>;
  return <>{services.map((v) => {
    const x = vpnOf(game, v), expiry = dateOf(x.serverExpiresAt).toLocaleDateString(LOCALE, { timeZone: "UTC" });
    return (
      <section key={v.id} className="sy-box">
        <h2>{v.label}</h2>
        <p className="sy-gw" data-soon={x.serverExpiresAt - game.hour < CERT_WARN_DAYS * 24}>
          {t("netsvc.gatewayCert")}: {x.serverExpiresAt <= game.hour ? t("netsvc.certExpired") : expiry} <button onClick={() => act(renewCert, v.id)}>{t("netsvc.enrollCert")}</button>
          {isAnyconnekt(game, v) && <label><input type="checkbox" checked={x.autoEnroll} onChange={(e) => act(setAutoEnroll, v.id, e.target.checked)} />{t("netsvc.autoEnroll")}</label>}
        </p>
        <table className="cx-table">
          <thead><tr><th>{t("netsvc.certIssuedTo")}</th><th>{t("netsvc.certIssuedBy")}</th><th>{t("netsvc.certExpiry")}</th><th>{t("netsvc.certUsage")}</th><th /></tr></thead>
          <tbody>{certsOf(game, v).map((k) => (
            <tr key={k.index}>
              <td><b>{k.cn}</b></td><td>{c.name}</td><td className="num">{expiry}</td>
              <td>{x.lost === k.index ? t("netsvc.certLost") : k.revoked ? t("netsvc.certRevoked") : t("netsvc.certClient")}</td>
              <td className="cx-acts">
                {k.revoked ? <button onClick={() => act(reissueCert, v.id, k.index)}>{t("netsvc.reissue")}</button> : <button onClick={() => act(revokeCert, v.id, k.index)}>{era === "early" ? t("netsvc.delete") : t("netsvc.revoke")}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    );
  })}</>;
}
