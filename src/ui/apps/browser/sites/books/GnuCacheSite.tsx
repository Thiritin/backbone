import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./gnucache.css";

// A project page on a forge until the 2013 redesign. With one free edition there is nothing to compare, so the list stays.
const ERAS = [{ from: 2005, look: "forge" }, { from: 2013, look: "modern" }] as const;
// The stable release the project page announces in a year.
const RELEASES = [
  { from: 2005, look: "1.8" }, { from: 2006, look: "2.0" }, { from: 2007, look: "2.2" }, { from: 2010, look: "2.4" },
  { from: 2013, look: "2.6" }, { from: 2018, look: "3.0" }, { from: 2020, look: "4.0" }, { from: 2023, look: "5.0" },
];

export function GnuCacheSite({ game, path, go }: SiteProps) {
  const v = booksVendor("gnucache")!, one = editionIn(path), year = yearOf(game.hour);
  const link = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  const nav = <a href="#home" aria-current={one ? undefined : "page"} onClick={link}>{t("books-editions.nav")}</a>;
  return (
    <div className={`gc gc-${eraOf([...ERAS], year)}`}>
      <header className="gc-head">
        <span className="gc-logo"><b>Gnu</b>Cache</span>
        <span className="gc-tag">{t("books-vendors.about.gnucache")}</span>
      </header>
      <div className="gc-body">
        <nav className="gc-nav">
          {nav}
          <span className="gc-release">{`GnuCache ${eraOf(RELEASES, year)}`}</span>
        </nav>
        <main className="gc-main">
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} />
        </main>
      </div>
      <footer className="gc-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
    </div>
  );
}
