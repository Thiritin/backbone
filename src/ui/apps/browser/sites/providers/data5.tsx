import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./data5.css";

// Data5: 2006 corporate blue with a dark nav bar and campus boxes; 2017 white bar, navy hero, cyan key figures and campus cards.
function Data5(props: ProviderProps) {
  const { p, look, route, go, year } = props, sites = dcsOf(p.id);
  const labels = { home: t("providers.data5.navHome"), sites: t("providers.data5.navSites"), order: t("providers.data5.navOrder"), account: t("providers.data5.navAccount") };
  const figures: [number, string][] = [
    [sites.length, t("providers.data5.figSites")],
    [sites.reduce((s, d) => s + d.carriers, 0), t("providers.data5.figCarriers")],
    [citiesOf(p.id).length, t("providers.data5.figCities")],
  ];
  return (
    <div className={`ps ps-data5 ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="data5" size={look === "early" ? 30 : 24} /><span>DATA<b>5</b></span></A>
        {look === "late" && <Nav route={route} go={go} items={["sites", "order", "account"]} labels={labels} />}
        {look === "late" && <A to="/order" go={go} className="ps-btn pri d5-quote">{t("providers.data5.quote")}</A>}
      </header>
      {look === "early" && <Nav route={route} go={go} className="d5-bar" labels={labels} />}
      <main>
        {route.page === "home" ? <>
          <section className="d5-hero">
            <h1>{look === "early" ? t("providers.data5.heroEarly") : t("providers.data5.heroLate")}</h1>
            <p>{t("providers.data5.text", { n: sites.length, cities: citiesOf(p.id).join(", ") })}</p>
            <A to="/sites" go={go} className="ps-btn pri">{t("providers.data5.cta")}</A>
          </section>
          <dl className="d5-figures">{figures.map(([n, k]) => <div key={k}><dt>{k}</dt><dd>{n.toLocaleString(LOCALE)}</dd></div>)}</dl>
          <h2>{t("providers.data5.campuses")}</h2>
          <div className="d5-campuses">
            {sites.map((d) => (
              <A key={d.id} to={`/sites/${d.id}`} go={go} className="d5-campus">
                <span className="d5-city">{d.city}</span><strong>{d.name}</strong><span>{t("providers.data5.carriers", { n: d.carriers })}</span>
              </A>
            ))}
          </div>
        </> : <div className="d5-body">
          <h1 className="d5-title">{titleOf(route)}</h1>
          <Body {...props} />
        </div>}
      </main>
      <footer><span>{t("providers.data5.footer", { year })}</span><span>{t("providers.legal")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Data5, late: 2017 } satisfies Design;
