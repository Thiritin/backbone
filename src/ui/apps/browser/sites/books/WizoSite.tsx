import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./wizo.css";

// WIZO: the friendly blue box from the shelf at the electronics store, then a comparison table once the shop moved online.
const ERAS = [{ from: 2005, look: "classic" }, { from: 2011, look: "modern" }] as const;

export function WizoSite({ game, path, go }: SiteProps) {
  const v = booksVendor("wizo")!, one = editionIn(path), year = yearOf(game.hour);
  const look = eraOf([...ERAS], year);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  return (
    <div className={`wz wz-${look}`}>
      <div className="wz-page">
        <header className="wz-head">
          <span className="wz-logo"><b>WIZO</b> Mein Büro</span>
          <span className="wz-tag">{t("books-vendors.about.wizo")}</span>
        </header>
        <nav className="wz-nav">
          <a href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("books-editions.nav")}</a>
        </nav>
        <main className="wz-main">
          {look === "classic" && <div className="wz-box" aria-hidden="true"><b>WIZO</b><span>Mein Büro</span></div>}
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} table={look === "modern"} />
        </main>
        <footer className="wz-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
      </div>
    </div>
  );
}
