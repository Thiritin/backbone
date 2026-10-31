import { t } from "../../../../../i18n/en";
import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./cpanic.css";

const ICONS = [t("browser-sites-1.cp.icon0"), t("browser-sites-1.cp.icon1"), t("browser-sites-1.cp.icon2"), t("browser-sites-1.cp.icon3"), t("browser-sites-1.cp.icon4"), t("browser-sites-1.cp.icon5"), t("browser-sites-1.cp.icon6"), t("browser-sites-1.cp.icon7")];

// cPanic: the dark blue 2005 site with the grey side nav; from 2014 a flat hero with a code-drawn panel screenshot.
export function Cpanic(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const wm = <span className="sw-wm"><SiteMark id="cpanic" name={p.name} size={30} /><span>c<b>Panic</b></span></span>;
  if (look === "late") {
    return (
      <div className="sw sw-cpanic late">
        <header>{wm}<Nav {...props} /><Link to="pricing" go={go} className="buy">{t("browser-sites-1.cp.buy")}</Link></header>
        {page === "home" ? (
          <div className="hero">
            <div>
              <h1>{p.site.tagline}</h1>
              <p>{p.site.blurb}</p>
              <Link to="download" go={go} className="sws-cta">{t("browser-sites-1.cp.try")}</Link>
            </div>
            <div className="shot" aria-hidden>
              <div className="bar" />
              {ICONS.map((x) => <div key={x} className="ico"><i />{x}</div>)}
            </div>
          </div>
        ) : null}
        <main><Body {...props} /></main>
        <footer>{t("browser-sites-1.cp.footerLate", { year })}</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-cpanic early">
      <header>{wm}<span className="tag">{t("browser-sites-1.cp.tag", { tagline: p.site.tagline })}</span></header>
      <div className="cols">
        <Nav {...props} className="side" labels={{ download: t("browser-sites-1.cp.install"), pricing: t("browser-sites-1.cp.licensing") }} />
        <main><h1>{page === "home" ? t("browser-sites-1.cp.welcome") : p.name}</h1><Body {...props} /></main>
      </div>
      <footer>{t("browser-sites-1.cp.footerEarly", { year })}</footer>
    </div>
  );
}
