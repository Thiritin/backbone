import { t } from "../../../../../i18n/en";
import { Commands, Docs, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./wireguarded.css";

// WireGuarded: one look, a manual page in monospace under a small red mark.
export function WireGuarded(props: SiteProps) {
  const { p, page, year } = props;
  return (
    <div className="sw sw-wireguarded">
      <header><span className="sw-wm"><SiteMark id="wireguarded" name={p.name} size={30} /> WireGuarded</span><Nav {...props} /></header>
      <main>
        <div className="man"><span>WG(8)</span><span>WireGuarded</span><span>WG(8)</span></div>
        {page === "home" && <><h2>{t("browser-sites-2.wgName")}</h2><p>{t("browser-sites-2.wgNameText")}</p><h2>{t("browser-sites-2.wgDescription")}</h2><p>{p.site.blurb}</p></>}
        {(page === "home" || page === "features") && <><h2>{t("browser-sites-2.wgFeatures")}</h2><Features p={p} /></>}
        {page === "pricing" && <><h2>{t("browser-sites-2.wgLicense")}</h2><Pricing p={p} /></>}
        {page === "docs" && <><h2>{t("browser-sites-2.navDocs")}</h2><Docs p={p} /></>}
        {page === "download" && <><h2>{t("browser-sites-2.wgInstallation")}</h2><p>{t("browser-sites-2.wgAfterInstall")}</p><Commands p={p} year={year} /></>}
        <h2>{t("browser-sites-2.wgSeeAlso")}</h2><p>wg(8), wg-quick(8), ip(8)</p>
        <div className="man"><span>WireGuarded {year}</span><span /><span>WG(8)</span></div>
      </main>
    </div>
  );
}
