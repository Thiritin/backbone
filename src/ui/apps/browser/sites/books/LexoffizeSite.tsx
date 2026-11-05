import type { MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./lexoffize.css";

// 2014 airy launch page, 2017 dashboard pitch on navy, 2023 corporate dark with a red accent.
const ERAS = [{ from: 2014, look: "lo-launch" }, { from: 2017, look: "lo-dash" }, { from: 2023, look: "lo-corp" }];
const L = (k: string, p?: Record<string, string | number>) => t(`books-site.lexoffize.${k}`, p);
const stay = (e: MouseEvent) => e.preventDefault();
const FEATS = ["invoice", "receipts", "banking"] as const;

// Ring with a red dot; the corporate era sets it on a red tile.
function Mark({ tile }: { tile?: boolean }) {
  return (
    <svg className="lo-mark" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      {tile && <rect width="24" height="24" rx="6" className="lo-tile" />}
      <circle cx="10" cy="11" r="6" fill="none" strokeWidth="3" className="lo-ring" />
      <circle cx="17" cy="17" r="2.6" className="lo-dot" />
    </svg>
  );
}

function Icon({ n }: { n: number }) {
  return (
    <svg className="lo-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" className="lo-icon-bg" />
      {n === 0 && <path d="M10 8h9l4 4v12H10z M13 15h7 M13 19h7" className="lo-icon-line" />}
      {n === 1 && <path d="M9 10h14v12H9z M9 14h14 M13 18h6" className="lo-icon-line" />}
      {n === 2 && <path d="M8 22V14 M13 22V10 M18 22V16 M23 22V8" className="lo-icon-line" />}
    </svg>
  );
}

// A drawn browser window with an invoice: the screenshot of the launch and corporate heroes.
function Shot() {
  return (
    <div className="lo-shot" aria-hidden="true">
      <div className="lo-shot-bar"><i /><i /><i /></div>
      <div className="lo-shot-body">
        <div className="lo-shot-side"><b /><b /><b /><b /></div>
        <div className="lo-shot-doc">
          <h4>{L("mock.invoice")}</h4>
          <span /><span /><span className="short" />
          <p><em>{L("mock.total")}</em><strong className="num">{euro(1190)}</strong></p>
        </div>
      </div>
    </div>
  );
}

// The launch hero: a wide app window with a sidebar and the invoice list.
function Window() {
  const rows = [[1190, "paid"], [480, "open"], [2350, "paid"], [760, "open"]] as const;
  return (
    <div className="lo-shot lo-win" aria-hidden="true">
      <div className="lo-shot-bar"><i /><i /><i /></div>
      <div className="lo-win-body">
        <ul className="lo-win-side">{["invoices", "receipts", "bank"].map((k, i) => <li key={k} className={i === 0 ? "on" : undefined}>{L(`mock.side.${k}`)}</li>)}</ul>
        <div className="lo-win-main">
          <div className="lo-win-head"><h4>{L("mock.side.invoices")}</h4><span className="lo-chip new">{L("mock.new")}</span></div>
          {rows.map(([n, st], i) => <div key={i} className="lo-win-row"><span className="who" style={{ width: `${34 + i * 9}%` }} /><span className={`lo-chip ${st}`}>{L(`mock.${st}`)}</span><strong className="num">{euro(n)}</strong></div>)}
        </div>
      </div>
    </div>
  );
}

// Incoming payments matched to invoices, the second window of the launch page.
function Match() {
  return (
    <div className="lo-shot lo-match" aria-hidden="true">
      <div className="lo-shot-bar"><i /><i /><i /></div>
      <h4>{L("mock.side.bank")}</h4>
      {[1190, 2350, 480].map((n, i) => <div key={n} className="lo-win-row"><strong className="num">{euro(n)}</strong><span className="who" style={{ width: `${30 + i * 12}%` }} /><span className={`lo-chip ${i < 2 ? "paid" : "open"}`}>{L(i < 2 ? "mock.paid" : "mock.open")}</span></div>)}
    </div>
  );
}

function Dash() {
  const bars = [38, 52, 44, 66, 58, 80, 72];
  return (
    <div className="lo-board" aria-hidden="true">
      <div className="lo-widget wide"><em>{L("widget.revenue")}</em><div className="lo-bars">{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></div>
      <div className="lo-widget"><em>{L("widget.open")}</em><strong className="num">{euro(4280)}</strong></div>
      <div className="lo-widget"><em>{L("widget.cash")}</em><strong className="num">{euro(12950)}</strong></div>
    </div>
  );
}

function Download({ era, guide }: { era: string; guide: ReactNode }) {
  const browser = L(`req.browser.${era}`);
  return (
    <section className="lo-dl">
      <div className="lo-dl-copy">
        <h2>{L("download.title")}</h2>
        <p>{L("download.text")}</p>
        <div className="lo-stores"><span>{L("download.phone")}</span><span>{L("download.tablet")}</span></div>
        {guide}
      </div>
      <div className="lo-req">
        <h3>{L("req.title")}</h3>
        <ul><li>{browser}</li><li>{L("req.net")}</li><li>{L("req.app")}</li></ul>
      </div>
    </section>
  );
}

export function LexoffizeSite({ game, path, go }: SiteProps) {
  const v = booksVendor("lexoffize")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf(ERAS, year), era = look.slice(3);
  const home = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const guide = <a className="lo-guide" href={BOOKS_GUIDE_ROUTE} onClick={(e) => { e.preventDefault(); go(BOOKS_GUIDE_ROUTE); }}>{L("guide")}</a>;
  const shop = <Editions game={game} v={v} one={one} table />;
  const nav = (links: string[]) => (
    <nav className="lo-nav">
      {links.map((k) => <a key={k} href="#" onClick={stay}>{L(`nav.${k}`)}</a>)}
      <a href="#home" aria-current={one ? undefined : "page"} onClick={home}>{t("books-editions.nav")}</a>
    </nav>
  );
  const word = <a className="lo-logo" href="#home" onClick={home}><Mark tile={era === "corp"} />rex<b>office</b></a>;
  const legal = ["imprint", "privacy", "terms"].map((k) => <a key={k} href="#" onClick={stay}>{L(`legal.${k}`)}</a>);
  const copy = t("books-vendors.footer", { year, name: v.name });

  if (era === "launch") {
    return (
      <div className={`lo ${look}`}>
        <header className="lo-top">{word}{nav(["features", "service"])}<a className="lo-login" href="#" onClick={stay}>{L("login")}</a><a className="lo-cta small" href="#" onClick={stay}>{L("trial")}</a></header>
        <section className="lo-hero">
          <div className="lo-copy"><h1>{L("hero.launch")}</h1><p>{L("hero.launch.sub")}</p><a className="lo-cta" href="#" onClick={stay}>{L("trial")}</a></div>
          <Window />
        </section>
        <section className="lo-tour">
          <div className="lo-tour-list">
            {FEATS.map((f, i) => <div key={f}><Icon n={i} /><div><h3>{L(`feat.${f}`)}</h3><p>{L(`feat.${f}.text`)}</p></div></div>)}
          </div>
          <Match />
        </section>
        <section className="lo-prices"><h2>{L("prices.title")}</h2>{shop}</section>
        <Download era={era} guide={guide} />
        <footer className="lo-foot"><span>{copy}</span><span className="lo-legal">{legal}</span></footer>
      </div>
    );
  }
  if (era === "dash") {
    return (
      <div className={`lo ${look}`}>
        <header className="lo-top">{word}{nav(["features", "service", "blog"])}<a className="lo-login" href="#" onClick={stay}>{L("login")}</a><a className="lo-cta small" href="#" onClick={stay}>{L("trial")}</a></header>
        <section className="lo-hero">
          <div className="lo-copy"><span className="lo-kicker">{L("hero.kicker")}</span><h1>{L("hero.dash")}</h1><p>{L("hero.dash.sub")}</p><a className="lo-cta" href="#" onClick={stay}>{L("trial")}</a></div>
          <Dash />
        </section>
        <section className="lo-rows">
          {FEATS.map((f, i) => (
            <article key={f} className={i % 2 ? "flip" : undefined}>
              <div className="lo-art"><Icon n={i} /></div>
              <div><h3>{L(`feat.${f}`)}</h3><p>{L(`feat.${f}.text`)}</p></div>
            </article>
          ))}
        </section>
        <section className="lo-prices"><h2>{L("prices.title")}</h2>{shop}</section>
        <Download era={era} guide={guide} />
        <footer className="lo-foot"><span>{copy}</span><span className="lo-legal">{legal}</span></footer>
      </div>
    );
  }
  return (
    <div className={`lo ${look}`}>
      <header className="lo-top">{word}{nav(["features", "solutions", "addons", "service", "knowledge"])}<a className="lo-login" href="#" onClick={stay}>{L("login")}</a><a className="lo-cta small" href="#" onClick={stay}>{L("trial.free")}</a></header>
      <section className="lo-hero">
        <h1>{L("hero.corp")}</h1><p>{L("hero.corp.sub")}</p>
        <a className="lo-cta" href="#" onClick={stay}>{L("trial.free")}</a>
        <Shot />
      </section>
      <section className="lo-bento">
        {FEATS.map((f, i) => <div key={f} className={`cell c${i}`}><Icon n={i} /><h3>{L(`feat.${f}`)}</h3><p>{L(`feat.${f}.text`)}</p></div>)}
      </section>
      <section className="lo-prices"><h2>{L("prices.title")}</h2>{shop}</section>
      <Download era={era} guide={guide} />
      <section className="lo-faq">
        <h2>{L("faq.title")}</h2>
        {[1, 2, 3].map((n) => <details key={n}><summary>{L(`faq.${n}.q`)}</summary><p>{L(`faq.${n}.a`)}</p></details>)}
      </section>
      <footer className="lo-foot">
        <div className="lo-cols">
          <div><h4>{L("foot.product")}</h4>{["features", "solutions", "addons"].map((k) => <a key={k} href="#" onClick={stay}>{L(`nav.${k}`)}</a>)}</div>
          <div><h4>{L("foot.company")}</h4>{["about", "press", "partner", "jobs"].map((k) => <a key={k} href="#" onClick={stay}>{L(`foot.${k}`)}</a>)}</div>
          <div><h4>{L("foot.legal")}</h4>{legal}</div>
        </div>
        <span>{copy}</span>
      </footer>
    </div>
  );
}
