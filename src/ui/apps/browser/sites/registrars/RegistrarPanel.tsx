import { useState, type CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { registrarHost, type Registrar } from "../../../../../sim/10-catalog/registrars";
import { wholesale } from "../../../../../sim/30-customers/registrar";
import { domainOf, domainStatus, nameServers, registryOf, type Domain, type NameServerMode } from "../../../../../sim/30-customers/registry";
import type { GameState } from "../../../../../sim/50-state";
import { generateAuthCode, setDomainRenewal, setNameServers } from "../../../../../sim/90-actions/registrar";
import { euroCents } from "../../../../../sim/00-core/money";
import { formatDay } from "../../../billing/format";
import { displayHost } from "../../../../../sim/80-business/browser";
import { usePageAct } from "../../pageAct";
import { NsBadge, RegistrarDns } from "./RegistrarDns";
import { Account, customer, DomainSearch, own, REGISTRAR_HUE } from "./RegistrarPage";
import { InvoiceTable, PayMethodPanel } from "../shared/SupplierAccount";
import "../bank/bank-site.css";

// The login opens for the partner and for a former partner with invoices.
export const panelOpen = customer;

export type PanelPage = "domains" | "dns" | "register" | "account" | { domain: string };

// The page a /login path opens; a former partner only has the account, the DNS page needs the company domain, a domain
// page a domain under management.
export function panelPage(game: GameState, r: Registrar, sub?: string, name?: string): PanelPage {
  if (sub === "account" || !own(game, r)) return "account";
  if (name) return domainOf(game, name) ? { domain: name } : "domains";
  if (sub === "dns") return game.company.domain ? "dns" : "domains";
  return sub === "register" ? "register" : "domains";
}
const panelPath = (to: PanelPage) => (typeof to === "object" ? `/domain/${to.domain}` : to === "domains" || to === "account" ? "" : `/${to}`);
// The configured pair, ignoring a change still propagating.
const configured = (game: GameState, d: Domain) => nameServers(game, { ...d, nsReadyAt: undefined });
export const modeKey = (ns: NameServerMode) => (ns === "custom" ? "registrarPanel.ns.custom" : "registrarPanel.ns.registrar");

// The reseller panel: every domain with owner, expiry, renewal, status and name servers; per domain the auth code, the renewal switch and its own page. The DNS page edits the company domain's zone, Register orders further domains.
export function RegistrarPanel({ game, r, page, go }: { game: GameState; r: Registrar; page: PanelPage; go: (url: string) => void }) {
  const act = usePageAct();
  const open = (to: PanelPage) => (e: { preventDefault(): void }) => { e.preventDefault(); go(`${displayHost(registrarHost(r))}/${to === "account" ? "account" : `login${panelPath(to)}`}`); };
  const current = typeof page === "object" ? "domains" : page;
  const link = (to: PanelPage, label: string) => (
    <a href={`#${panelPath(to)}`} aria-current={current === to ? "page" : undefined} onClick={open(to)}>{label}</a>
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
        <nav className="bks-nav">
          {own(game, r) && <>{link("domains", t("registrarPanel.domains"))}{game.company.domain && link("dns", t("registrarDns.nav"))}{link("register", t("registrarPanel.register"))}</>}
          {link("account", t("accounts.myAccount"))}
        </nav>
        <main className="bks-main">
          {page === "account" ? <>
            {own(game, r) && <section className="bks-box"><Account game={game} r={r} title={t("accounts.contract")} /></section>}
            {game.bank && <section className="bks-box"><h2>{t("accounts.payMethod")}</h2><PayMethodPanel game={game} name={r.name} title={game.company.name} /></section>}
            <section className="bks-box"><h2>{t("accounts.invoices")}</h2><InvoiceTable game={game} name={r.name} className="bks-table bks-rows" /></section>
          </>
            : page === "dns" ? <RegistrarDns game={game} r={r} />
            : page === "register" ? <section className="bks-box"><h2>{t("registrarPanel.register")}</h2><DomainSearch game={game} r={r} /></section>
            : typeof page === "object" ? <DomainPage key={page.domain} game={game} d={domainOf(game, page.domain)!} owner={owner} />
            : <section className="bks-box">
            <h2>{t("registrarPanel.domains")}</h2>
            <table className="bks-table">
              <thead>
                <tr>
                  <th>{t("browser-sites-1.rg.domain")}</th><th>{t("registrarPanel.owner")}</th><th>{t("browser-sites-1.rg.expires")}</th>
                  <th>{t("registrarPanel.renewal")}</th><th>{t("registrarPanel.status")}</th><th>{t("registrarPanel.nameServers")}</th><th>{t("registrarForm.authCode")}</th><th />
                </tr>
              </thead>
              <tbody>
                {[...game.domains].sort((a, b) => a.name.localeCompare(b.name)).map((d) => {
                  const status = domainStatus(d), live = status === "active" || status === "cancelled";
                  return (
                    <tr key={d.name}>
                      <td><a href={`#/domain/${d.name}`} onClick={open({ domain: d.name })}>{d.name}</a></td>
                      <td>{owner(d.customerId)}</td>
                      <td className="num">{formatDay(d.expiresAt)}</td>
                      <td>{t(d.cancelled || !live ? "registrarPanel.off" : "registrarPanel.on")}</td>
                      <td>{t(`registrarPanel.status.${status}`)}</td>
                      <td className="num">{t(modeKey(d.ns))}: {configured(game, d).join(", ")} <NsBadge game={game} d={d} /></td>
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

// One domain: its registry facts and the name server form.
function DomainPage({ game, d, owner }: { game: GameState; d: Domain; owner: (id: string | null) => string }) {
  const act = usePageAct();
  const [custom, setCustom] = useState(d.ns === "custom");
  const [hosts, setHosts] = useState<[string, string]>(d.nsHosts ?? ["", ""]);
  const pair = nameServers(game, { ...d, ns: "registrar", nsReadyAt: undefined }).join(", ");
  const save = () => act(setNameServers, d.name, custom ? "custom" : d.ns !== "custom" ? d.ns : d.name === game.company.domain ? "company" : "registrar", custom ? hosts : undefined);
  const fact = (label: string, value: string) => <tr><th>{label}</th><td className="num">{value}</td></tr>;
  return (
    <>
      <section className="bks-box">
        <h2>{d.name}</h2>
        <table className="bks-table rgp-facts">
          <tbody>
            {fact(t("registrarPanel.registry"), registryOf(d.name).name)}
            {fact(t("registrarPanel.registeredOn"), formatDay(d.registeredAt))}
            {fact(t("registrarPanel.expiresOn"), formatDay(d.expiresAt))}
            {fact(t("registrarPanel.wholesale"), euroCents(wholesale(game, d.name)))}
            {fact(t("registrarPanel.owner"), owner(d.customerId))}
            {fact(t("registrarPanel.status"), t(`registrarPanel.status.${domainStatus(d)}`))}
          </tbody>
        </table>
      </section>
      <section className="bks-box">
        <h2>{t("registrarPanel.nameServers")} <NsBadge game={game} d={d} /></h2>
        <form className="rgp-ns" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="bks-row">
            <input type="radio" name="ns" checked={!custom} onChange={() => setCustom(false)} />
            <span>{t("registrarPanel.ns.registrar")}</span>
            <span className="num">{pair}</span>
          </label>
          <label className="bks-row">
            <input type="radio" name="ns" checked={custom} onChange={() => setCustom(true)} />
            <span>{t("registrarPanel.ns.custom")}</span>
          </label>
          {custom && (
            <div className="bks-form">
              {hosts.map((h, i) => (
                <label key={i}>
                  <span>{t(i ? "registrarPanel.ns2" : "registrarPanel.ns1")}</span>
                  <input spellCheck={false} autoCapitalize="off" value={h} onChange={(e) => setHosts(i ? [hosts[0], e.target.value] : [e.target.value, hosts[1]])} />
                </label>
              ))}
            </div>
          )}
          <button type="submit" className="bks-btn primary">{t("registrarPanel.save")}</button>
        </form>
      </section>
    </>
  );
}
