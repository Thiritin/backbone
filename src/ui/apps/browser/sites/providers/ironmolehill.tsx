import { t } from "../../../../../i18n/en";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./ironmolehill.css";

const PILLARS = [
  ["providers.ironmolehill.pillar1", "providers.ironmolehill.pillar1Text"],
  ["providers.ironmolehill.pillar2", "providers.ironmolehill.pillar2Text"],
  ["providers.ironmolehill.pillar3", "providers.ironmolehill.pillar3Text"],
] as const;
const AUDITS = ["ISO 27001", "SOC 2", "PCI DSS", "HIPAA"];

// A small mountain with a rising sun, the company mark.
const Hill = ({ size }: { size: number }) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 32 24" aria-hidden="true">
    <circle cx="22" cy="8" r="4" fill="#8dc63f" /><path d="M1 23 11 7l5 7 3-4 12 13z" fill="currentColor" /><path d="M11 7l2.6 4.2L11 10l-2 2.5z" fill="#ffffff" opacity="0.7" />
  </svg>
);

// Iron Molehill: 2005 a records-management corporate page with a utility bar, blue gradient nav and a feature box; 2013 the data center brand in navy and lime with a vault hero and audit badges.
function Ironmolehill(props: ProviderProps) {
  const { p, look, route, go, year } = props, dcs = dcsOf(p.id), cities = citiesOf(p.id).join(", ");
  const labels = { home: t("providers.ironmolehill.navHome"), sites: t("providers.ironmolehill.navSites"), order: t("providers.ironmolehill.navColo"), account: t("providers.ironmolehill.navPortal") };
  const home = route.page === "home";
  return (
    <div className={`ps ps-ironmolehill ${look}`}>
      <div className="im-util"><Nav route={route} go={go} items={["account"]} labels={labels} /><span>{t("providers.contactUs")}</span></div>
      <header>
        <A to="/" go={go} className="ps-wm"><Hill size={look === "early" ? 40 : 34} /><span>IRON MOLEHILL{look === "late" && <small>{t("providers.ironmolehill.navSites")}</small>}</span></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order"] : ["sites", "order"]} labels={labels} />
      </header>
      {home ? <main>
        <section className="im-hero">
          <h1>{look === "early" ? t("providers.ironmolehill.heroEarly") : t("providers.ironmolehill.heroLate")}</h1>
          <p>{t("providers.ironmolehill.text", { cities })}</p>
          <A to="/sites" go={go} className="ps-btn pri">{t("providers.ironmolehill.cta")}</A>
        </section>
        <div className="im-pillars">{PILLARS.map(([h, x]) => <div key={h}><h3>{t(h)}</h3><p>{t(x)}</p></div>)}</div>
        <div className="im-audits"><span>{t("providers.ironmolehill.trusted")}</span>{AUDITS.map((a) => <b key={a}>{a}</b>)}</div>
        <div className="im-sites">{dcs.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}><strong>{d.name}</strong><span>{d.city}</span></A>)}</div>
      </main> : <main className="im-page"><h1>{titleOf(route)}</h1><Body {...props} /></main>}
      <footer><span>{t("providers.ironmolehill.footer", { year })}</span><span>{t("providers.legal")} | {t("providers.privacy")} | {t("providers.terms")}</span></footer>
    </div>
  );
}

export default { view: Ironmolehill, late: 2013 } satisfies Design;
