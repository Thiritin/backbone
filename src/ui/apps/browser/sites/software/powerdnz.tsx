import { t } from "../../../../../i18n/en";
import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./powerdnz.css";

// PowerDNZ: white and orange with a left nav in Verdana; 2016 turns it into a documentation site under a dark header.
export function PowerDNZ(props: SiteProps) {
  const { p, look, page, year } = props;
  const mark = <span className="sw-wm"><SiteMark id="powerdnz" name={p.name} size={look === "late" ? 22 : 30} /> PowerDNZ</span>;
  if (look === "late") {
    return (
      <div className="sw sw-powerdnz late">
        <header>{mark}<span className="ver">{t("browser-sites-2.powerdnzDocs", { version: `4.${year - 2016}` })}</span></header>
        <div className="docs">
          <aside>
            <h3>{t("browser-sites-2.gettingStarted")}</h3>
            <Nav {...props} labels={{ home: t("browser-sites-2.navOverview"), download: t("browser-sites-2.navInstalling") }} />
            <h3>{t("browser-sites-2.reference")}</h3>
            <p>{t("browser-sites-2.powerdnzRef1")}<br />{t("browser-sites-2.powerdnzRef2")}<br />DNSSEC<br />{t("browser-sites-2.powerdnzRef3")}</p>
          </aside>
          <main>
            <div className="crumbs">{t("browser-sites-2.powerdnzCrumb", { page: page === "home" ? t("browser-sites-2.navOverview") : t(`browser-sites-2.page_${page}`) })}</div>
            {page === "home" && <h1>{p.site.tagline}</h1>}
            <Body {...props} />
          </main>
        </div>
      </div>
    );
  }
  return (
    <div className="sw sw-powerdnz early">
      <header>{mark}<span className="tag">{p.site.tagline}</span></header>
      <div className="cols">
        <aside><Nav {...props} /><p className="news"><b>{t("browser-sites-2.news")}</b><br />{t("browser-sites-2.powerdnzNews", { version: `2.${year - 2004}` })}</p></aside>
        <main><Body {...props} /></main>
      </div>
      <footer>{t("browser-sites-2.powerdnzFooter", { year })}</footer>
    </div>
  );
}
