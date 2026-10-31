import { t } from "../../../../../i18n/en";
import { Body, Link, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./vmwhere.css";

const EDITIONS = ["Standard", "Enterprise", "Enterprise Plus"];
const EDITION_KEY: Record<string, string> = { Standard: "edStandard", Enterprise: "edEnterprise", "Enterprise Plus": "edEnterprisePlus" };

// VMwhere: corporate grey with blue tabs and a product matrix; product tiles from 2015.
export function VMwhere(props: SiteProps) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`sw sw-vmwhere ${look}`}>
      <header>
        <span className="sw-wm"><SiteMark id="vmwhere" name={p.name} size={22} /><b>vm</b>where</span>
        <Nav {...props} className="sw-tabs" labels={{ home: t("browser-sites-2.navProducts"), download: t("browser-sites-2.navDownloads") }} />
      </header>
      <main>
        <p className="crumb">{t("browser-sites-2.vmCrumb")}</p>
        <h1>{t("browser-sites-2.vmTitle", { tagline: p.site.tagline })}</h1>
        {page === "home" && look === "early" && (
          <table className="matrix">
            <thead><tr><th>{t("browser-sites-2.vmCapability")}</th>{EDITIONS.map((e) => <th key={e}>{t(`browser-sites-2.${EDITION_KEY[e]}`)}</th>)}</tr></thead>
            <tbody>{p.site.features.map((f, i) => <tr key={f}><td>{f}</td>{EDITIONS.map((e, j) => <td key={e}>{j >= Math.min(i, 2) ? "●" : ""}</td>)}</tr>)}</tbody>
          </table>
        )}
        {page === "home" && look === "late" && (
          <div className="tiles">
            {p.site.features.map((f, i) => (
              <Link key={f} to={i === 3 ? "pricing" : "features"} go={go} className={i === 3 ? "tile suite" : "tile"}>{i === 3 && <b>{t("browser-sites-2.vmSuite")}</b>}{f}</Link>
            ))}
          </div>
        )}
        <Body {...props} />
      </main>
      <footer>{t("browser-sites-2.vmFooter", { year })}</footer>
    </div>
  );
}
