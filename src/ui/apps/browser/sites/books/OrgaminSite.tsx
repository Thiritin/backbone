import type { MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor, type BooksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./orgamin.css";

// orgaMIN: a home-made page with a left menu in 2005, a CMS portal with tabs around 2010, a rated flat shop from 2016, a dark chooser page from 2020.
const ERAS = [{ from: 2005, look: "home" }, { from: 2010, look: "portal" }, { from: 2016, look: "flat" }, { from: 2020, look: "modern" }] as const;
// Processor GHz, memory MB and screen the program asks for in each era.
const REQ = { home: [1, 512, "1024 x 768"], portal: [2, 1024, "1280 x 800"], flat: [2, 2048, "1366 x 768"], modern: [3, 4096, "1920 x 1080"] } as const;
const MENU = ["home", "info", "base", "modules", "shots", "tech", "demo", "download", "cd", "prices", "order", "service", "about"] as const;

const num = (n: number) => n.toLocaleString(LOCALE);
const stay = (e: MouseEvent) => e.preventDefault();
const jump = (id: string) => (e: MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView?.({ block: "start" }); };

// A stack of white document lines on an orange badge: bevelled and square in 2005, a rounded tile later.
function Mark({ size, home }: { size: number; home?: boolean }) {
  return (
    <svg className="om-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {home ? (
        <>
          <defs><linearGradient id="om-bevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7a763" /><stop offset="1" stopColor="#c25a0c" /></linearGradient></defs>
          <rect x="0.5" y="0.5" width="31" height="31" fill="url(#om-bevel)" stroke="#8a3d00" />
          <path d="M1.5 30.5V1.5h29" fill="none" stroke="#fde2c4" strokeWidth="1.2" />
          <path d="M30.5 1.5v29h-29" fill="none" stroke="#8a3d00" strokeWidth="1.2" />
        </>
      ) : <rect width="32" height="32" rx="8" fill="#e8731c" />}
      <circle cx="9" cy="9.5" r="2.6" fill="#3a2a1c" />
      <rect x="15" y="7.5" width="11" height="4" rx={home ? 0 : 2} fill="#fff" />
      <rect x="6" y="15" width="20" height="4" rx={home ? 0 : 2} fill="#fff" />
      <rect x="6" y="22" width="13" height="4" rx={home ? 0 : 2} fill="#fff" />
    </svg>
  );
}

const Brand = ({ size, v, home }: { size: number; v: BooksVendor; home?: boolean }) => (
  <span className="om-logo"><Mark size={size} home={home} />orga<b>{v.program.slice(4)}</b></span>
);

function Req({ look, v }: { look: keyof typeof REQ; v: BooksVendor }) {
  const [ghz, ram, res] = REQ[look];
  return (
    <div id="om-download" className="om-download">
      <h2>{t("books-orgamin.download.title")}</h2>
      <h3>{t("books-orgamin.req.title")}</h3>
      <div className="om-req">
        <p>{t("books-orgamin.req.cpu", { n: ghz })}</p>
        <p>{t("books-orgamin.req.ram", { n: num(ram) })}</p>
        <p>{t("books-orgamin.req.disk", { n: num(v.setupMb ?? 0) })}</p>
        <p>{t("books-orgamin.req.screen", { res })}</p>
      </div>
    </div>
  );
}

const Guide = ({ go }: { go: (url: string) => void }) => (
  <a className="om-guide" href={BOOKS_GUIDE_ROUTE} onClick={(e) => { e.preventDefault(); go(BOOKS_GUIDE_ROUTE); }}>{t("books-orgamin.guide")}</a>
);

