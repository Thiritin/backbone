import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, citiesOf, dcsOf, Nav, sectionTitle, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./ntd.css";

// NTD: 2005 Japanese corporate blue with utility links, tab bar, breadcrumb and a local menu; 2019 black, a blue gradient rule and campus tiles.
function Ntd(props: ProviderProps) {
  const { p, look, route, go, year } = props, sites = dcsOf(p.id), home = route.page === "home";
  const labels = { sites: t("providers.ntd.navSites"), order: t("providers.ntd.navOrder"), account: t("providers.ntd.navAccount") };
  const text = t("providers.ntd.text", { n: sites.length, cities: citiesOf(p.id).length });
  return (
    <div className={`ps ps-ntd ${look}`}>
      {look === "early" && <div className="nt-util"><span>{t("providers.ntd.global")}</span><span>{t("providers.ntd.sitemap")}</span><span>{t("providers.contactUs")}</span></div>}
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="ntd" size={look === "early" ? 26 : 22} /><span>NTD</span><small>{t("providers.ntd.division")}</small></A>
        <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["sites", "order", "account"]} labels={labels} />
      </header>
      {look === "early" ? <>
        <div className="nt-crumb"><A to="/" go={go}>{sectionTitle("home")}</A>{!home && <> &gt; <span>{titleOf(route)}</span></>}</div>
        <div className="nt-frame">
          <aside>
            <h3>{labels.sites}</h3>
            <ul>{sites.map((d) => <li key={d.id}><A to={`/sites/${d.id}`} go={go}>{d.name}</A></li>)}</ul>
            <h3>{labels.order}</h3>
            <ul><li><A to="/order" go={go}>{t("providers.ntd.cta")}</A></li></ul>
          </aside>
          <main>
            {home ? <>
              <section className="nt-visual"><h1>{t("providers.ntd.heroEarly")}</h1><p>{text}</p></section>
              <h2>{t("providers.ntd.news")}</h2>
              <ul className="nt-news">{[1, 2, 3].map((i) => <li key={i}><time>{year}</time><span>{t(`providers.ntd.news${i}`)}</span></li>)}</ul>
              <h2>{t("providers.ntd.services")}</h2>
              <div className="nt-svc">{[1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.ntd.svc${i}`)}</h3><p>{t(`providers.ntd.svc${i}Text`)}</p></div>)}</div>
            </> : <><h1 className="nt-title">{titleOf(route)}</h1><Body {...props} /></>}
          </main>
        </div>
      </> : <main>
        {home ? <>
          <section className="nt-hero">
            <p className="nt-kicker">{t("providers.ntd.division")}</p>
            <h1>{t("providers.ntd.heroLate")}</h1>
            <p>{text}</p>
            <A to="/sites" go={go} className="ps-btn pri">{t("providers.ntd.cta")}</A>
          </section>
          <div className="nt-tiles">
            {sites.map((d) => (
              <A key={d.id} to={`/sites/${d.id}`} go={go} className="nt-tile">
                <span>{d.city}</span><strong>{d.name}</strong><em>{t("providers.ntd.explore")}</em>
              </A>
            ))}
          </div>
          <div className="nt-svc">{[1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.ntd.svc${i}`)}</h3><p>{t(`providers.ntd.svc${i}Text`)}</p></div>)}</div>
        </> : <div className="nt-body"><h1 className="nt-title">{titleOf(route)}</h1><Body {...props} /></div>}
      </main>}
      <footer><span>{t("providers.ntd.footer", { year })}</span><span>{t("providers.terms")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
    </div>
  );
}

export default { view: Ntd, late: 2019 } satisfies Design;
