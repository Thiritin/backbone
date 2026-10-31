import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { accountsOf, autoSslOn, sslStatus } from "../../../../../sim/60-infra/webpanel";
import { renewCertificate, runAutoSslCheck, setAutoSsl } from "../../../../../sim/90-actions/webpanel";
import { useStore } from "../../../../store";

type Part = "providers" | "managed" | "logs";

// WHM > SSL/TLS > Manage AutoSSL with the real tabs.
export function AutoSsl({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), [part, setPart] = useState<Part>("managed"), on = autoSslOn(game, c.id);
  const accounts = accountsOf(game, c.id), x = game.webpanel.ssl;
  const expired = accounts.filter((v) => sslStatus(game, v.id) === "expired").length;
  const name = (id: string) => game.services.find((v) => v.id === id)?.label ?? id;
  return (
    <>
      <p>{on ? t("web.ssl.on") : t("web.ssl.off")} {t("web.ssl.summary", { valid: accounts.length - expired, expired })}</p>
      <p className="cx-acts">
        <button className="cx-btn" onClick={() => act(setAutoSsl, c.id, !on)}>{on ? t("web.ssl.disable") : t("web.ssl.enable")}</button>
        {on && <button className="cx-btn primary" onClick={() => act(runAutoSslCheck, c.id)}>{t("web.ssl.check")}</button>}
      </p>
      <div className="cx-tools" role="tablist">
        {(["providers", "managed", "logs"] as Part[]).map((k) => <button key={k} role="tab" className="cx-chip" aria-pressed={part === k} onClick={() => setPart(k)}>{t(`web.ssl.${k}`)}</button>)}
      </div>
      {part === "providers" && <p>{t("web.ssl.provider")}</p>}
      {part === "managed" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.ssl.domain")}</th><th>{t("web.ssl.expires")}</th><th>{t("web.ssl.status")}</th><th /></tr></thead>
          <tbody>
            {accounts.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("web.ssl.none")}</td></tr>}
            {accounts.map((v) => {
              const st = sslStatus(game, v.id), at = x.expires[v.id];
              return (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td className="num">{at === undefined ? "" : formatClock(at)}</td>
                  <td><span className={`cx-state ${st === "expired" ? "bad" : st === "renewing" ? "accent" : "ok"}`}>{t(`web.ssl.${st}`)}</span></td>
                  <td>{at !== undefined && <button className="cx-btn" onClick={() => act(renewCertificate, v.id)}>{t("web.ssl.renew")}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {part === "logs" && (
        <table className="cx-readout">
          <thead><tr><th>{t("web.ssl.time")}</th><th>{t("web.ssl.domain")}</th><th>{t("web.ssl.status")}</th></tr></thead>
          <tbody>
            {x.log.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("web.ssl.noLogs")}</td></tr>}
            {[...x.log].reverse().filter((l) => accounts.some((v) => v.id === l.serviceId)).map((l, i) => <tr key={i}><td className="num">{formatClock(l.hour)}</td><td>{name(l.serviceId)}</td><td>{l.ok ? t("web.ssl.logOk") : t("web.ssl.logFail")}</td></tr>)}
          </tbody>
        </table>
      )}
    </>
  );
}
