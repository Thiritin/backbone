import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./equinox.css";

// Equinox: 2005 white and grey with a red wordmark, a tab bar and a city column; 2014 black bar, dark hero, red accents.
function Equinox(props: ProviderProps) {
  const { p, look, route, go, year } = props, cities = citiesOf(p.id), n = dcsOf(p.id).length;
  const home = route.page === "home";
  return (
    <div className={`ps ps-equinox ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="equinox" size={look === "early" ? 22 : 18} /><span>EQUI<b>NOX</b></span></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["sites", "order", "account"]} labels={{ sites: t("providers.equinox.navSites"), order: t("providers.equinox.navColo"), account: t("providers.equinox.navPortal") }} />
      </header>
      <div className="eq-frame">
        {look === "early" && (
          <aside>
            <h3>{t("providers.equinox.ibx")}</h3>
            <ul>{dcsOf(p.id).map((d) => <li key={d.id}><A to={`/sites/${d.id}`} go={go}>{d.name}</A></li>)}</ul>
          </aside>
        )}
        <main>
          {home ? <>
            <section className="eq-hero">
              <h1>{look === "early" ? t("providers.equinox.heroEarly") : t("providers.equinox.heroLate")}</h1>
              <p>{t("providers.equinox.text", { n, cities: cities.length })}</p>
              <A to="/sites" go={go} className="ps-btn pri">{t("providers.equinox.cta")}</A>
            </section>
            <div className="eq-cols">
              {[1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.equinox.col${i}`)}</h3><p>{t(`providers.equinox.col${i}Text`)}</p></div>)}
            </div>
            {look === "early" && <><h2>{t("providers.equinox.navSites")}</h2><SitesList p={p} go={go} /></>}
          </> : <div className="eq-body">
            <h2 className="eq-title">{titleOf(route)}</h2>
            <Body {...props} />
          </div>}
        </main>
      </div>
      <footer><span>{t("providers.equinox.footer", { year })}</span><span>{t("providers.legal")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Equinox, late: 2014 } satisfies Design;
