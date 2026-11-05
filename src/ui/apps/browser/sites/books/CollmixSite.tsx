import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksHost, booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { BOOKS_GUIDE_ROUTE } from "./guide-route";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./collmix.css";

// Kontomix barely changed: a table-layout page in 2005, a tabbed beige page around 2010, a sidebar page from 2015.
const ERAS = [{ from: 2005, look: "plain" }, { from: 2010, look: "tabs" }, { from: 2015, look: "side" }] as const;
type Look = (typeof ERAS)[number]["look"];

const k = (key: string) => t(`books-site-collmix.${key}`);
const jump = (id: string) => (e: MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView?.(); };

// A ruled ledger sheet with a bold K, flat shapes only.
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="cx-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="3" fill="var(--cx-accent)" />
      <rect x="6" y="9" width="20" height="1.6" fill="#fff" opacity="0.45" />
      <rect x="6" y="14" width="20" height="1.6" fill="#fff" opacity="0.45" />
      <rect x="6" y="19" width="20" height="1.6" fill="#fff" opacity="0.45" />
      <rect x="9" y="7" width="4" height="18" fill="#fff" />
      <polygon points="14,16 21,7 26,7 18.5,16" fill="#fff" />
      <polygon points="14,16 18.5,16 26,25 21,25" fill="#fff" />
    </svg>
  );
}

const Wordmark = () => <span className="cx-word"><Mark /><span><b>konto</b>mix</span></span>;

export function CollmixSite({ game, path, go }: SiteProps) {
  const v = booksVendor("collmix")!, one = editionIn(path), year = yearOf(game.hour);
  const look: Look = eraOf([...ERAS], year);
  const to = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const home = to(booksUrl(v)), guide = to(BOOKS_GUIDE_ROUTE);
  const mail = `info@${booksHost(v)}`;

  const download = (
    <section id="download" className="cx-dl">
      <h2>{k("download")}</h2>
      <h3>{look === "plain" ? k("plain.trial") : k("nav.trial")}</h3>
      <p>{k(`${look}.trialText`)}</p>
      <h3>{k("req")}</h3>
      <ul>{k(`${look}.req`).split("|").map((r) => <li key={r}>{r}</li>)}</ul>
      <p><a href={BOOKS_GUIDE_ROUTE} onClick={guide}>{k("guide")}</a></p>
    </section>
  );
  const editions = <Editions game={game} v={v} one={one} table={look !== "plain"} />;
  const legal = <span className="cx-legal"><span>{k("imprint")}</span><span>{k("terms")}</span><span>{k("privacy")}</span></span>;
  const foot = (
    <footer className="cx-foot" id="contact">
      <span>{t("books-vendors.footer", { year, name: v.name })}</span>
      <span>{k("address")} | {mail}</span>
      {legal}
    </footer>
  );
  const nav = (items: [string, string][]) => items.map(([id, label]) => <a key={id} href={`#${id}`} onClick={jump(id)}>{label}</a>);
  const homeLink = <a href="#home" aria-current={one ? undefined : "page"} onClick={home}>{k("nav.home")}</a>;

  if (look === "plain") {
    return (
      <div className="cx cx-plain">
        <table className="cx-frame" cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr><td colSpan={2} className="cx-top"><Wordmark /><span className="cx-tag">{t("books-vendors.about.collmix")}</span></td></tr>
            <tr><td colSpan={2} className="cx-menu">
              {homeLink} | {nav([["features", k("nav.features")], ["editions", k("prices")], ["download", k("nav.download")], ["contact", k("nav.contact")]]).flatMap((a, i) => (i ? [" | ", a] : [a]))}
            </td></tr>
            <tr>
              <td className="cx-left"><b>{k("plain.news")}</b><p>{k("plain.n1")}</p><p>{k("plain.n2")}</p></td>
              <td className="cx-body">
                <h1>{k("plain.h1")}</h1>
                <p>{k("plain.intro")}</p>
                <div id="features"><p>{k("plain.f1")}</p><p>{k("plain.f2")}</p><p>{k("plain.f3")}</p></div>
                <h2 id="editions">{k("prices")}</h2>
                {editions}
                {download}
              </td>
            </tr>
            <tr><td colSpan={2}>{foot}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (look === "tabs") {
    return (
      <div className="cx cx-tabs">
        <div className="cx-wrap">
          <header className="cx-bar">
            <Wordmark />
            <nav>{homeLink}{nav([["editions", k("nav.products")], ["features", k("nav.features")], ["refs", k("nav.refs")], ["download", k("nav.trial")], ["contact", k("nav.contact")]])}</nav>
          </header>
          <section className="cx-hero">
            <h1>{k("tabs.h1")}</h1>
            <p>{k("tabs.sub")}</p>
            <a className="cx-cta" href="#download" onClick={jump("download")}>{k("nav.trial")}</a>
          </section>
          <div className="cx-boxes" id="features">
            {(["b1", "b2", "b3"] as const).map((b) => <div key={b} className="cx-box"><h2>{k(`tabs.${b}h`)}</h2><p>{k(`tabs.${b}p`)}</p></div>)}
          </div>
          <section id="editions" className="cx-card"><h2>{k("prices")}</h2>{editions}</section>
          <section id="refs" className="cx-ref"><blockquote>{k("tabs.quote")}</blockquote><cite>{k("tabs.by")}</cite></section>
          <div className="cx-card">{download}</div>
          {foot}
        </div>
      </div>
    );
  }

  const checks = ["c1", "c2", "c3"] as const, steps = ["s1", "s2", "s3"] as const;
  return (
    <div className="cx cx-side">
      <header className="cx-top">
        <Wordmark />
        <nav>{homeLink}{nav([["editions", k("nav.products")], ["download", k("nav.download")], ["contact", k("nav.contact")]])}</nav>
      </header>
      <div className="cx-cols">
        <aside className="cx-aside">
          <h3>{k("nav.products")}</h3>
          <ul>
            {v.editions.map((e) => <li key={e.id}><a href={`#${e.id}`} aria-current={one === e.id ? "page" : undefined} onClick={to(booksUrl(v, e.id))}>{v.program} {e.name}</a></li>)}
            <li><a href="#download" onClick={jump("download")}>{k("nav.download")}</a></li>
          </ul>
        </aside>
        <main className="cx-main">
          <section className="cx-hero">
            <h1>{k("side.h1")}</h1>
            <p>{k("side.sub")}</p>
            <ul className="cx-checks">{checks.map((c) => <li key={c}>{k(`side.${c}`)}</li>)}</ul>
          </section>
          <section className="cx-steps">
            <h2>{k("side.steps")}</h2>
            <ol>{steps.map((s) => <li key={s}>{k(`side.${s}`)}</li>)}</ol>
          </section>
          <section id="editions" className="cx-card">{editions}</section>
          <div className="cx-card">{download}</div>
        </main>
      </div>
      {foot}
    </div>
  );
}
