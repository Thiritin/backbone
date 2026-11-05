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
const GTQ = { forge: "1.2", wiki: "2", modern: "3" } as const;

// Two horns over a till; each era draws it in its own flat colours.
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="gn-mark" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path className="gn-horn" d="M2.5 2.5c0 3 1.8 4.6 4.3 4.6M13.5 2.5c0 3-1.8 4.6-4.3 4.6" />
      <path className="gn-till" d="M4.6 6.8h6.8l-1.6 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" />
    </svg>
  );
}

// A drawn register window with a few booking rows.
function Reg({ rows = 5, cls }: { rows?: number; cls?: string }) {
  return (
    <div className={`gn-reg ${cls ?? ""}`} aria-hidden="true">
      <div className="gn-reg-bar"><i /><i /><i /></div>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="gn-reg-row"><b /><span /><em style={{ width: `${18 + ((i * 7) % 5) * 5}%` }} /></div>)}
    </div>
  );
}

export function GnuCacheSite({ game, path, go }: SiteProps) {
  const v = booksVendor("gnucache")!, one = editionIn(path), year = yearOf(game.hour);
  const era = eraOf([...ERAS], year), release = eraOf(RELEASES, year);
  const link = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const guideLink = <a className="gn-guide" href={BOOKS_GUIDE_ROUTE} onClick={(e) => { e.preventDefault(); go(BOOKS_GUIDE_ROUTE); }}>{G("guide")}</a>;
  const home = <a href="#home" aria-current={one ? undefined : "page"} onClick={link}>{t("books-editions.nav")}</a>;
  const dead = (k: string) => <a key={k} href="#" onClick={stay}>{G(`nav.${k}`)}</a>;
  const shop = <Editions game={game} v={v} one={one} />;
  const table = <Editions game={game} v={v} one={one} table />;
  // The wiki splits the start page from the download page; the edition path is a download page too.
  const onDownload = !!one || path.startsWith("/download");
  const downloadUrl = `${booksUrl(v)}download`;
  const toDownload = (e: MouseEvent) => { e.preventDefault(); go(downloadUrl); };
  const req = (
    <table className="gn-req">
      <caption>{G("req.title")}</caption>
      <tbody>
        <tr><th scope="row">{G("req.os.label")}</th><td>{G(`req.os.${era}`)}</td></tr>
        <tr><th scope="row">{G("req.ram.label")}</th><td>{G(`req.ram.${era}`)}</td></tr>
        <tr><th scope="row">{G("req.disk.label")}</th><td>{G("req.disk", { mb: v.setupMb ?? 0 })}</td></tr>
      </tbody>
    </table>
  );
  const files = (
    <table className="gn-files">
      <thead><tr><th>{G("files.name")}</th><th>{G("files.desc")}</th></tr></thead>
      <tbody>
        <tr><td><code>gnucache-{release}.tar.gz</code></td><td>{G("dl.source")}</td></tr>
        <tr><td><code>gnucache-{release}-setup.exe</code></td><td>{G("dl.win")}</td></tr>
      </tbody>
    </table>
  );
  const news = (
    <ul className="gn-news">
      <li><b>{G("news.release", { release })}</b></li>
      <li>{G("news.translation")}</li>
    </ul>
  );
  const feats = [1, 2, 3].map((n) => ({ n, title: G(`feat.${n}`), text: G(`feat.${n}.text`) }));
  const copy = t("books-vendors.footer", { year, name: v.name });

  if (era === "forge") {
    return (
      <div className="gn gn-forge">
        <table className="gn-frame" cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr><td colSpan={2} className="gn-banner"><span className="gn-logo"><Mark size={34} /><b>Gnu</b>Cache</span><span className="gn-tag">{G("tag")}</span></td></tr>
            <tr>
              <td className="gn-side">
                <nav className="gn-nav">{home}{["download", "docs", "faq", "lists", "dev"].map(dead)}</nav>
                <div className="gn-buttons"><span>GNU GPL</span><span>GTQ+ {GTQ[era]}</span><span>{`v${release}`}</span></div>
                <span className="gn-release">{`GnuCache ${release}`}</span>
              </td>
              <td className="gn-content">
                <h1>{one ? v.program : G("welcome")}</h1>
                <p>{G("intro")}</p>
                <h2>{G("news.title")}</h2>{news}
                <h2>{G("feat.title")}</h2>
                <dl>{feats.map((f) => <div key={f.n}><dt>{f.title}</dt><dd>{f.text}</dd></div>)}</dl>
                <h2 id="download">{G("nav.download")}</h2>
                {table}{files}{req}
                <p>{guideLink}</p>
              </td>
            </tr>
            <tr><td colSpan={2} className="gn-foot"><span>{copy}</span><span>{G("foot.changed", { year })}</span><span>{G("foot.license")}</span></td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (era === "wiki") {
    return (
      <div className="gn gn-wiki">
        <header className="gn-head">
          <span className="gn-logo"><Mark size={30} /><b>Gnu</b>Cache</span>
          <span className="gn-tag">{G("tag")}</span>
          <input type="search" className="gn-search" aria-label={G("search")} placeholder={G("search")} readOnly />
        </header>
        <nav className="gn-nav">
          <a href="#home" aria-current={onDownload ? undefined : "page"} onClick={link}>{G("crumbs.home")}</a><a href="#download" aria-current={onDownload && !one ? "page" : undefined} onClick={toDownload}>{G("nav.download")}</a>{["features", "help", "contribute"].map(dead)}
          <span className="gn-tabs"><a href="#" aria-current="page" onClick={stay}>{G("tabs.view")}</a><a href="#" onClick={stay}>{G("tabs.edit")}</a><a href="#" onClick={stay}>{G("tabs.history")}</a></span>
        </nav>
        <p className="gn-crumbs">{onDownload ? <><a href="#home" onClick={link}>{G("crumbs.home")}</a> &raquo; {G("nav.download")}</> : G("crumbs.home")}</p>
        <div className="gn-cols">
          <main className="gn-main">
            {onDownload ? (
              <>
                <h1>{one ? v.program : G("nav.download")}</h1>
                <section className="gn-panel">
                  <span className="gn-release">{`GnuCache ${release}`}</span>
                  {shop}
                  {files}
                  <p>{guideLink}</p>
                </section>
                {req}
              </>
            ) : (
              <>
                <h1>{G("welcome")}</h1>
                <p>{G("intro")}</p>
                <a className="gn-fetch" href="#download" onClick={toDownload}>{G("get", { release })}</a>
                <h2>{G("feat.title")}</h2>
                <dl>{feats.map((f) => <div key={f.n}><dt>{f.title}</dt><dd>{f.text}</dd></div>)}</dl>
                <h2>{G("gallery.title")}</h2>
                <div className="gn-gallery">{[3, 5, 4].map((r, i) => <figure key={r}><Reg rows={r} /><figcaption>{G(`gallery.${i + 1}`)}</figcaption></figure>)}</div>
              </>
            )}
          </main>
          <aside className="gn-aside">
            <h3>{G("news.title")}</h3>{news}
            <h3>{G("feat.title")}</h3>
            <ul>{feats.map((f) => <li key={f.n}>{f.title}</li>)}</ul>
          </aside>
        </div>
        <footer className="gn-foot"><span>{copy}</span><span>{G("foot.license")}</span></footer>
      </div>
    );
  }
  const card = (f: (typeof feats)[number]): ReactNode => <div key={f.n} className="gn-card"><i>{f.n}</i><h3>{f.title}</h3><p>{f.text}</p></div>;
  return (
    <div className="gn gn-modern">
      <header className="gn-head">
        <span className="gn-logo"><Mark size={30} /><b>Gnu</b>Cache</span>
        <nav className="gn-nav">{home}{["features", "help", "contribute"].map(dead)}</nav>
        <a className="gn-donate" href="#" onClick={stay}>{G("nav.donate")}</a>
      </header>
      <section className="gn-hero">
        <div><span className="gn-release">{`GnuCache ${release}`}</span><h1>{G("hero.title")}</h1><p>{G("hero.sub")}</p></div>
        <Reg rows={6} cls="big" />
      </section>
      <section className="gn-cards">{feats.map(card)}</section>
      <section className="gn-get">
        <div><h2>{G("nav.download")}</h2>{shop}{files}<p>{guideLink}</p></div>
        <div>{req}</div>
      </section>
      <section className="gn-join">
        <h2>{G("nav.contribute")}</h2><p>{G("contribute.text")}</p>
        <a className="gn-donate" href="#" onClick={stay}>{G("nav.donate")}</a>
      </section>
      <footer className="gn-foot">
        <span>{copy}</span>
        <span className="gn-legal"><a href="#" onClick={stay}>{G("foot.imprint")}</a><a href="#" onClick={stay}>{G("foot.privacy")}</a><span>{G("foot.license")}</span></span>
      </footer>
    </div>
  );
}
