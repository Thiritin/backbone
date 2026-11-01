import type { CSSProperties, MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import type { GameState } from "../../../../../sim/50-state";
import { booksUrl, LEXWEAR_HOST } from "../../../../../sim/80-business/bookkeeping";
import { editionIn, Editions } from "../books/VendorShop";
import "./lexwear.css";

const SUPPORT = `www.${LEXWEAR_HOST}/support`;
// A software box drawn in CSS, its spine darker with each edition.
const HUE = [210, 150, 20];

export function LexwearSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const v = booksVendor("lexwear")!, one = editionIn(path);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const page = path.startsWith("/support") ? "support" : "home";
  const nav: [string, string, string][] = [["home", t("books-editions.nav"), booksUrl(v)], ["support", t("vendor-sites.navSupport"), SUPPORT]];
  return (
    <div className="lx">
      <div className="lx-page">
        <header className="lx-head">
          <span className="lx-logo">lex<b>wear</b></span>
          <span className="lx-tag">{t("vendor-sites.tagline")}</span>
        </header>
        <nav className="lx-nav">
          {nav.map(([k, label, url]) => <a key={k} href={`#${k}`} aria-current={k === page ? "page" : undefined} onClick={link(url)}>{label}</a>)}
        </nav>
        <main className="lx-main">
          {page === "support" ? <><h1>{t("vendor-sites.navSupport")}</h1><p>{t("vendor-sites.support")}</p></> : (
            <>
              <h1>{v.program}</h1>
              <div className="lx-boxes" aria-hidden="true">
                {v.editions.filter((e) => !one || e.id === one).map((e) => (
                  <div key={e.id} className="lx-box" style={{ "--lx-hue": HUE[v.editions.indexOf(e)] } as CSSProperties}>
                    <span className="lx-box-brand">{v.name}</span><span className="lx-box-name">{e.name}</span>
                  </div>
                ))}
              </div>
              <Editions game={game} v={v} one={one} />
            </>
          )}
        </main>
        <footer className="lx-foot">{t("vendor-sites.footer", { year: yearOf(game.hour) })}</footer>
      </div>
    </div>
  );
}
