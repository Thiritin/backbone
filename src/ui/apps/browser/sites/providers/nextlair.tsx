import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, dcsOf, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./nextlair.css";

// Stacked chevrons, the late hero's picture of network layers.
const Layers = () => (
  <svg className="nl-layers" viewBox="0 0 200 200" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M30 ${150 - i * 34} 100 ${110 - i * 34} 170 ${150 - i * 34}`} strokeOpacity={1 - i * 0.22} />)}
  </svg>
);

// Next Lair: 2005 Viennese ISP with a grey band, dark tab bar and three columns with news and hotline; 2016 charcoal split hero with lime layers.
function NextLair(props: ProviderProps) {
  const { p, look, route, go, year } = props, city = dcsOf(p.id)[0].city, home = route.page === "home";
  const labels = { home: t("providers.nextlair.navHome"), sites: t("providers.nextlair.navSites"), order: t("providers.nextlair.navOrder"), account: t("providers.nextlair.navAccount") };
  const svc = <div className="nl-svc">{[1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.nextlair.svc${i}`)}</h3><p>{t(`providers.nextlair.svc${i}Text`)}</p></div>)}</div>;
  return (
    <div className={`ps ps-nextlair ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="nextlair" size={look === "early" ? 30 : 26} /><span>next<b>lair</b></span></A>
        {look === "early" && <span className="nl-tag">{t("providers.nextlair.tagline")}</span>}
        {look === "late" && <Nav route={route} go={go} labels={labels} />}
      </header>
      {look === "early" ? <>
        <Nav route={route} go={go} className="nl-bar" labels={labels} />
        <div className="nl-cols">
          <aside className="nl-news"><h3>{t("providers.nextlair.news")}</h3><p>{t("providers.nextlair.news1")}</p><p>{t("providers.nextlair.news2")}</p></aside>
          <main>
            {home ? <>
              <h1>{t("providers.nextlair.heroEarly")}</h1>
              <p>{t("providers.nextlair.text", { city })}</p>
              {svc}
              <h2>{labels.sites}</h2>
              <SitesList p={p} go={go} />
            </> : <><h1>{titleOf(route)}</h1><Body {...props} /></>}
          </main>
          <aside className="nl-hotline"><h3>{t("providers.nextlair.hotline")}</h3><p>{t("providers.nextlair.hotlineText")}</p><A to="/order" go={go} className="ps-btn pri">{t("providers.nextlair.cta")}</A></aside>
        </div>
      </> : <main>
        {home ? <>
          <section className="nl-hero">
            <div>
              <h1>{t("providers.nextlair.heroLate", { city })}</h1>
              <p>{t("providers.nextlair.text", { city })}</p>
              <A to="/order" go={go} className="ps-btn pri">{t("providers.nextlair.cta")}</A>
            </div>
            <Layers />
          </section>
          {svc}
        </> : <div className="nl-body"><h1>{titleOf(route)}</h1><Body {...props} /></div>}
      </main>}
      <footer>{t("providers.nextlair.footer", { year })} · {t("providers.imprint")} · {t("providers.terms")} · {t("providers.privacy")}</footer>
    </div>
  );
}

export default { view: NextLair, late: 2016 } satisfies Design;
