import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./saga.css";

// A business-software group's site: a boxed corporate page with a green band (2005), grey and green product tiles (2010), a dark hero with a neon call to action (2016).
const ERAS = [{ from: 2005, look: "classic" }, { from: 2010, look: "modern" }, { from: 2016, look: "flat" }] as const;
type Look = (typeof ERAS)[number]["look"];

// A thyme sprig of three leaves on a stem; the tile behind it changes with the era.
const Mark = ({ look }: { look: Look }) => (
  <svg className="sg-mark" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
    <rect className="sg-mark-bg" width="32" height="32" rx={look === "classic" ? 3 : 16} />
    <path className="sg-mark-stem" d="M16 28V9" />
    <ellipse className="sg-mark-leaf" cx="16" cy="7" rx="3" ry="5" />
    <ellipse className="sg-mark-leaf" cx="10" cy="15" rx="2.6" ry="5" transform="rotate(-50 10 15)" />
    <ellipse className="sg-mark-leaf" cx="22" cy="18" rx="2.6" ry="5" transform="rotate(50 22 18)" />
  </svg>
);

export function SagaSite({ game, path, go }: SiteProps) {
  const v = booksVendor("saga")!, one = editionIn(path);
  const year = yearOf(game.hour), look = eraOf([...ERAS], year);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const util = [t("sgs.karriere"), t("sgs.events"), t("sgs.login"), t("sgs.partner"), t("sgs.contact")];
  const navClassic = [t("sgs.nav.small"), t("sgs.nav.mid"), t("sgs.nav.trade"), t("sgs.nav.about"), t("sgs.nav.press")];
  const navWide = [t("sgs.nav.solutions"), t("sgs.nav.industries"), t("sgs.nav.service"), t("sgs.nav.about")];
  const tiles = [[t("sgs.tile.1.t"), t("sgs.tile.1.d")], [t("sgs.tile.2.t"), t("sgs.tile.2.d")], [t("sgs.tile.3.t"), t("sgs.tile.3.d")]];
  const req = { classic: t("sgs.req.classic", { mb: v.setupMb ?? 0 }), modern: t("sgs.req.modern", { mb: v.setupMb ?? 0 }), flat: t("sgs.req.flat", { mb: v.setupMb ?? 0 }) }[look];
  const shop = (
    <>
      {look === "flat" ? <h2>{v.program}</h2> : <h1>{v.program}</h1>}
      <Editions game={game} v={v} one={one} table={look !== "classic"} />
      <section id="download" className="sg-dl">
        <h2>{t("sgs.dl.title")}</h2>
        <h3>{t("sgs.req.title")}</h3>
        <p>{req}</p>
        <p><a className="sg-guide" href={BOOKS_GUIDE_ROUTE} onClick={link(BOOKS_GUIDE_ROUTE)}>{t("sgs.guide")}</a></p>
      </section>
    </>
  );
  const home = <a className="sg-home" href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("sgs.nav.home")}</a>;
  const logo = <span className="sg-logo"><Mark look={look} />thyme</span>;
  const foot = (
    <footer className="sg-foot">
      {t("books-vendors.footer", { year, name: v.name })}
      <span>{t("sgs.imprint")}</span><span>{t("sgs.legal")}</span><span>{t("sgs.privacy")}</span>
    </footer>
  );

  if (look === "classic") {
    return (
      <div className="sg sg-classic">
        <div className="sg-page">
          <div className="sg-util">{util.map((u) => <span key={u}>{u}</span>)}</div>
          <header className="sg-head">{logo}<span className="sg-tag">{t("books-vendors.about.saga")}</span></header>
          <nav className="sg-nav">{home}{navClassic.map((n) => <span key={n}>{n}</span>)}</nav>
          <div className="sg-body">
            <main className="sg-main">{shop}</main>
            <aside className="sg-side">
              <div className="sg-box"><b>{t("sgs.claim")}</b></div>
              <div className="sg-box"><b>{t("sgs.small.title")}</b><p>{t("sgs.small.text")}</p></div>
            </aside>
          </div>
          {foot}
        </div>
      </div>
    );
  }
  if (look === "modern") {
    return (
      <div className="sg sg-modern">
        <div className="sg-util">{util.map((u) => <span key={u}>{u}</span>)}</div>
        <header className="sg-head">{logo}<nav className="sg-nav">{home}{navWide.map((n) => <span key={n}>{n}</span>)}</nav></header>
        <section className="sg-tiles">
          {tiles.map(([title, text], i) => (
            <div key={title} className={`sg-tile sg-tile-${i}`}><h2>{title}</h2><p>{text}</p><a href="#download">{t("sgs.try")}</a></div>
          ))}
        </section>
        <main className="sg-main">{shop}</main>
        {foot}
      </div>
    );
  }
  return (
    <div className="sg sg-flat">
      <header className="sg-head">{logo}<nav className="sg-nav">{home}{navWide.map((n) => <span key={n}>{n}</span>)}</nav><a className="sg-cta" href="#download">{t("sgs.try")}</a></header>
      <section className="sg-hero">
        <div><h1>{t("sgs.hero.flat")}</h1><p>{t("sgs.lead")}</p><a className="sg-cta" href="#download">{t("sgs.try")}</a></div>
        <div className="sg-art" aria-hidden="true"><i /><i /><i /></div>
      </section>
      <section className="sg-feats">{tiles.map(([title, text]) => <div key={title}><h2>{title}</h2><p>{text}</p></div>)}</section>
      <main className="sg-main">{shop}</main>
      {foot}
    </div>
  );
}
