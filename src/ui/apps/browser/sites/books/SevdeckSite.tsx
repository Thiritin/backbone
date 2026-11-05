import type { MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksAppUrl, booksHost, booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./sevdeck.css";

// A white startup page with a teal band (2013), a navy dashboard page with a coral accent (2018), a dark rounded page (2024).
const ERAS = [{ from: 2013, look: "flat" }, { from: 2018, look: "dash" }, { from: 2024, look: "v2" }] as const;
type Look = (typeof ERAS)[number]["look"];

const k = (key: string) => t(`books-site-sevdeck.${key}`);
const jump = (id: string) => (e: MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView?.(); };

// An eight made of two rings above a desk line, flat shapes only.
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="ed-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--ed-accent)" />
      <circle cx="16" cy="10.5" r="4" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="16" cy="19" r="5" fill="none" stroke="#fff" strokeWidth="2.6" />
      <rect x="7" y="26" width="18" height="2.4" rx="1.2" fill="#fff" opacity="0.6" />
    </svg>
  );
}

const Wordmark = () => <span className="ed-word"><Mark /><span>eight<b>Desk</b></span></span>;
const Bars = ({ h }: { h: number[] }) => <span className="ed-bars">{h.map((n, i) => <i key={i} style={{ height: `${n}%` }} />)}</span>;

export function SevdeckSite({ game, path, go }: SiteProps) {
  const v = booksVendor("sevdeck")!, one = editionIn(path), year = yearOf(game.hour);
  const look: Look = eraOf([...ERAS], year);
  const to = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const guide = to(BOOKS_GUIDE_ROUTE);
  const login = <a className="ed-login" href="#login" onClick={to(booksAppUrl(v))}>{k("nav.login")}</a>;
  const cta = <a className="ed-cta" href="#download" onClick={jump("download")}>{k("try")}</a>;
  const nav = (
    <nav className="ed-nav">
      <a href="#home" aria-current={one ? undefined : "page"} onClick={to(booksUrl(v))}>{t("books-editions.nav")}</a>
      <a href="#features" onClick={jump("features")}>{k("nav.features")}</a>
      <a href="#editions" onClick={jump("editions")}>{k("nav.pricing")}</a>
      <a href="#download" onClick={jump("download")}>{k("nav.download")}</a>
      {login}
    </nav>
  );
  const editions = <section id="editions" className="ed-plans"><h2>{k("nav.pricing")}</h2><Editions game={game} v={v} one={one} table /></section>;
  const download = (
    <section id="download" className="ed-dl">
      <div>
        <h2>{k("download")}</h2>
        <p>{k(`${look}.dl`)}</p>
        <a className="ed-guide" href={BOOKS_GUIDE_ROUTE} onClick={guide}>{k("guide")}</a>
      </div>
      <div>
        <h3>{k("req")}</h3>
        <ul>{k(`${look}.req`).split("|").map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
    </section>
  );
  const copy = t("books-vendors.footer", { year, name: v.name });
  const legal = <span className="ed-legal"><span>{k("imprint")}</span><span>{k("terms")}</span><span>{k("privacy")}</span></span>;
  const quote = (key: string): ReactNode => <section className="ed-quote"><blockquote>{k(`${key}.quote`)}</blockquote><cite>{k(`${key}.by`)}</cite></section>;

  if (look === "flat") {
    return (
      <div className="ed ed-flat">
        <header className="ed-top"><Wordmark />{nav}</header>
        <section className="ed-hero">
          <div>
            <h1>{k("flat.h1")}</h1>
            <p>{k("flat.sub")}</p>
            {cta}
          </div>
          <div className="ed-sheet" aria-hidden="true">
            <b>{k("flat.mock")}</b>
            <i style={{ width: "70%" }} /><i style={{ width: "90%" }} /><i style={{ width: "55%" }} />
            <span className="num">{euro(1190)}</span>
          </div>
        </section>
        <section id="features" className="ed-trio">
          {(["f1", "f2", "f3"] as const).map((f, n) => <div key={f}><span className={`ed-dot ed-dot-${n}`} /><h3>{k(`flat.${f}h`)}</h3><p>{k(`flat.${f}p`)}</p></div>)}
        </section>
        {editions}
        {download}
        <footer className="ed-foot"><span>{copy}</span><span>{k("address")}</span>{legal}</footer>
      </div>
    );
  }

  if (look === "dash") {
    return (
      <div className="ed ed-dash">
        <header className="ed-top"><Wordmark />{nav}</header>
        <section className="ed-hero">
          <div>
            <h1>{k("dash.h1")}</h1>
            <p>{k("dash.sub")}</p>
            {cta}
          </div>
          <div className="ed-window" aria-hidden="true">
            <div className="ed-winbar"><i /><i /><i /></div>
            <div className="ed-tiles">
              <div><small>{k("dash.mockRev")}</small><b className="num">{euro(48250)}</b><Bars h={[30, 45, 38, 60, 52, 78, 90]} /></div>
              <div><small>{k("dash.mockTax")}</small><b className="num">{euro(9170)}</b></div>
              <div><small>{k("dash.mockOpen")}</small><b className="num">{euro(3640)}</b></div>
            </div>
          </div>
        </section>
        <section className="ed-stats">{(["st1", "st2", "st3"] as const).map((s) => <b key={s}>{k(`dash.${s}`)}</b>)}</section>
        <section id="features" className="ed-zig">
          {(["z1", "z2", "z3"] as const).map((z, n) => (
            <div key={z} className={n % 2 ? "ed-row ed-flip" : "ed-row"}>
              <div><h3>{k(`dash.${z}h`)}</h3><p>{k(`dash.${z}p`)}</p></div>
              <div className={`ed-vis ed-vis-${n}`} aria-hidden="true"><i /><i /><i /></div>
            </div>
          ))}
        </section>
        {quote("dash")}
        {editions}
        {download}
        <footer className="ed-foot"><span>{copy}</span><span>{k("address")}</span>{legal}</footer>
      </div>
    );
  }

  const mail = `hallo@${booksHost(v)}`;
  return (
    <div className="ed ed-v2">
      <header className="ed-top"><Wordmark />{nav}</header>
      <section className="ed-hero">
        <h1>{k("v2.h1")}</h1>
        <p>{k("v2.sub")}</p>
        <div className="ed-chips">{(["chip1", "chip2", "chip3"] as const).map((c) => <span key={c}>{k(`v2.${c}`)}</span>)}</div>
        {cta}
      </section>
      <section id="features" className="ed-bento">
        {(["b1", "b2", "b3", "b4"] as const).map((b) => <div key={b} className={`ed-cell ed-${b}`}><h3>{k(`v2.${b}h`)}</h3><p>{k(`v2.${b}p`)}</p></div>)}
      </section>
      {quote("v2")}
      {editions}
      {download}
      <footer className="ed-foot">
        <div className="ed-cols">
          <div><h4>{k("v2.colProduct")}</h4><a href="#features" onClick={jump("features")}>{k("nav.features")}</a><a href="#editions" onClick={jump("editions")}>{k("nav.pricing")}</a><a href="#download" onClick={jump("download")}>{k("nav.download")}</a></div>
          <div><h4>{k("v2.colLegal")}</h4><span>{k("imprint")}</span><span>{k("terms")}</span><span>{k("privacy")}</span></div>
          <div><h4>{k("v2.colContact")}</h4><span>{k("address")}</span><span>{mail}</span></div>
        </div>
        <p>{copy}</p>
      </footer>
    </div>
  );
}
