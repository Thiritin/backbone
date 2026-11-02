import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { A, Body, dcsOf, fromPrice, Nav, SiteFacts, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./docklands.css";

// Ofcom's drama range, so the number reaches nobody.
const PHONE = "020 7946 0321";
const WHY = ["providers.docklands.why1", "providers.docklands.why2", "providers.docklands.why3", "providers.docklands.why4"] as const;

// Dockside crane, the company mark.
const Crane = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M8 30V6M12 30V6M8 10l4-4M8 16l4-4M8 22l4-4M8 6h22M12 6l18 5M4 6h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M26 6v8" stroke="currentColor" strokeWidth="1.2" /><rect x="23.5" y="14" width="5" height="4" fill="#f5a623" /><path d="M2 30h28" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Docklands Data: 2005 a small-business page with a phone number in the header, a navy and yellow bar and a ticked sidebar; 2017 a template site with an orange quote button, a dark teal hero, feature boxes and a testimonial.
function Docklands(props: ProviderProps) {
  const { p, look, route, go, year } = props, price = euro(fromPrice(p.id)), dc = dcsOf(p.id)[0];
  const labels = { sites: t("providers.docklands.navSites"), order: t("providers.docklands.navColo"), account: t("providers.docklands.navPortal") };
  const wm = <A to="/" go={go} className="ps-wm"><Crane size={look === "early" ? 34 : 30} /><span><b>Docklands</b> Data</span></A>;
  const home = route.page === "home";
  if (look === "early") return (
    <div className="ps ps-docklands early">
      <header>{wm}<span className="dd-call">{t("providers.docklands.call", { phone: PHONE })}</span></header>
      <Nav route={route} go={go} labels={labels} />
      <div className="dd-frame">
        <aside>
          <h3>{t("providers.docklands.why")}</h3>
          <ul>{WHY.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </aside>
        <main>
          {home ? <>
            <h1>{t("providers.docklands.heroEarly")}</h1>
            <p>{t("providers.docklands.text", { price })}</p>
            <SiteFacts dc={dc} />
            <p><A to="/order" go={go} className="ps-btn pri">{t("providers.docklands.quote")}</A></p>
          </> : <><h1>{titleOf(route)}</h1><Body {...props} /></>}
        </main>
      </div>
      <footer>{t("providers.docklands.footer", { year })} | {t("providers.terms")} | {t("providers.privacy")}</footer>
    </div>
  );
  return (
    <div className="ps ps-docklands late">
      <header>
        {wm}
        <Nav route={route} go={go} items={["home", "sites", "account"]} labels={labels} />
        <span className="dd-call">{PHONE}</span>
        <A to="/order" go={go} className="ps-btn pri">{t("providers.docklands.quote")}</A>
      </header>
      {home ? <main>
        <section className="dd-hero">
          <h1>{t("providers.docklands.heroLate")}</h1>
          <p>{t("providers.docklands.text", { price })}</p>
          <A to="/order" go={go} className="ps-btn pri">{t("providers.docklands.quote")}</A>
        </section>
        <div className="dd-boxes">{WHY.map((k, i) => <div key={k}><span className="dd-icon">{i + 1}</span><h3>{t(k)}</h3></div>)}</div>
        <blockquote><p>{t("providers.docklands.quoteText")}</p><cite>{t("providers.docklands.quoteBy")}</cite></blockquote>
      </main> : <main className="dd-page"><h1>{titleOf(route)}</h1><Body {...props} /></main>}
      <footer><span>{t("providers.docklands.footer", { year })}</span><span>{t("providers.terms")} | {t("providers.privacy")}</span></footer>
    </div>
  );
}

export default { view: Docklands, late: 2017 } satisfies Design;
