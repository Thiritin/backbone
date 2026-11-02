import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { Logo } from "../../../../art/logos";
import { A, Body, dcsOf, fromPrice, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./spree.css";

// Building heights for the late hero's Berlin skyline; the TV tower stands in the gap at x 1175.
const ROOFS = [28, 42, 22, 50, 30, 36, 56, 24, 40, 70, 34, 44, 26, 52, 38, 30, 48, 46, 36, 58, 28, 42, 32, 0, 24, 38, 54, 30, 40, 26, 44, 34];
const roofs = ROOFS.map((h, i) => `H${i * 50}V${110 - h}`).join("") + "H1600";
const Skyline = () => (
  <svg className="sp-skyline" viewBox="0 0 1600 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path d={`M0 110V${110 - ROOFS[0]}${roofs}V110z`} />
    <path d="M1172 110V52h6v58zM1174 52V2h2v50z" />
    <circle cx="1175" cy="44" r="11" /><rect x="1169" y="56" width="12" height="4" />
  </svg>
);

// Spree Colo: 2005 small Berlin shop, a centred box with a teal banner, square-bullet menu and news box; 2014 navy bar, teal hero over the skyline.
function Spree(props: ProviderProps) {
  const { p, look, route, go, year } = props, price = euro(fromPrice(p.id)), city = dcsOf(p.id)[0].city;
  const labels = { home: t("providers.spree.navHome"), sites: t("providers.spree.navSites"), order: t("providers.spree.navOrder"), account: t("providers.spree.navAccount") };
  const wm = <A to="/" go={go} className="ps-wm"><Logo provider="spree" size={look === "early" ? 34 : 24} /><span>Spree<b>Colo</b></span></A>;
  if (look === "early") return (
    <div className={`ps ps-spree ${look}`}>
      <div className="sp-page">
        <header>{wm}<span className="sp-tag">{t("providers.spree.tagline", { city })}</span></header>
        <div className="sp-frame">
          <aside>
            <Nav route={route} go={go} labels={labels} />
            <div className="sp-box"><h3>{t("providers.spree.news")}</h3><p>{t("providers.spree.news1")}</p><p>{t("providers.spree.news2")}</p></div>
          </aside>
          <main>
            {route.page === "home" ? <>
              <h2>{t("providers.spree.heroEarly")}</h2>
              <p>{t("providers.spree.textEarly")}</p>
              <p className="sp-from">{t("providers.spree.from", { price })}</p>
              <SitesList p={p} go={go} />
            </> : <><h2>{titleOf(route)}</h2><Body {...props} /></>}
          </main>
        </div>
        <footer>{t("providers.spree.footer", { year })} · {t("providers.imprint")} · {t("providers.terms")}</footer>
      </div>
    </div>
  );
  return (
    <div className={`ps ps-spree ${look}`}>
      <header>{wm}<Nav route={route} go={go} labels={labels} /></header>
      {route.page === "home" ? <main>
        <section className="sp-hero">
          <h1>{t("providers.spree.heroLate", { city })}</h1>
          <p>{t("providers.spree.textLate")}</p>
          <p className="sp-from">{t("providers.spree.from", { price })}</p>
          <A to="/order" go={go} className="ps-btn pri">{labels.order}</A>
          <Skyline />
        </section>
        <div className="sp-feats">{[1, 2, 3].map((i) => <div key={i}><span>{i}</span><h3>{t(`providers.spree.feat${i}`)}</h3><p>{t(`providers.spree.feat${i}Text`)}</p></div>)}</div>
      </main> : <main className="sp-body"><h1>{titleOf(route)}</h1><Body {...props} /></main>}
      <footer>{t("providers.spree.footer", { year })} · {t("providers.imprint")} · {t("providers.terms")} · {t("providers.privacy")}</footer>
    </div>
  );
}

export default { view: Spree, late: 2014 } satisfies Design;
