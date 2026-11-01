import { t } from "../../../../../i18n/en";
import { Commands, Docs, Features, Nav, Pricing, type SiteProps } from "./SoftwareSite";
import "./vsftpeed.css";

// vsFTPeed: one bare Courier page with a changelog that has never been redesigned.
export function VsFTPeed(props: SiteProps) {
  const { p, page, year } = props;
  const log = [[year, "2.0." + (year - 2004)], [year - 1, "2.0." + (year - 2005)], [2004, "1.2.2"], [2002, "1.1.0"]] as const;
  return (
    <div className="sw sw-vsftpeed">
      <h1>{t("browser-sites-2.vsTitle")}</h1>
      <Nav {...props} />
      <hr />
      {page === "home" && (
        <>
          <p>{p.site.blurb}</p>
          <h3>{t("browser-sites-2.vsChangelog")}</h3>
          <ul>{log.map(([y, v]) => <li key={v}>{t("browser-sites-2.vsRelease", { year: y, version: v })}</li>)}</ul>
        </>
      )}
      {page === "features" && <Features p={p} />}
      {page === "pricing" && <Pricing p={p} />}
      {page === "docs" && <><Docs p={p} /></>}
      {page === "download" && <><p>{t("browser-sites-2.vsAfterInstall")}</p><Commands p={p} year={year} /></>}
      <hr />
      <address>{t("browser-sites-2.vsUpdated", { year })}</address>
    </div>
  );
}
