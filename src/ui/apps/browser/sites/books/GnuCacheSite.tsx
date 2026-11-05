import type { MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./gnucache.css";

// 2005 a table-layout project page, 2011 a wiki portal with a green download panel, 2019 a flat marketing site.
// With one free edition there is nothing to compare, so the list stays in every era.
const ERAS = [{ from: 2005, look: "forge" }, { from: 2011, look: "wiki" }, { from: 2019, look: "modern" }] as const;
// The stable release the project page announces in a year.
const RELEASES = [
  { from: 2005, look: "1.8" }, { from: 2006, look: "2.0" }, { from: 2007, look: "2.2" }, { from: 2010, look: "2.4" },
  { from: 2013, look: "2.6" }, { from: 2018, look: "3.0" }, { from: 2020, look: "4.0" }, { from: 2023, look: "5.0" },
];
const G = (k: string, p?: Record<string, string | number>) => t(`books-site.gnucache.${k}`, p);
const stay = (e: MouseEvent) => e.preventDefault();
const GTK = { forge: "1.2", wiki: "2", modern: "3" } as const;

// Two horns over a till; each era draws it in its own flat colours.
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="gc-mark" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path className="gc-horn" d="M2.5 2.5c0 3 1.8 4.6 4.3 4.6M13.5 2.5c0 3-1.8 4.6-4.3 4.6" />
      <path className="gc-till" d="M4.6 6.8h6.8l-1.6 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" />
    </svg>
  );
}

// A drawn register window with a few booking rows.
function Reg({ rows = 5, cls }: { rows?: number; cls?: string }) {
  return (
    <div className={`gc-reg ${cls ?? ""}`} aria-hidden="true">
      <div className="gc-reg-bar"><i /><i /><i /></div>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="gc-reg-row"><b /><span /><em style={{ width: `${18 + ((i * 7) % 5) * 5}%` }} /></div>)}
    </div>
  );
}

