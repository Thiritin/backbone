import { t } from "../../../../../i18n/en";
import { Commands, Features, Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./knut.css";

const GETS = t("browser-sites-1.kn.gets");

// Knut DNS: a sober centred column with a red rule; 2020 adds a hero and feature cards.
export function KnutDns(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-knut ${look}`}>
      <header><span className="sw-wm"><SiteMark id="knut" name={p.name} size={look === "late" ? 26 : 34} /> Knut DNS</span><Nav {...props} /></header>
      {look === "late" && page === "home" && <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>}
      <main>
        {look === "early" && page === "home" && <h1>{p.site.tagline}</h1>}
        {page === "download"
          ? <section><h2>{t("browser-sites-1.kn.download")}</h2><p>{GETS}</p><Commands p={p} year={year} /></section>
          : look === "late" && page === "home" ? <Features p={p} className="cards" /> : <Body {...props} />}
      </main>
      <footer>{t("browser-sites-1.kn.footer", { version: `${look === "late" ? 3 : 1}.${year % 10}`, year })}</footer>
    </div>
  );
}
