import { t } from "../../../../../i18n/en";
import { Body, Features, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./openstash.css";

// OpenStash: a white page with the big Get started button; 2017 turns it into a dark hero with cards.
export function OpenStash(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-openstash ${look}`}>
      <header><span className="sw-wm"><SiteMark id="openstash" name={p.name} size={26} /> openstash</span><Nav {...props} labels={{ download: t("browser-sites-1.os.getStarted") }} /></header>
      {page === "home" ? (
        <>
          <div className="hero">
            <h1>{p.site.tagline}</h1>
            <p>{p.site.blurb}</p>
            <Link to="download" go={go} className="go">{t("browser-sites-1.os.getStarted")}</Link>
          </div>
          {look === "late" ? <Features p={p} className="cards" /> : <Features p={p} className="list" />}
        </>
      ) : <main><Body {...props} /></main>}
      <footer>{t("browser-sites-1.os.footer", { year })}</footer>
    </div>
  );
}