export function GnuCacheSite({ game, path, go }: SiteProps) {
  const v = booksVendor("gnucache")!, one = editionIn(path), year = yearOf(game.hour);
  const era = eraOf([...ERAS], year), release = eraOf(RELEASES, year);
  const link = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const guideLink = <a className="gc-guide" href={BOOKS_GUIDE_ROUTE} onClick={(e) => { e.preventDefault(); go(BOOKS_GUIDE_ROUTE); }}>{G("guide")}</a>;
  const home = <a href="#home" aria-current={one ? undefined : "page"} onClick={link}>{t("books-editions.nav")}</a>;
  const dead = (k: string) => <a key={k} href="#" onClick={stay}>{G(`nav.${k}`)}</a>;
  const shop = <Editions game={game} v={v} one={one} />;
  const req = (
    <table className="gc-req">
      <caption>{G("req.title")}</caption>
      <tbody>
        <tr><th scope="row">{G("req.os.label")}</th><td>{G(`req.os.${era}`)}</td></tr>
        <tr><th scope="row">{G("req.ram.label")}</th><td>{G(`req.ram.${era}`)}</td></tr>
        <tr><th scope="row">{G("req.disk.label")}</th><td>{G("req.disk", { mb: v.setupMb ?? 0 })}</td></tr>
      </tbody>
    </table>
  );
  const files = (
    <ul className="gc-files">
      <li><code>gnucache-{release}.tar.gz</code> {G("dl.source")}</li>
      <li><code>gnucache-{release}-setup.exe</code> {G("dl.win")}</li>
    </ul>
  );
  const news = (
    <ul className="gc-news">
      <li><b>{G("news.release", { release })}</b></li>
      <li>{G("news.translation")}</li>
    </ul>
  );
  const feats = [1, 2, 3].map((n) => ({ n, title: G(`feat.${n}`), text: G(`feat.${n}.text`) }));
  const copy = t("books-vendors.footer", { year, name: v.name });

  if (era === "forge") {
    return (
      <div className="gc gc-forge">
        <table className="gc-frame" cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr><td colSpan={2} className="gc-banner"><span className="gc-logo"><Mark size={34} /><b>Gnu</b>Cache</span><span className="gc-tag">{G("tag")}</span></td></tr>
            <tr>
              <td className="gc-side">
                <nav className="gc-nav">{home}{["download", "docs", "faq", "lists", "dev"].map(dead)}</nav>
                <div className="gc-buttons"><span>GNU GPL</span><span>GTK+ {GTK[era]}</span><span>{`v${release}`}</span></div>
                <span className="gc-release">{`GnuCache ${release}`}</span>
              </td>
              <td className="gc-content">
                <h1>{one ? v.program : G("welcome")}</h1>
                <p>{G("intro")}</p>
                <h2>{G("news.title")}</h2>{news}
                <h2>{G("feat.title")}</h2>
                <dl>{feats.map((f) => <div key={f.n}><dt>{f.title}</dt><dd>{f.text}</dd></div>)}</dl>
                <h2 id="download">{G("nav.download")}</h2>
                {shop}{files}{req}
                <p>{guideLink}</p>
              </td>
            </tr>
            <tr><td colSpan={2} className="gc-foot"><span>{copy}</span><span>{G("foot.changed", { year })}</span><span>{G("foot.license")}</span></td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (era === "wiki") {
    return (
      <div className="gc gc-wiki">
        <header className="gc-head">
          <span className="gc-logo"><Mark size={30} /><b>Gnu</b>Cache</span>
          <span className="gc-tag">{G("tag")}</span>
          <input type="search" className="gc-search" aria-label={G("search")} placeholder={G("search")} readOnly />
        </header>
        <nav className="gc-nav">
          {home}{["features", "help", "contribute"].map(dead)}
          <span className="gc-tabs"><a href="#" aria-current="page" onClick={stay}>{G("tabs.view")}</a><a href="#" onClick={stay}>{G("tabs.edit")}</a><a href="#" onClick={stay}>{G("tabs.history")}</a></span>
        </nav>
        <p className="gc-crumbs">{G("crumbs.home")} &raquo; {G("nav.download")}</p>
        <div className="gc-cols">
          <main className="gc-main">
            <h1>{one ? v.program : G("nav.download")}</h1>
            <section className="gc-panel">
              <span className="gc-release">{`GnuCache ${release}`}</span>
              {shop}
              {files}
              <p>{guideLink}</p>
            </section>
            {req}
            <h2>{G("gallery.title")}</h2>
            <div className="gc-gallery">{[3, 5, 4].map((r, i) => <figure key={r}><Reg rows={r} /><figcaption>{G(`gallery.${i + 1}`)}</figcaption></figure>)}</div>
          </main>
          <aside className="gc-aside">
            <h3>{G("news.title")}</h3>{news}
            <h3>{G("feat.title")}</h3>
            <ul>{feats.map((f) => <li key={f.n}>{f.title}</li>)}</ul>
          </aside>
        </div>
        <footer className="gc-foot"><span>{copy}</span><span>{G("foot.license")}</span></footer>
      </div>
    );
  }
  const card = (f: (typeof feats)[number]): ReactNode => <div key={f.n} className="gc-card"><i>{f.n}</i><h3>{f.title}</h3><p>{f.text}</p></div>;
  return (
    <div className="gc gc-modern">
      <header className="gc-head">
        <span className="gc-logo"><Mark size={30} /><b>Gnu</b>Cache</span>
        <nav className="gc-nav">{home}{["features", "help", "contribute"].map(dead)}</nav>
        <a className="gc-donate" href="#" onClick={stay}>{G("nav.donate")}</a>
      </header>
      <section className="gc-hero">
        <div><span className="gc-release">{`GnuCache ${release}`}</span><h1>{G("hero.title")}</h1><p>{G("hero.sub")}</p></div>
        <Reg rows={6} cls="big" />
      </section>
      <section className="gc-cards">{feats.map(card)}</section>
      <section className="gc-get">
        <div><h2>{G("nav.download")}</h2>{shop}{files}<p>{guideLink}</p></div>
        <div>{req}</div>
      </section>
      <section className="gc-join">
        <h2>{G("nav.contribute")}</h2><p>{G("contribute.text")}</p>
        <a className="gc-donate" href="#" onClick={stay}>{G("nav.donate")}</a>
      </section>
      <footer className="gc-foot">
        <span>{copy}</span>
        <span className="gc-legal"><a href="#" onClick={stay}>{G("foot.imprint")}</a><a href="#" onClick={stay}>{G("foot.privacy")}</a><span>{G("foot.license")}</span></span>
      </footer>
    </div>
  );
}
