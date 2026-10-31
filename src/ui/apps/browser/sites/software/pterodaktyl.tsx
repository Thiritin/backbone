import { t } from "../../../../../i18n/en";
import { Body, Commands, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./pterodaktyl.css";

// Pterodaktyl: a dark blue landing page with a terminal block; from 2021 a white docs site.
export function Pterodaktyl(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const wm = <span className="sw-wm"><SiteMark id="pterodaktyl" name={p.name} size={26} /> Pterodaktyl</span>;
  if (look === "late") {
    return (
      <div className="sw sw-pterodaktyl late">
        <header>{wm}<span className="ver">v1.{year - 2020}</span></header>
        <div className="cols">
          <aside><h3>{t("browser-sites-2.gettingStarted")}</h3><Nav {...props} labels={{ home: t("browser-sites-2.navIntroduction"), download: t("browser-sites-2.navInstallation") }} /></aside>
          <main>{page === "home" && <h1>{p.site.tagline}</h1>}<Body {...props} /></main>
        </div>
      </div>
    );
  }
  return (
    <div className="sw sw-pterodaktyl early">
      <header>{wm}<Nav {...props} /></header>
      {page === "home" ? (
        <div className="hero">
          <h1>{p.site.tagline}</h1>
          <p>{p.site.blurb}</p>
          <Commands p={p} year={year} />
          <Link to="features" go={go} className="sws-cta">{t("browser-sites-2.pteroRead")}</Link>
        </div>
      ) : <main><Body {...props} /></main>}
    </div>
  );
}
