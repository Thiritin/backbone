import { t } from "../../../../../i18n/en";
import { DEVEL, releasedAt, versionAt } from "../../../../../sim/10-catalog/software-versions";
import { Commands, Docs, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { Releases } from "./Releases";
import "./squirrelmeal.css";

// SquirrelMeal: one look, the project page with a blue menu column and the latest releases on top.
export function SquirrelMealSite(props: SiteProps) {
  const { p, page, year, hour } = props;
  const stable = versionAt(p.id, hour), devel = releasedAt(p.id, hour).filter((v) => v.name === DEVEL).at(-1);
  return (
    <div className="sw sw-squirrelmeal">
      <header><span className="logo"><b>Squirrel</b>Meal</span><span className="slogan">{t("mailserver.site.slogan")}</span></header>
      <div className="cols">
        <Nav {...props} labels={{ pricing: t("browser-sites-2.license") }} />
        <main>
          {page === "home" && (
            <>
              <table className="latest"><tbody>
                <tr><th>{t("mailserver.site.stable")}</th><td>{stable.version}</td></tr>
                {devel && <tr><th>{t("mailserver.site.devel")}</th><td>{devel.version}</td></tr>}
              </tbody></table>
              <p>{p.site.blurb}</p>
              <Features p={p} />
            </>
          )}
          {page === "features" && <><h2>{t("browser-sites-2.navFeatures")}</h2><Features p={p} /></>}
          {page === "pricing" && <><h2>{t("browser-sites-2.license")}</h2><Pricing p={p} /></>}
          {page === "download" && <><h2>{t("browser-sites-2.navDownload")}</h2><Commands p={p} year={year} /></>}
          {(page === "versions" || page === "news") && <><h2>{t(page === "news" ? "releases.navNews" : "releases.navVersions")}</h2><Releases p={p} page={page} hour={hour} /></>}
          {page === "docs" && <><h2>{t("browser-sites-2.navDocs")}</h2><Docs p={p} /></>}
        </main>
      </div>
      <footer>{t("mailserver.site.copyright", { year })}</footer>
    </div>
  );
}

// Postfixit Admin: a project page on a code forge, grey until 2016 and a plain readme after.
export function PostfixitAdminSite(props: SiteProps) {
  const { p, page, year, hour, look } = props;
  return (
    <div className="sw sw-postfixitadmin" data-look={look}>
      <header><span className="logo">{t("mailserver.pfa.title")}</span><Nav {...props} labels={{ pricing: t("browser-sites-2.license") }} /></header>
      <main>
        {page === "home" && <><p className="latest">{t("mailserver.site.pfaLatest", { version: versionAt(p.id, hour).version })}</p><p>{p.site.blurb}</p><Features p={p} /></>}
        {page === "features" && <><h2>{t("browser-sites-2.navFeatures")}</h2><Features p={p} /></>}
          {page === "pricing" && <><h2>{t("browser-sites-2.license")}</h2><Pricing p={p} /></>}
        {page === "download" && <><h2>{t("browser-sites-2.navDownload")}</h2><Commands p={p} year={year} /></>}
        {(page === "versions" || page === "news") && <><h2>{t(page === "news" ? "releases.navNews" : "releases.navVersions")}</h2><Releases p={p} page={page} hour={hour} /></>}
        {page === "docs" && <><h2>{t("browser-sites-2.navDocs")}</h2><Docs p={p} /></>}
      </main>
    </div>
  );
}
