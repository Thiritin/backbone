import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./digitalreality.css";

// Digital Reality: 2005 an investor-minded REIT site with a utility bar, a navy menu and a solutions column; 2017 a dark platform page with a stats band and market cards.
function DigitalReality(props: ProviderProps) {
  const { p, look, route, go, year } = props, sites = dcsOf(p.id), cities = citiesOf(p.id);
  const labels = { sites: t("providers.digitalreality.navSites"), order: t("providers.digitalreality.navOrder"), account: t("providers.digitalreality.navPortal") };
  const carriers = sites.reduce((n, d) => n + d.carriers, 0);
  return (
    <div className={`ps ps-digitalreality ${look}`}>
      <div className="dr-util"><span>{t("providers.digitalreality.investors")}</span><span>{t("providers.digitalreality.careers")}</span><span>{t("providers.digitalreality.ticker")}</span></div>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="digitalreality" size={look === "early" ? 30 : 22} /><span>{look === "early" ? <>DIGITAL <b>REALITY</b></> : <>Digital Reality</>}</span></A>
        <Nav route={route} go={go} labels={labels} />
      </header>
      <main>
        {route.page === "home" ? <>
          <section className="dr-hero">
            <h1>{look === "early" ? t("providers.digitalreality.heroEarly") : t("providers.digitalreality.heroLate")}</h1>
            <p>{t("providers.digitalreality.text", { cities: cities.length })}</p>
            <A to="/sites" go={go} className="ps-btn pri">{t("providers.digitalreality.cta")}</A>
          </section>
          {look === "late" && (
            <dl className="dr-stats">
              <div><dt>{t("providers.digitalreality.statSites")}</dt><dd>{sites.length}</dd></div>
              <div><dt>{t("providers.digitalreality.statMetros")}</dt><dd>{cities.length}</dd></div>
              <div><dt>{t("providers.digitalreality.statCarriers")}</dt><dd>{carriers}</dd></div>
            </dl>
          )}
          <div className="dr-cols">
            <div className="dr-sol">
              {look === "early" && <h2>{t("providers.digitalreality.solutions")}</h2>}
              {[1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.digitalreality.sol${i}`)}</h3><p>{t(`providers.digitalreality.sol${i}Text`)}</p></div>)}
            </div>
            <div className="dr-markets">
              <h2>{t("providers.digitalreality.markets")}</h2>
              {sites.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go} className="dr-market"><small>{d.city}</small><strong>{d.name}</strong></A>)}
            </div>
          </div>
        </> : <div className="dr-body">
          <h1>{titleOf(route)}</h1>
          <Body {...props} />
        </div>}
      </main>
      <footer><span>{t("providers.digitalreality.footer", { year })}</span><span>{t("providers.terms")} | {t("providers.privacy")} | {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: DigitalReality, late: 2017 } satisfies Design;
