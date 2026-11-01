import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./orgamin.css";

// A homepage the developers built themselves with a left menu, until the 2011 relaunch with a price table.
const ERAS = [{ from: 2005, look: "home" }, { from: 2011, look: "relaunch" }] as const;

export function OrgaminSite({ game, path, go }: SiteProps) {
  const v = booksVendor("orgamin")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf([...ERAS], year);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  return (
    <div className={`om om-${look}`}>
      <header className="om-head">
        <span className="om-logo">orga<b>MIN</b></span>
        <span className="om-tag">{t("books-vendors.about.orgamin")}</span>
      </header>
      <div className="om-body">
        <nav className="om-nav">
          <a href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("books-editions.nav")}</a>
        </nav>
        <main className="om-main">
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} table={look === "relaunch"} />
        </main>
      </div>
      <footer className="om-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
    </div>
  );
}
