import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./collmix.css";

// Collmix kept its sparse web-app page for years before a price table arrived.
const ERAS = [{ from: 2005, look: "plain" }, { from: 2012, look: "table" }] as const;

export function CollmixSite({ game, path, go }: SiteProps) {
  const v = booksVendor("collmix")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf([...ERAS], year);
  const home = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  return (
    <div className={`cx cx-${look}`}>
      <div className="cx-page">
        <header className="cx-head">
          <span className="cx-logo"><b>coll</b>mix</span>
          <span className="cx-tag">{t("books-vendors.about.collmix")}</span>
        </header>
        <nav className="cx-nav"><a href="#home" aria-current={one ? undefined : "page"} onClick={home}>{t("books-editions.nav")}</a></nav>
        <main className="cx-main">
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} table={look === "table"} />
        </main>
        <footer className="cx-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
      </div>
    </div>
  );
}
