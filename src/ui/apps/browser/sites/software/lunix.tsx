import { t } from "../../../../../i18n/en";
import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./lunix.css";

// Debiant: the left-nav project site; 2015 adds the red header band.
export function Lunix(props: SiteProps) {
  const { p, look, year } = props;
  return (
    <div className={`sw sw-lunix ${look}`}>
      <header><SiteMark id="lunix" name={p.name} size={40} /><span className="sw-wm">debiant</span><span className="sub">{p.site.tagline}</span></header>
      <div className="cols">
        <Nav {...props} className="side" labels={{ home: t("browser-sites-1.lu.about"), download: t("browser-sites-1.lu.getting"), pricing: t("browser-sites-1.lu.license") }} />
        <main>
          <h1>{props.page === "home" ? t("browser-sites-1.lu.h1") : p.name}</h1>
          <Body {...props} />
        </main>
      </div>
      <footer>{t("browser-sites-1.lu.footer", { year })}</footer>
    </div>
  );
}
