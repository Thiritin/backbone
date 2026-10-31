import { t } from "../../../../../i18n/en";
import { Commands, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import "./postfixit.css";

// Postfixit: one look, the plain home page of a mailing-list project with Courier headings.
export function Postfixit(props: SiteProps) {
  const { p, page, year } = props;
  return (
    <div className="sw sw-postfixit">
      <table className="top"><tbody><tr><td><h1>{t("browser-sites-2.postfixitTitle")}</h1></td><td className="mirror">{t("browser-sites-2.postfixitMirror")}</td></tr></tbody></table>
      <Nav {...props} labels={{ home: t("browser-sites-2.navOverview"), pricing: t("browser-sites-2.license") }} />
      {page === "home" && (
        <>
          <p>{p.site.blurb}</p>
          <h2>{t("browser-sites-2.postfixitLists")}</h2>
          <p>{t("browser-sites-2.postfixitListsText")}</p>
          <h2>{t("browser-sites-2.postfixitLatest")}</h2>
          <p>{t("browser-sites-2.postfixitStable", { version: `2.${year - 2003}.${year % 7}`, year })}</p>
        </>
      )}
      {page === "features" && <><h2>{t("browser-sites-2.navFeatures")}</h2><Features p={p} /></>}
      {page === "pricing" && <><h2>{t("browser-sites-2.license")}</h2><Pricing p={p} /></>}
      {page === "download" && <><h2>{t("browser-sites-2.navDownload")}</h2><p>{t("browser-sites-2.postfixitAfterInstall")}</p><Commands p={p} year={year} /></>}
      <address>{t("browser-sites-2.postfixitChanged", { year })}</address>
    </div>
  );
}
