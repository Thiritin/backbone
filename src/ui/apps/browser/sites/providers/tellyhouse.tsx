import { t } from "../../../../../i18n/en";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./tellyhouse.css";

// Spaced capitals over a red rule, the company wordmark.
const Mark = () => <span className="th-mark"><span>TELLYHOUSE</span><i /></span>;

// Tellyhouse: 2005 a navy-banded three-column portal with bevelled side buttons and quick-link boxes; 2016 white corporate site with a grey utility bar, campus cards and a stats strip.
function Tellyhouse(props: ProviderProps) {
  const { p, look, route, go, year } = props, dcs = dcsOf(p.id), cities = citiesOf(p.id);
  const carriers = dcs.reduce((s, d) => s + d.carriers, 0), exchanges = new Set(dcs.map((d) => d.exchange).filter(Boolean)).size;
  const labels = { sites: t("providers.tellyhouse.navSites"), order: t("providers.tellyhouse.navColo"), account: t("providers.tellyhouse.navPortal") };
  const home = route.page === "home", text = t("providers.tellyhouse.text", { n: dcs.length, cities: cities.join(", "), carriers });
  if (look === "early") return (
    <div className="ps ps-tellyhouse early">
      <header><A to="/" go={go} className="ps-wm"><Mark /></A><span className="th-tag">{t("providers.tellyhouse.tagline")}</span></header>
      <div className={`th-frame ${route.page === "account" ? "th-wide" : ""}`}>
        <Nav route={route} go={go} className="th-side" labels={labels} />
        <main>
          {home ? <>
            <h1>{t("providers.tellyhouse.welcome")}</h1>
            <p>{text}</p>
            <h2>{t("providers.tellyhouse.campuses")}</h2>
            <ul>{dcs.map((d) => <li key={d.id}><A to={`/sites/${d.id}`} go={go}>{d.name}</A>, {d.city}</li>)}</ul>
          </> : <><h1>{titleOf(route)}</h1><Body {...props} /></>}
        </main>
        {route.page !== "account" && <aside>
          <div className="th-box"><h3>{t("providers.tellyhouse.quick")}</h3><Nav route={route} go={go} items={["sites", "order", "account"]} labels={labels} /></div>
          <div className="th-box"><h3>{t("providers.tellyhouse.contactBox")}</h3><p>{t("providers.tellyhouse.contactText")}</p></div>
        </aside>}
      </div>
      <footer>{t("providers.tellyhouse.footer", { year })} | {t("providers.legal")} | {t("providers.privacy")}</footer>
    </div>
  );
  return (
    <div className="ps ps-tellyhouse late">
      <div className="th-util"><Nav route={route} go={go} items={["account"]} labels={labels} /><span>{t("providers.contactUs")}</span></div>
      <header><A to="/" go={go} className="ps-wm"><Mark /></A><Nav route={route} go={go} items={["sites", "order"]} labels={labels} /></header>
      {home ? <main>
        <section className="th-hero">
          <h1>{t("providers.tellyhouse.heroLate")}</h1>
          <p>{text}</p>
          <A to="/order" go={go} className="ps-btn pri">{t("providers.tellyhouse.cta")}</A>
        </section>
        <div className="th-stats">
          <div><strong>{dcs.length}</strong><span>{t("providers.tellyhouse.navSites")}</span></div>
          <div><strong>{carriers}</strong><span>{t("providers.tellyhouse.statCarriers")}</span></div>
          <div><strong>{exchanges}</strong><span>{t("providers.tellyhouse.statExchanges")}</span></div>
        </div>
        <h2 className="th-head">{t("providers.tellyhouse.campuses")}</h2>
        <div className="th-cards">{dcs.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}><span>{d.city}</span><strong>{d.name}</strong><small>{t("providers.tellyhouse.view")}</small></A>)}</div>
      </main> : <main className="th-page"><h1>{titleOf(route)}</h1><Body {...props} /></main>}
      <footer><Mark /><span>{t("providers.tellyhouse.footer", { year })}</span><span>{t("providers.legal")} | {t("providers.privacy")}</span></footer>
    </div>
  );
}

export default { view: Tellyhouse, late: 2016 } satisfies Design;
