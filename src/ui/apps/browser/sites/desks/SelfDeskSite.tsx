import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import type { DeskId } from "../../../../../sim/10-catalog/desks";
import { versionAt } from "../../../../../sim/10-catalog/software-versions";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { eraOf } from "../era";
import { Features, pageOf, productOf, type SitePage, type SiteProps } from "../software/SoftwareSite";
import { Releases } from "../software/Releases";
import "./self.css";

// ostickit.com and freescoot.net: the self-hosted desks have no price and no shop, so their sites list the release to
// download and the release history.
const PAGES: SitePage[] = ["home", "features", "download", "versions", "news"];
const LABEL: Partial<Record<SitePage, string>> = { home: "browser-sites-2.navOverview", features: "desk-sites.nav.features", download: "desk-sites.nav.download", versions: "releases.navVersions", news: "releases.navNews" };
const FILE: Record<string, (v: string) => string> = { ostickit: (v) => `ostickit-v${v}.zip`, freescoot: (v) => `freescoot-${v}.zip` };

function Body({ p, page, hour }: SiteProps) {
  const v = versionAt(p.id, hour);
  if (page === "features") return <><h2>{t("desk-sites.nav.features")}</h2><Features p={p} /></>;
  if (page === "versions" || page === "news") return <><h2>{t(LABEL[page]!)}</h2><Releases p={p} page={page} hour={hour} /></>;
  if (page === "download") {
    return (
      <>
        <h2>{t("desk-sites.nav.download")}</h2>
        <table className="dsw-table">
          <thead><tr><th>{t("desk-sites.file")}</th><th>{t("releases.version")}</th><th>{t("releases.released")}</th></tr></thead>
          <tbody><tr>
            <td><code>{FILE[p.id](v.version)}</code></td><td className="num">{v.version}</td>
            <td className="num">{dateOf(v.release).toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" })}</td>
          </tr></tbody>
        </table>
      </>
    );
  }
  return <><h1>{p.site.tagline}</h1><p>{p.site.blurb}</p><p><b>{t("releases.title", { name: `${p.name} ${v.version}` })}</b></p></>;
}

function DeskSite(props: SiteProps & { footer: string }) {
  const { p, look, page, go, year } = props;
  return (
    <div className={`dsw dsw-${p.id} dsw-${look}`}>
      <header className="dsw-head"><strong>{p.name}</strong><span>{p.site.tagline}</span></header>
      <nav className="dsw-nav">{PAGES.map((x) => <a key={x} href="#" className={x === page ? "on" : ""} onClick={(e) => { e.preventDefault(); go(x === "home" ? "/" : `/${x}`); }}>{t(LABEL[x]!)}</a>)}</nav>
      <main className="dsw-main"><Body {...props} /></main>
      <footer className="dsw-foot">{t(props.footer, { year })}</footer>
    </div>
  );
}

export function SelfDeskSite({ game, id, path, go }: { game: GameState; id: DeskId; path: string; go: (url: string) => void }) {
  const p = productOf("software", id);
  if (!p) return null;
  const year = yearOf(game.hour);
  return <DeskSite p={p} look={eraOf(p.site.eras, year)} page={pageOf(path)} year={year} hour={game.hour} go={(to) => go(`${displayHost(p.site.host)}${to}`)} footer={`desk-sites.${id}.footer`} />;
}
