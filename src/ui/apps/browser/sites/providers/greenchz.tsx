import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { A, Body, dcsOf, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./greenchz.css";

const Cross = () => <svg className="gc-cross" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#da291c" /><path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#ffffff" /></svg>;

// Green.chz: 2005 glossy green band with pill tabs and rounded boxes; 2013 Swiss minimal, black type on white with a green accent and the flag.
function GreenChz(props: ProviderProps) {
  const { p, look, route, go, year } = props, sites = dcsOf(p.id), city = sites[0].city;
  const labels = { home: t("providers.greenchz.navHome"), sites: t("providers.greenchz.navSites"), order: t("providers.greenchz.navOrder"), account: t("providers.greenchz.navAccount") };
  const points = [1, 2, 3].map((i) => <div key={i}><h3>{t(`providers.greenchz.point${i}`)}</h3><p>{t(`providers.greenchz.point${i}Text`)}</p></div>);
  return (
    <div className={`ps ps-greenchz ${look}`}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider="greenchz" size={look === "early" ? 30 : 22} /><span>green<b>.chz</b></span></A>
        <Nav route={route} go={go} labels={labels} />
      </header>
      <main>
        {route.page === "home" ? (look === "early" ? <>
          <section className="gc-teaser"><h1>{t("providers.greenchz.heroEarly")}</h1><p>{t("providers.greenchz.text", { city })}</p><A to="/order" go={go} className="ps-btn pri">{t("providers.greenchz.cta")}</A></section>
          <div className="gc-boxes">{points}</div>
          <div className="gc-box"><h2>{labels.sites}</h2><SitesList p={p} go={go} /></div>
        </> : <>
          <section className="gc-hero">
            <Cross />
            <h1>{t("providers.greenchz.heroLate")}</h1>
            <p>{t("providers.greenchz.text", { city })}</p>
            <A to="/order" go={go} className="ps-btn pri">{t("providers.greenchz.cta")}</A>
          </section>
          <div className="gc-points">{points}</div>
          <div className="gc-sites">
            {sites.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go} className="gc-site"><span>{d.city}</span><strong>{d.name}</strong></A>)}
          </div>
        </>) : <div className="gc-body"><h1>{titleOf(route)}</h1><Body {...props} /></div>}
      </main>
      <footer>{t("providers.greenchz.footer", { year })} · {t("providers.imprint")} · {t("providers.terms")} · {t("providers.privacy")}</footer>
    </div>
  );
}

export default { view: GreenChz, late: 2013 } satisfies Design;
