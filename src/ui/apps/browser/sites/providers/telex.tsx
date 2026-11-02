import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { Logo } from "../../../../art/logos";
import { exchangeLabel } from "../../../locations/ui";
import { A, Body, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./telex.css";

// Telex: 2005 a glossy slate header over a Manhattan skyline banner with three orange-headed boxes; 2012 a white page with a building card and a meet-me room counter.
function Telex(props: ProviderProps) {
  const { p, look, route, go, year } = props, dc = dcsOf(p.id)[0];
  const labels = { sites: t("providers.telex.navSites"), order: t("providers.telex.navOrder"), account: t("providers.telex.navPortal") };
  const boxes = [1, 2, 3].map((i) => <div key={i} className="tx-box"><h3>{t(`providers.telex.box${i}`)}</h3><p>{t(`providers.telex.box${i}Text`)}</p></div>);
  return (
    <div className={`ps ps-telex ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="telex" size={look === "early" ? 26 : 22} /><span>TELEX</span></A>
        <Nav route={route} go={go} labels={labels} />
      </header>
      <main>
        {route.page === "home" ? <>
          <section className="tx-hero">
            <h1>{look === "early" ? t("providers.telex.heroEarly") : t("providers.telex.heroLate")}</h1>
            <p>{t("providers.telex.text", { name: dc.name, city: dc.city })}</p>
            {look === "late" && <A to={`/sites/${dc.id}`} go={go} className="ps-btn pri">{t("providers.telex.cta")}</A>}
          </section>
          {look === "early" ? <div className="tx-boxes">{boxes}</div> : (
            <div className="tx-card">
              <div><small>{dc.city}</small><h2>{dc.name}</h2><p>{t("providers.telex.cardText", { exchange: exchangeLabel(dc) })}</p></div>
              <dl>
                <div><dt>{t("providers.telex.counter")}</dt><dd>{dc.carriers}</dd></div>
                <div><dt>{t("providers.crossConnect")}</dt><dd>{euro(dc.crossConnect)}</dd></div>
              </dl>
            </div>
          )}
          {look === "early" && <p className="tx-more"><A to={`/sites/${dc.id}`} go={go}>{t("providers.telex.cta")}</A></p>}
        </> : <div className="tx-body">
          <h1>{titleOf(route)}</h1>
          <Body {...props} />
        </div>}
      </main>
      <footer><span>{t("providers.telex.footer", { year })}</span><span>{t("providers.terms")} | {t("providers.privacy")} | {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Telex, late: 2012 } satisfies Design;
