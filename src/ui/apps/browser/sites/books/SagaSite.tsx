import type { CSSProperties, MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./saga.css";

// A business-software group's corporate site: a boxed Verdana page with a green bar until the 2010 rebrand, then a wide page with a comparison table.
const ERAS = [{ from: 2005, look: "classic" }, { from: 2010, look: "modern" }] as const;
const BRAND = { "--bv-brand": "#00704a", "--bv-ink": "#fff", "--bv-font": "Verdana, Arial, sans-serif" } as CSSProperties;

export function SagaSite({ game, path, go }: SiteProps) {
  const v = booksVendor("saga")!, one = editionIn(path);
  const look = eraOf([...ERAS], yearOf(game.hour));
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  return (
    <div className={`sg sg-${look}`} style={BRAND}>
      <div className="sg-page">
        <header className="sg-head">
          <span className="sg-logo">saga</span>
          <span className="sg-tag">{t("books-vendors.about.saga")}</span>
        </header>
        <nav className="sg-nav">
          <a href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("books-editions.nav")}</a>
        </nav>
        <main className="sg-main">
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} table={look === "modern"} />
        </main>
        <footer className="sg-foot">{t("books-vendors.footer", { year: yearOf(game.hour), name: v.name })}</footer>
      </div>
    </div>
  );
}