const FEATS = [1, 2, 3] as const;
// Flat line icons: people, a document with lines, a calendar.
const ICONS = [
  <><circle cx="12" cy="9" r="4" /><path d="M4 26c0-6 4-9 8-9s8 3 8 9" /><circle cx="24" cy="11" r="3" /><path d="M22 18c4 0 6 3 6 8" /></>,
  <><path d="M7 3h13l5 5v21H7z" /><path d="M20 3v5h5M11 15h10M11 20h10M11 25h6" /></>,
  <><rect x="4" y="6" width="24" height="22" rx="2" /><path d="M4 13h24M10 3v6M22 3v6M10 18h4M18 18h4M10 23h4" /></>,
];
const Feats = () => (
  <div className="om-feats">
    {FEATS.map((n) => <section key={n}><svg className="om-ico" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">{ICONS[n - 1]}</svg><h3>{t(`books-orgamin.feat.${n}.t`)}</h3><p>{t(`books-orgamin.feat.${n}.d`)}</p></section>)}
  </div>
);

export function OrgaminSite({ game, path, go }: SiteProps) {
  const v = booksVendor("orgamin")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf([...ERAS], year);
  const home = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const link = (k: string, i: number, extra?: string): ReactNode => (
    <a key={k} className={extra} href="#" aria-current={i === 0 && !one ? "page" : undefined} onClick={i === 0 ? home : stay}>{t(`books-orgamin.nav.${k}`)}</a>
  );
  const nav = (items: readonly string[], extra?: string) => items.map((k, i) => link(k, i, extra));
  const legal = ["imprint", "terms", "privacy"].map((k) => <a key={k} href="#" onClick={stay}>{t(`books-orgamin.legal.${k}`)}</a>);
  const foot = t("books-vendors.footer", { year, name: v.name });
  const cheapest = euro(Math.min(...v.editions.map((e) => e.price)));
  const editions = <Editions game={game} v={v} one={one} table={look === "flat" || look === "modern"} />;

  if (look === "home") {
    return (
      <div className="om om-home">
        <header className="om-head"><Brand size={34} v={v} home /><span>{t("books-vendors.about.orgamin")}</span></header>
        <div className="om-body">
          <nav className="om-menu">{nav(MENU)}</nav>
          <main>
            <h1>{t("books-orgamin.home.title")}</h1>
            <p>{t("books-orgamin.home.lead")}</p>
            <div className="om-shots" aria-hidden="true"><i /><i /><i /></div>
            <h2>{v.program}</h2>
            {editions}
            <Req look="home" v={v} />
            <p><Guide go={go} /></p>
          </main>
        </div>
        <footer className="om-foot">
          {legal}<span>{t("books-orgamin.home.counter", { n: "004712" })}</span><span>{t("books-orgamin.home.best")}</span><span>{foot}</span>
        </footer>
      </div>
    );
  }

  if (look === "portal") {
    return (
      <div className="om om-portal">
        <header className="om-head">
          <Brand size={42} v={v} />
          <span className="om-hotline">{t("books-orgamin.box.hotline")}</span>
        </header>
        <nav className="om-tabs">{(["overview", "base", "modules", "gallery"] as const).map((k, i) => <a key={k} href="#" aria-current={i === 0 && !one ? "page" : undefined} onClick={i === 0 ? home : stay}>{t(`books-orgamin.tab.${k}`)}</a>)}</nav>
        <section className="om-teaser">
          <div><h1>{v.program}</h1><p className="om-claim">{t("books-orgamin.claim")}</p><p>{t("books-orgamin.lead")}</p></div>
          <span className="om-dots" aria-hidden="true"><i className="on" /><i /><i /></span>
        </section>
        <div className="om-boxes">
          <a href="#om-shop" onClick={jump("om-shop")}>{t("books-orgamin.box.price", { price: cheapest })}</a>
          <a href="#om-download" onClick={jump("om-download")}>{t("books-orgamin.box.trial")}</a>
          <a href="#" onClick={stay}>{t("books-orgamin.box.hotline")}</a>
        </div>
        <Feats />
        <section id="om-shop" className="om-shop"><h2>{t("books-orgamin.shop.title")}</h2>{editions}</section>
        <Req look="portal" v={v} />
        <p><Guide go={go} /></p>
        <footer className="om-foot">
          <div><b>{t("books-orgamin.col.program")}</b>{nav(["info", "modules", "shots"])}</div>
          <div><b>{t("books-orgamin.col.service")}</b>{nav(["service", "download", "cd"])}</div>
          <div><b>{t("books-orgamin.col.company")}</b>{legal}</div>
          <p><b>{t("books-orgamin.follow")}</b> {foot}</p>
        </footer>
      </div>
    );
  }

  if (look === "flat") {
    return (
      <div className="om om-flat">
        <div className="om-util"><span>{t("books-orgamin.top.phone", { phone: "0800 555 0199" })}</span><span><i className="om-stars" aria-hidden="true">★★★★★</i> {t("books-orgamin.top.rating")}</span></div>
        <header className="om-head">
          <Brand size={34} v={v} />
          <nav>{nav(["program", "prices", "shop", "service"])}</nav>
          <a className="om-cta" href="#om-download" onClick={jump("om-download")}>{t("books-orgamin.nav.test")}</a>
        </header>
        <section className="om-hero">
          <div>
            <h1>{v.program}</h1>
            <p className="om-claim">{t("books-orgamin.claim")}</p>
            <p>{t("books-orgamin.lead")}</p>
            <strong className="om-users">{t("books-orgamin.users")}</strong>
          </div>
          <div className="om-conf">
            <h2>{t("books-orgamin.conf.title")}</h2>
            <p>{t("books-orgamin.conf.text")}</p>
            {[1, 2, 3].map((n) => <label key={n}><span className={n < 3 ? "on" : undefined} aria-hidden="true" />{t(`books-orgamin.conf.${n}`)}</label>)}
          </div>
        </section>
        <section className="om-band"><Feats /></section>
        <section id="om-shop" className="om-band om-tint"><h2>{t("books-orgamin.shop.title")}</h2>{editions}</section>
        <section className="om-band om-split"><Req look="flat" v={v} /><div><Guide go={go} /></div></section>
        <footer className="om-foot">{legal}<span>{t("books-orgamin.legal.vat")}</span><span>{foot}</span></footer>
      </div>
    );
  }

  return (
    <div className="om om-modern">
      <header className="om-head">
        <Brand size={30} v={v} />
        <nav>{nav(["features", "prices", "customers", "service"])}</nav>
        <a className="om-cta" href="#om-download" onClick={jump("om-download")}>{t("books-orgamin.nav.test")}</a>
      </header>
      <section className="om-hero">
        <h1>{v.program}</h1>
        <p className="om-claim">{t("books-orgamin.claim")}</p>
        <div className="om-cards">
          <div className="om-quiz"><h2>{t("books-orgamin.quiz.title")}</h2><p>{t("books-orgamin.quiz.text")}</p><a className="om-cta" href="#om-shop" onClick={jump("om-shop")}>{t("books-orgamin.quiz.start")}</a></div>
          <div className="om-pc"><h2>{t("books-orgamin.card.title")}</h2><p>{t("books-orgamin.card.text")}</p><strong>{t("books-orgamin.box.price", { price: cheapest })}</strong></div>
        </div>
      </section>
      <section className="om-crowd"><p>{t("books-orgamin.crowd")}</p><strong>{t("books-orgamin.users")}</strong></section>
      <section className="om-sheet"><Feats /></section>
      <section id="om-shop" className="om-sheet"><h2>{t("books-orgamin.shop.title")}</h2><div className="om-card">{editions}</div></section>
      <section className="om-sheet om-split"><div className="om-card"><Req look="modern" v={v} /><Guide go={go} /></div></section>
      <footer className="om-foot">{legal}<span>{t("books-orgamin.legal.vat")}</span><span>{foot}</span></footer>
    </div>
  );
}
