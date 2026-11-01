import { t } from "../../../../../i18n/en";
import { Body, Commands, Docs, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./directadmen.css";

// DirectAdmen: a plain page last touched in 2003; from 2018 one dark page that scrolls through everything.
export function DirectAdmen(props: SiteProps) {
  const { p, look, year } = props;
  if (look === "late") {
    return (
      <div className="sw sw-directadmen late">
        <header><span className="sw-wm"><SiteMark id="directadmen" name={p.name} size={26} /> DirectAdmen</span><Nav {...props} /></header>
        <div className="hero"><h1>{t("browser-sites-1.da.tagLate", { tagline: p.site.tagline })}</h1><p>{p.site.blurb}</p></div>
        <section><h2>{t("browser-sites-1.da.features")}</h2><Features p={p} className="grid" /></section>
        <section><h2>{t("browser-sites-1.da.pricing")}</h2><Pricing p={p} /></section>
        <section><h2>{t("browser-sites-1.da.install")}</h2><Commands p={p} year={year} /></section>
        <section><h2>{t("browser-sites-2.navDocs")}</h2><Docs p={p} /></section>
        <footer>{t("browser-sites-1.da.footer", { year })}</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-directadmen early">
      <h1><SiteMark id="directadmen" name={p.name} size={20} /> {t("browser-sites-1.da.title")}</h1>
      <Nav {...props} className="links" />
      <hr />
      {props.page === "home" && <p><i>{t("browser-sites-1.da.tagEarly", { tagline: p.site.tagline })}</i></p>}
      <Body {...props} />
      <hr />
      <p className="upd">{t("browser-sites-1.da.updated")}</p>
    </div>
  );
}
