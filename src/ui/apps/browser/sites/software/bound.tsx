import { t } from "../../../../../i18n/en";
import { Body, Commands, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./bound.css";

const GETS = t("browser-sites-1.bo.gets");

// Bound: a dense blue and white page in Times with a release column; 2019 keeps the blue and lays features out in cards.
export function Bound(props: SiteProps) {
  const { p, look, page, year } = props;
  const body = page === "download"
    ? <section><h2>{t("browser-sites-1.bo.download")}</h2><p>{GETS}</p><Commands p={p} year={year} /></section>
    : look === "late" && page === "home" ? <Features p={p} className="cards" /> : <Body {...props} />;
  return (
    <div className={`sw sw-bound ${look}`}>
      {look === "early" && <div className="org">{t("browser-sites-1.bo.org")}</div>}
      <header><span className="sw-wm"><SiteMark id="bound" name={p.name} size={look === "late" ? 26 : 20} /> Bound 9</span><Nav {...props} /></header>
      {look === "late" && page === "home" && <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>}
      <div className="cols">
        <main>{look === "early" && page === "home" && <h1>{p.site.tagline}</h1>}{body}</main>
        {look === "early" && (
          <aside>
            <h3>{t("browser-sites-1.bo.releases")}</h3>
            <p>{t("browser-sites-1.bo.stable", { v: `9.${year - 2002}.2` })}<br />{t("browser-sites-1.bo.beta", { v: `9.${year - 2001}.0` })}</p>
            <h3>{t("browser-sites-1.bo.advisories")}</h3>
            <p>{t("browser-sites-1.bo.advisoriesText")}</p>
          </aside>
        )}
      </div>
      <footer>{t("browser-sites-1.bo.footer", { year })}</footer>
    </div>
  );
}
