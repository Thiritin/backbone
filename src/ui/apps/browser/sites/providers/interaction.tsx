import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./interaction.css";

const COMMUNITIES = ["providers.interaction.com1", "providers.interaction.com2", "providers.interaction.com3", "providers.interaction.com4"] as const;

// Interaction: 2005 white page with a purple bar, a gradient banner and data centres grouped by city; 2012 deep purple hero, community tiles and a stats band.
function Interaction(props: ProviderProps) {
  const { p, look, route, go, year } = props, dcs = dcsOf(p.id), cities = citiesOf(p.id);
  const labels = { sites: t("providers.interaction.navSites"), order: t("providers.interaction.navColo"), account: t("providers.interaction.navPortal") };
  const stats: [number, string][] = [[dcs.length, t("providers.interaction.statSites")], [cities.length, t("providers.interaction.statCities")], [dcs.reduce((s, d) => s + d.carriers, 0), t("providers.interaction.statCarriers")]];
  return (
    <div className={`ps ps-interaction ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="interaction" size={look === "early" ? 26 : 22} /><span>inter<b>action</b></span></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["sites", "order", "account"]} labels={labels} />
      </header>
      {route.page === "home" ? (look === "early" ? <main>
        <section className="ix-banner"><h1>{t("providers.interaction.heroEarly")}</h1><p>{t("providers.interaction.text", { n: dcs.length, cities: cities.length })}</p></section>
        <div className="ix-cols">
          <div>
            <h2>{t("providers.interaction.navSites")}</h2>
            {cities.map((c) => <div key={c} className="ix-city"><h3>{c}</h3>{dcs.filter((d) => d.city === c).map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}>{d.name}</A>)}</div>)}
          </div>
          <aside>
            <h2>{t("providers.interaction.communities")}</h2>
            <ul>{COMMUNITIES.map((k) => <li key={k}>{t(k)}</li>)}</ul>
            <A to="/order" go={go} className="ps-btn pri">{t("providers.interaction.cta")}</A>
          </aside>
        </div>
      </main> : <main>
        <section className="ix-hero">
          <h1>{t("providers.interaction.heroLate")}</h1>
          <p>{t("providers.interaction.text", { n: dcs.length, cities: cities.length })}</p>
          <A to="/sites" go={go} className="ps-btn pri">{t("providers.interaction.cta")}</A>
        </section>
        <div className="ix-tiles">{COMMUNITIES.map((k) => <A key={k} to="/sites" go={go}>{t(k)}</A>)}</div>
        <div className="ix-stats">{stats.map(([v, k]) => <div key={k}><strong>{v}</strong><span>{k}</span></div>)}</div>
      </main>) : <main className="ix-page">
        <h1 className="ix-title">{titleOf(route)}</h1>
        <Body {...props} />
      </main>}
      <footer><span>{t("providers.interaction.footer", { year })}</span><span>{t("providers.legal")} | {t("providers.privacy")} | {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Interaction, late: 2012 } satisfies Design;
