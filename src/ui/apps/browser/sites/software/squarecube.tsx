import { t } from "../../../../../i18n/en";
import { versionAt } from "../../../../../sim/10-catalog/software-versions";
import { Commands, Docs, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { Releases } from "./Releases";
import "./squarecube.css";

// Squarecube: one look, the project page with a cube mark, a grey menu bar and the latest release on top.
export function SquarecubeSite(props: SiteProps) {
  const { p, page, year, hour } = props;
  return (
    <div className="sw sw-squarecube">
      <header><span className="mark" aria-hidden="true" /><span className="logo"><b>Square</b>cube</span><span className="slogan">{p.site.tagline}</span></header>
      <Nav {...props} labels={{ pricing: t("browser-sites-2.license") }} />
      <main>
        {page === "home" && (
          <>
            <p className="latest">{t("mailserver.sc.site.latest")}: <b>{versionAt(p.id, hour).version}</b></p>
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
      <footer>{t("mailserver.sc.site.copyright", { year })}</footer>
    </div>
  );
}
