import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { exchangeLabel } from "../../../locations/ui";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./corespite.css";

// CoreSpite: 2005 a white page with a grey gloss menu, green section heads and market boxes; 2014 a navy hero with a green call to action and one card per market.
function CoreSpite(props: ProviderProps) {
  const { p, look, route, go, year } = props, sites = dcsOf(p.id), cities = citiesOf(p.id);
  const labels = { sites: t("providers.corespite.navSites"), order: t("providers.corespite.navOrder"), account: t("providers.corespite.navPortal") };
  return (
    <div className={`ps ps-corespite ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="corespite" size={look === "early" ? 28 : 24} /><span>Core<b>Spite</b></span></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["sites", "order", "account"]} labels={labels} />
      </header>
      <main>
        {route.page === "home" ? <>
          <section className="csp-hero">
            <h1>{look === "early" ? t("providers.corespite.heroEarly") : t("providers.corespite.heroLate")}</h1>
            <p>{t("providers.corespite.text", { n: sites.length, cities: cities.join(", ") })}</p>
            <A to="/order" go={go} className="ps-btn pri">{t("providers.corespite.cta")}</A>
          </section>
          <h2 className="csp-head">{t("providers.corespite.markets")}</h2>
          <div className="csp-markets">
            {sites.map((d) => (
              <A key={d.id} to={`/sites/${d.id}`} go={go} className="csp-market">
                <strong>{d.city}</strong><span>{d.name}</span>
                <small>{t("providers.corespite.marketFacts", { carriers: d.carriers, exchange: exchangeLabel(d) })}</small>
              </A>
            ))}
          </div>
          <section className="csp-band">
            <h2>{t("providers.corespite.cloud")}</h2>
            <p>{t("providers.corespite.cloudText")}</p>
          </section>
        </> : <div className="csp-body">
          <h1>{titleOf(route)}</h1>
          <Body {...props} />
        </div>}
      </main>
      <footer><span>{t("providers.corespite.footer", { year })}</span><span>{t("providers.terms")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: CoreSpite, late: 2014 } satisfies Design;
