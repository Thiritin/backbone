import { t } from "../../../../../i18n/en";
import { Body, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./pleskit.css";

// Pleskit: navy header on a light blue page with a boxed news column; from 2015 white cards with purple accents.
export function Pleskit(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-pleskit ${look}`}>
      <header><span className="sw-wm"><SiteMark id="pleskit" name={p.name} size={28} color={look === "late" ? "#52307c" : undefined} /> Pleskit</span><Nav {...props} /></header>
      {look === "late" && page === "home" ? (
        <>
          <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>
          <Features p={p} className="cards" />
        </>
      ) : (
        <div className="cols">
          <main>{page === "home" && <h1>{p.site.tagline}</h1>}<Body {...props} /></main>
          {look === "early" && (
            <aside>
              <h3>{t("browser-sites-1.pk.news")}</h3>
              <p><b>{year}-03-01</b> {t("browser-sites-1.pk.news1", { version: `${year - 1997}.0` })}</p>
              <p><b>{year}-01-15</b> {t("browser-sites-1.pk.news2")}</p>
            </aside>
          )}
        </div>
      )}
      <footer>{t("browser-sites-1.pk.footer", { year })}</footer>
    </div>
  );
}
