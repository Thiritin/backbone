import { t } from "../../../../../i18n/en";
import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./proxmocks.css";

// Proxmocks: an orange and grey wiki with forum links; 2016 flattens it to a white hero with two blocks.
export function Proxmocks(props: SiteProps) {
  const { p, look, page, go, year } = props;
  const mark = <span className="sw-wm"><SiteMark id="proxmocks" name={p.name} size={28} /> PROXMOCKS</span>;
  if (look === "late") {
    return (
      <div className="sw sw-proxmocks late">
        <header>{mark}<Nav {...props} /></header>
        {page === "home" ? (
          <>
            <div className="hero"><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p></div>
            <div className="blocks">
              <Link to="download" go={go} className="block"><b>{t("browser-sites-2.proxInstallTitle")}</b><span>{t("browser-sites-2.proxInstallText")}</span></Link>
              <Link to="pricing" go={go} className="block"><b>{t("browser-sites-2.proxSubsTitle")}</b><span>{t("browser-sites-2.proxSubsText")}</span></Link>
            </div>
          </>
        ) : <main><Body {...props} /></main>}
        <footer>© {year} Proxmocks Server Solutions GmbH</footer>
      </div>
    );
  }
  return (
    <div className="sw sw-proxmocks early">
      <header>{mark}<span className="tag">{p.site.tagline}</span></header>
      <div className="cols">
        <aside>
          <h3>Proxmocks VE</h3>
          <Nav {...props} />
          <h3>{t("browser-sites-2.community")}</h3>
          <p>{t("browser-sites-2.proxForum")}<br />{t("browser-sites-2.proxLists")}<br />{t("browser-sites-2.proxBugs")}<br />Wiki</p>
        </aside>
        <main><h1>{t("browser-sites-2.proxTitle")}</h1><Body {...props} /></main>
      </div>
    </div>
  );
}
