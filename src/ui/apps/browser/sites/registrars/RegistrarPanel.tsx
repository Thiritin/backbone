import type { CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import type { Registrar } from "../../../../../sim/10-catalog/registrars";
import { domainStatus } from "../../../../../sim/30-customers/registry";
import type { GameState } from "../../../../../sim/50-state";
import { generateAuthCode, setDomainRenewal } from "../../../../../sim/90-actions/registrar";
import { formatDay } from "../../../billing/format";
import { registrarUrl } from "../../../../../sim/80-business/browser";
import { usePageAct } from "../../pageAct";
import { RegistrarDns } from "./RegistrarDns";
import { REGISTRAR_HUE } from "./RegistrarPage";
import "../bank/bank-site.css";

// The login opens once the partner has registered a domain, the company's own or a customer's.
export const panelOpen = (game: GameState, r: Registrar): boolean => game.registrar?.id === r.id && game.domains.length > 0;

export type PanelPage = "domains" | "dns";

// The reseller panel: every domain with owner, expiry, renewal and status; per domain the auth code and the renewal switch. The DNS page edits the company domain's zone.
export function RegistrarPanel({ game, r, page, go }: { game: GameState; r: Registrar; page: PanelPage; go: (url: string) => void }) {
  const act = usePageAct();
  const link = (to: PanelPage, label: string) => (
    <a href={`#${to}`} aria-current={page === to ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(`${registrarUrl(game)}login${to === "dns" ? "/dns" : ""}`); }}>{label}</a>
  );
  const skin = { "--bar": `oklch(0.42 0.1 ${REGISTRAR_HUE[r.id]})`, "--accent": `oklch(0.55 0.09 ${REGISTRAR_HUE[r.id]})`, "--bg": "#f2f2ee" } as CSSProperties;
  const owner = (id: string | null) => (id ? game.customers.find((c) => c.id === id)?.name ?? "" : game.company.name);
  return (
    <div className="bks" style={skin}>
      <header className="bks-head">
        <span className="bks-logo" aria-hidden>{r.name.charAt(0)}</span>
        <span className="bks-name">{r.name}</span>
      </header>
      <div className="bks-cols">
        <nav className="bks-nav">{link("domains", t("registrarPanel.domains"))}{game.company.domain && link("dns", t("registrarDns.nav"))}</nav>
        <main className="bks-main">
          {page === "dns" ? <RegistrarDns game={game} r={r} /> : <section className="bks-box">
            <h2>{t("registrarPanel.domains")}</h2>
            <table className="bks-table">
              <thead>
                <tr>
                  <th>{t("browser-sites-1.rg.domain")}</th><th>{t("registrarPanel.owner")}</th><th>{t("browser-sites-1.rg.expires")}</th>
                  <th>{t("registrarPanel.renewal")}</th><th>{t("registrarPanel.status")}</th><th>{t("registrarForm.authCode")}</th><th />
                </tr>
              </thead>
              <tbody>
                {[...game.domains].sort((a, b) => a.name.localeCompare(b.name)).map((d) => {
                  const status = domainStatus(d), live = status === "active" || status === "cancelled";
                  return (
                    <tr key={d.name}>
                      <td>{d.name}</td>
                      <td>{owner(d.customerId)}</td>
                      <td className="num">{formatDay(d.expiresAt)}</td>
                      <td>{t(d.cancelled || !live ? "registrarPanel.off" : "registrarPanel.on")}</td>
                      <td>{t(`registrarPanel.status.${status}`)}</td>
                      <td className="num">{d.code && status !== "gone" ? d.code : live && <button className="bks-btn" onClick={() => act(generateAuthCode, d.name)}>{t("registrarPanel.generate")}</button>}</td>
                      <td>{live && <button className="bks-btn" onClick={() => act(setDomainRenewal, d.name, !!d.cancelled)}>{t(d.cancelled ? "registrarPanel.renew" : "registrarPanel.cancel")}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>}
        </main>
      </div>
      <footer className="bks-foot">{t("bank.site.footer", { name: r.name, year: yearOf(game.hour) })}</footer>
    </div>
  );
}
