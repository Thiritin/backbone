import type { MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor, type BooksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./wizo.css";

// WARUM: a dense retail portal in 2005, a glossy web shop around 2010, flat pages from 2015, a dark marketing site from 2020.
const ERAS = [{ from: 2005, look: "portal" }, { from: 2010, look: "shop" }, { from: 2015, look: "flat" }, { from: 2020, look: "modern" }] as const;
// Processor GHz, memory MB and screen the program asks for in each era.
const REQ = { portal: [1, 512, "1024 x 768"], shop: [2, 1024, "1280 x 800"], flat: [2, 2048, "1366 x 768"], modern: [3, 4096, "1920 x 1080"] } as const;

const num = (n: number) => n.toLocaleString(LOCALE);
const stay = (e: MouseEvent) => e.preventDefault();
const jump = (id: string) => (e: MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView?.({ block: "start" }); };

// A blue tile with a yellow question mark.
function Mark({ size }: { size: number }) {
  return (
    <svg className="wz-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1f5fa8" />
      <path d="M11 12.5a5 5 0 1 1 7 4.6c-1.3.6-2 1.4-2 2.9" fill="none" stroke="#ffc928" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="25" r="1.9" fill="#ffc928" />
    </svg>
  );
}

const Brand = ({ size, v }: { size: number; v: BooksVendor }) => (
  <span className="wz-logo"><Mark size={size} /><b>{v.name}</b><i>{v.program.slice(v.name.length + 1)}</i></span>
);

function Req({ look, v }: { look: keyof typeof REQ; v: BooksVendor }) {
  const [ghz, ram, res] = REQ[look];
  return (
    <div id="wz-download" className="wz-download">
      <h2>{t("books-wizo.download.title")}</h2>
      <h3>{t("books-wizo.req.title")}</h3>
      <div className="wz-req">
        <p>{t("books-wizo.req.cpu", { n: ghz })}</p>
        <p>{t("books-wizo.req.ram", { n: num(ram) })}</p>
        <p>{t("books-wizo.req.disk", { n: num(v.setupMb ?? 0) })}</p>
        <p>{t("books-wizo.req.screen", { res })}</p>
      </div>
    </div>
  );
}

const Guide = ({ go }: { go: (url: string) => void }) => (
  <a className="wz-guide" href={BOOKS_GUIDE_ROUTE} onClick={(e) => { e.preventDefault(); go(BOOKS_GUIDE_ROUTE); }}>{t("books-wizo.guide")}</a>
);

const FEATS = [1, 2, 3] as const;
const Feats = () => (
  <div className="wz-feats">
    {FEATS.map((n) => <section key={n}><span className={`wz-ico wz-ico${n}`} aria-hidden="true" /><h3>{t(`books-wizo.feat.${n}.t`)}</h3><p>{t(`books-wizo.feat.${n}.d`)}</p></section>)}
  </div>
);

export function WizoSite({ game, path, go }: SiteProps) {
  const v = booksVendor("wizo")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf([...ERAS], year);
  const home = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const nav = (items: string[], cls?: string): ReactNode => items.map((k, i) => (
    <a key={k} className={cls} href="#" aria-current={i === 0 && !one ? "page" : undefined} onClick={i === 0 ? home : stay}>{t(`books-wizo.nav.${k}`)}</a>
  ));
  const editions = <Editions game={game} v={v} one={one} table={look === "flat" || look === "modern"} />;
  const legal = ["imprint", "terms", "privacy"].map((k) => <a key={k} href="#" onClick={stay}>{t(`books-wizo.legal.${k}`)}</a>);
  const foot = t("books-vendors.footer", { year, name: v.name });

  if (look === "portal") {
    return (
      <div className="wz wz-portal">
        <table className="wz-layout" cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr><td colSpan={3} className="wz-linkbar">{nav(["home", "products", "guarantee", "press", "contact", "support"])}</td></tr>
            <tr>
              <td colSpan={3} className="wz-top">
                <Brand size={36} v={v} />
                <span className="wz-util">
                  <span className="wz-search"><input readOnly aria-label={t("books-wizo.search")} value={t("books-wizo.search")} /><button type="button" onClick={stay}>OK</button></span>
                  <a href="#" onClick={stay}>{t("books-wizo.account")}</a> | <a href="#" onClick={stay}>{t("books-wizo.newsletter")}</a> | <b>{t("books-wizo.cart", { n: 0 })}</b>
                </span>
              </td>
            </tr>
            <tr>
              <td className="wz-left">
                {["tax", "finance", "office", "free"].map((k) => <a key={k} href="#" className={k === "office" ? "on" : undefined} onClick={stay}>{t(`books-wizo.world.${k}`)}</a>)}
              </td>
              <td className="wz-mid">
                <div className="wz-tabs">{["description", "more", "prices", "voices"].map((k, i) => <a key={k} href="#" className={i === 0 ? "on" : undefined} onClick={stay}>{t(`books-wizo.tab.${k}`)}</a>)}</div>
                <div className="wz-intro">
                  <div className="wz-boxshot" aria-hidden="true"><b>{v.name}</b><span>{v.program.slice(v.name.length + 1)}</span></div>
                  <h1>{v.program}</h1>
                  <p className="wz-claim">{t("books-wizo.claim")}</p>
                  <p>{t("books-wizo.lead")}</p>
                </div>
                {editions}
                <Req look="portal" v={v} />
                <p><Guide go={go} /></p>
              </td>
              <td className="wz-right">
                <div className="wz-yellow"><a href="#wz-download" onClick={jump("wz-download")}>{t("books-wizo.trial")}</a></div>
                <div className="wz-note"><b>{t("books-wizo.guarantee.title")}</b><p>{t("books-wizo.guarantee.text")}</p></div>
                <div className="wz-note"><p>{t("books-wizo.shipping")}</p></div>
              </td>
            </tr>
            <tr><td colSpan={3} className="wz-foot">{legal}<span>{t("books-wizo.legal.vat")}</span><span>{foot}</span></td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (look === "shop") {
    return (
      <div className="wz wz-shop">
        <header className="wz-head">
          <Brand size={44} v={v} />
          <nav>{nav(["home", "products", "guarantee", "support"])}</nav>
          <a className="wz-cart" href="#" onClick={stay}>{t("books-wizo.cart", { n: 0 })}</a>
        </header>
        <section className="wz-hero">
          <div className="wz-boxshot" aria-hidden="true"><b>{v.name}</b><span>{v.program.slice(v.name.length + 1)}</span></div>
          <div className="wz-herotext">
            <h1>{v.program}</h1>
            <p className="wz-claim">{t("books-wizo.claim")}</p>
            <p>{t("books-wizo.lead")}</p>
            <a className="wz-cta" href="#wz-download" onClick={jump("wz-download")}>{t("books-wizo.trial")}</a>
          </div>
          <span className="wz-burst">{t("books-wizo.badge.new", { year })}</span>
        </section>
        <div className="wz-cols">
          <main>
            <Feats />
            <h2>{t("books-wizo.shop.title")}</h2>
            {editions}
            <Req look="shop" v={v} />
            <p><Guide go={go} /></p>
          </main>
          <aside>
            <blockquote>{t("books-wizo.voice.text")}<cite>{t("books-wizo.voice.who")}</cite></blockquote>
            <div className="wz-side"><b>{t("books-wizo.guarantee.title")}</b><p>{t("books-wizo.guarantee.text")}</p></div>
            <div className="wz-side"><b>{t("books-wizo.newsletter")}</b><p>{t("books-wizo.shipping")}</p></div>
          </aside>
        </div>
        <footer className="wz-foot">
          {(["products", "service", "company"] as const).map((c) => (
            <div key={c}><b>{t(`books-wizo.col.${c}`)}</b>{c === "products" ? ["tax", "finance", "office", "free"].map((k) => <a key={k} href="#" onClick={stay}>{t(`books-wizo.world.${k}`)}</a>) : c === "service" ? nav(["support", "guarantee", "contact"]) : legal}</div>
          ))}
          <p>{t("books-wizo.legal.vat")} {foot}</p>
        </footer>
      </div>
    );
  }

  if (look === "flat") {
    return (
      <div className="wz wz-flat">
        <header className="wz-head">
          <Brand size={30} v={v} />
          <nav>{nav(["home", "products", "guarantee", "support"])}</nav>
          <a className="wz-cta" href="#wz-download" onClick={jump("wz-download")}>{t("books-wizo.trial")}</a>
        </header>
        <section className="wz-hero">
          <h1>{v.program}</h1>
          <p className="wz-claim">{t("books-wizo.claim")}</p>
          <p>{t("books-wizo.lead")}</p>
          <small>{t("books-wizo.trust.users")}</small>
        </section>
        <section className="wz-band"><Feats /></section>
        <section className="wz-band wz-grey">
          <h2>{t("books-wizo.shop.title")}</h2>
          {editions}
        </section>
        <section className="wz-band wz-split">
          <Req look="flat" v={v} />
          <div><h2>{t("books-wizo.guarantee.title")}</h2><p>{t("books-wizo.guarantee.text")}</p><Guide go={go} /></div>
        </section>
        <footer className="wz-foot">
          <div><b>{t("books-wizo.col.service")}</b>{nav(["support", "contact", "press"])}</div>
          <div><b>{t("books-wizo.col.company")}</b>{legal}</div>
          <p>{foot}</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="wz wz-modern">
      <header className="wz-head">
        <Brand size={28} v={v} />
        <nav>{nav(["home", "products", "guarantee", "support"])}</nav>
      </header>
      <section className="wz-hero">
        <span className="wz-pill">{t("books-wizo.trust.test")}</span>
        <h1>{v.program}</h1>
        <p className="wz-claim">{t("books-wizo.claim")}</p>
        <p>{t("books-wizo.lead")}</p>
        <a className="wz-cta" href="#wz-download" onClick={jump("wz-download")}>{t("books-wizo.trial")}</a>
        <small>{t("books-wizo.trust.users")}</small>
      </section>
      <section className="wz-sheet"><Feats /></section>
      <section className="wz-sheet wz-pricing">
        <h2>{t("books-wizo.shop.title")}</h2>
        <div className="wz-card">{editions}</div>
      </section>
      <section className="wz-sheet wz-split">
        <div className="wz-card"><Req look="modern" v={v} /><Guide go={go} /></div>
        <div>
          <h2>{t("books-wizo.faq.title")}</h2>
          {[1, 2].map((n) => <details key={n}><summary>{t(`books-wizo.faq.q${n}`)}</summary><p>{t(`books-wizo.faq.a${n}`)}</p></details>)}
        </div>
      </section>
      <footer className="wz-foot">{legal}<span>{foot}</span></footer>
      <div className="wz-cookies"><span>{t("books-wizo.cookies.text")}</span><button type="button" onClick={stay}>{t("books-wizo.cookies.accept")}</button></div>
    </div>
  );
}
