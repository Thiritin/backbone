import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { CERT_WARN_DAYS, certsOf, vpnOf, vpnOnCluster } from "../../../../../sim/60-infra/netsvc-vpn";
import { reissueCert, renewCert, revokeCert } from "../../../../../sim/90-actions/netsvc-vpn";
import type { PanelProps } from "../PanelBase";
import { useStore } from "../../../../store";

// The user table of each gateway. The early look lists the certificates like easy-rsa's index.txt, the late look names the state.
export function Certificates({ game, c, era }: { game: PanelProps["game"]; c: PanelProps["c"]; era: string }) {
  const act = useStore((s) => s.act), services = vpnOnCluster(game, c.id);
  if (!services.length) return <p className="cx-empty">{t("browser-consoles-2.nothingHere")}</p>;
  return <>{services.map((v) => {
    const x = vpnOf(game, v), expiry = dateOf(x.serverExpiresAt).toLocaleDateString(LOCALE, { timeZone: "UTC" });
    return (
      <section key={v.id} className="ov-certs">
        <h2>{v.label}</h2>
        <p className="ov-gw" data-soon={x.serverExpiresAt - game.hour < CERT_WARN_DAYS * 24}>{t("netsvc.gatewayCert")}: {x.serverExpiresAt <= game.hour ? t("netsvc.certExpired") : expiry} <button onClick={() => act(renewCert, v.id)}>{t("netsvc.regenerate")}</button></p>
        <table className="cx-table">
          <thead><tr><th>{t("netsvc.certUser")}</th><th>{t("netsvc.certState")}</th><th>{t("netsvc.certExpiry")}</th><th>{t("netsvc.certSerial")}</th><th /></tr></thead>
          <tbody>{certsOf(game, v).map((k) => (
            <tr key={k.index}>
              <td><b>{k.cn}</b></td>
              <td>{x.lost === k.index ? t("netsvc.certLost") : era === "early" ? (k.revoked ? "R" : "V") : k.revoked ? t("netsvc.certRevoked") : t("netsvc.certValid")}</td>
              <td className="num">{expiry}</td><td className="num">{k.serial}</td>
              <td className="cx-acts">
                {k.revoked ? <button onClick={() => act(reissueCert, v.id, k.index)}>{t("netsvc.reissue")}</button> : <button onClick={() => act(revokeCert, v.id, k.index)}>{t("netsvc.revoke")}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    );
  })}</>;
}
