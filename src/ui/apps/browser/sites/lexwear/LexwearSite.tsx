import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import type { GameState } from "../../../../../sim/50-state";
import { booksUrl, LEXWEAR_HOST } from "../../../../../sim/80-business/bookkeeping";
import { BOOKS_GUIDE_ROUTE } from "../books/guide-route";
import { editionIn, Editions } from "../books/VendorShop";
import { eraOf } from "../era";
import "./lexwear.css";

const SUPPORT = `www.${LEXWEAR_HOST}/support`;
// A software box drawn in CSS, its spine darker with each edition.
const HUE = [210, 150, 20];
// The vendor's portal: a table-laid red page, the 2009 glossy redesign, then a flat page with a mega menu.
const ERAS = [{ from: 2005, look: "classic" }, { from: 2009, look: "modern" }, { from: 2015, look: "flat" }] as const;
type Look = (typeof ERAS)[number]["look"];

// A ledger T on a red tile; the tile shape changes with the era.
const Mark = ({ look }: { look: Look }) => (
  <svg className="lx-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    <rect className="lx-mark-bg" width="32" height="32" rx={look === "classic" ? 0 : look === "modern" ? 16 : 5} />
    <path className="lx-mark-t" d="M7 7h18v5h-6.5v11h-5V12H7z" />
    <rect className="lx-mark-l" x="7" y="26" width="18" height="2" />
  </svg>
);

export function LexwearSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const v = booksVendor("lexwear")!, one = editionIn(path);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const page = path.startsWith("/support") ? "support" : "home";
  const year = yearOf(game.hour), look = eraOf([...ERAS], year);
  const nav: [string, string, string][] = [["home", t("lxs.nav.home"), booksUrl(v)], ["support", t("vendor-sites.navSupport"), SUPPORT]];
  const groups = [t("lxs.g.books"), t("lxs.g.orders"), t("lxs.g.payroll"), t("lxs.g.tax"), t("lxs.g.forms"), t("lxs.g.private")];
  const mega = [t("lxs.mega.1"), t("lxs.mega.2"), t("lxs.mega.3"), t("lxs.mega.4"), t("lxs.mega.5"), t("lxs.mega.6")];
  const util = [t("lxs.contact"), t("lxs.terms"), t("lxs.imprint"), t("lxs.sitemap"), t("lxs.help")];
  const news = [t("lxs.news.1", { year }), t("lxs.news.2"), t("lxs.news.3")];
  const req = { classic: t("lxs.req.classic", { mb: v.setupMb ?? 0 }), modern: t("lxs.req.modern", { mb: v.setupMb ?? 0 }), flat: t("lxs.req.flat", { mb: v.setupMb ?? 0 }) }[look];
  const hero = { classic: t("lxs.hero.classic"), modern: t("lxs.hero.modern"), flat: t("lxs.hero.flat") }[look];
  const guide = <a className="lx-guide" href={BOOKS_GUIDE_ROUTE} onClick={link(BOOKS_GUIDE_ROUTE)}>{t("lxs.guide")}</a>;
  const search = <form className="lx-search" onSubmit={(e) => e.preventDefault()}><input type="text" placeholder={t("lxs.search")} aria-label={t("lxs.search")} /><button type="button">{t("lxs.searchGo")}</button></form>;
  const tabs = nav.map(([k, label, url]) => <a key={k} href={`#${k}`} aria-current={k === page ? "page" : undefined} onClick={link(url)}>{label}</a>);
  const mainNav = [...tabs, <span key="t">{t("lxs.nav.training")}</span>, <span key="n">{t("lxs.nav.news")}</span>, <span key="a">{t("lxs.nav.account")}</span>];
  const boxes = (
    <div className="lx-boxes" aria-hidden="true">
      {v.editions.filter((e) => !one || e.id === one).map((e) => (
        <div key={e.id} className="lx-box" style={{ "--lx-hue": HUE[v.editions.indexOf(e)] } as CSSProperties}>
          <span className="lx-box-brand">{v.name}</span><span className="lx-box-name">{e.name}</span>
        </div>
      ))}
    </div>
  );
  const shop: ReactNode = page === "support" ? <><h1>{t("vendor-sites.navSupport")}</h1><p>{t("vendor-sites.support")}</p></> : (
    <>
      <section className="lx-hero">
        <div><h1>{hero}</h1><p>{t("lxs.lead")}</p><a className="lx-try" href="#download">{t("lxs.try")}</a></div>
        {boxes}
      </section>
      <section className="lx-shop"><h2>{v.program}</h2><Editions game={game} v={v} one={one} table={look !== "classic"} /></section>
      <section id="download" className="lx-dl">
        <h2>{t("lxs.dl.title")}</h2>
        <h3>{t("lxs.req.title")}</h3>
        <p>{req}</p>
        <p>{guide}</p>
      </section>
    </>
  );
  const newsBox = <aside className="lx-news"><h3>{t("lxs.news.title")}</h3><ul>{news.map((n) => <li key={n}>{n}</li>)}</ul></aside>;
  const foot = <footer className="lx-foot">{t("vendor-sites.footer", { year })} <span>{t("lxs.imprint")}</span> <span>{t("lxs.privacy")}</span> <span>{t("lxs.terms")}</span></footer>;
  const logo = <span className="lx-logo"><Mark look={look} />tax<b>ware</b></span>;

  if (look === "classic") {
    return (
      <div className="lx lx-classic">
        <table className="lx-frame" cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr><td colSpan={3} className="lx-util">{util.map((u) => <span key={u}>{u}</span>)}</td></tr>
            <tr><td colSpan={3} className="lx-top">{logo}<span className="lx-tag">{t("vendor-sites.tagline")}</span>{search}</td></tr>
            <tr><td colSpan={3} className="lx-nav">{mainNav}</td></tr>
            <tr>
              <td className="lx-left"><b>{t("lxs.g.title")}</b><ul>{groups.map((g) => <li key={g}>{g}</li>)}</ul></td>
              <td className="lx-main">{shop}</td>
              <td className="lx-right">{newsBox}</td>
            </tr>
            <tr><td colSpan={3}>{foot}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (look === "modern") {
    return (
      <div className="lx lx-modern">
        <div className="lx-page">
          <div className="lx-util">{util.map((u) => <span key={u}>{u}</span>)}</div>
          <header className="lx-top">{logo}{search}</header>
          <nav className="lx-nav">
            {mainNav}
            <span className="lx-pick" tabIndex={0}>{t("lxs.pick")}<ul>{groups.map((g) => <li key={g}>{g}</li>)}</ul></span>
          </nav>
          <div className="lx-cols">
            <main className="lx-main">{shop}</main>
            <div className="lx-side">
              <aside className="lx-acct"><h3>{t("lxs.account.box")}</h3><span>{t("lxs.reg")}</span></aside>
              {newsBox}
            </div>
          </div>
          {foot}
        </div>
      </div>
    );
  }
  return (
    <div className="lx lx-flat">
      <header className="lx-top">{logo}<nav className="lx-nav">{mainNav}</nav></header>
      <div className="lx-mega" aria-hidden="true"><b>{t("lxs.mega.title")}</b>{mega.map((m) => <span key={m}>{m}</span>)}</div>
      <main className="lx-main">{shop}</main>
      <div className="lx-claim">{t("lxs.claim")}</div>
      <div className="lx-cols">{newsBox}<div className="lx-links">{groups.map((g) => <span key={g}>{g}</span>)}</div></div>
      {foot}
    </div>
  );
}
