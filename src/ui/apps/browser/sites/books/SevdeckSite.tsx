import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./sevdeck.css";

// The flat teal startup page of 2013, then the navy rebrand of 2020 with a coral accent.
const ERAS = [{ from: 2013, look: "sd-flat" }, { from: 2020, look: "sd-brand" }] as const;

export function SevdeckSite({ game, path, go }: SiteProps) {
  const v = booksVendor("sevdeck")!, one = editionIn(path), year = yearOf(game.hour);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  return (
    <div className={`sd ${eraOf([...ERAS], year)}`}>
      <header className="sd-head">
        <span className="sd-logo">sev<b>Deck</b></span>
        <nav className="sd-nav">
          <a href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("books-editions.nav")}</a>
        </nav>
      </header>
      <section className="sd-hero">
        <h1>{v.program}</h1>
        <p>{t("books-vendors.about.sevdeck")}</p>
      </section>
      <main className="sd-main">
        <Editions game={game} v={v} one={one} table />
      </main>
      <footer className="sd-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
    </div>
  );
}
