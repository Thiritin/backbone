import type { MouseEvent } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor } from "../../../../../sim/10-catalog/bookkeeping";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { eraOf } from "../era";
import { editionIn, Editions, type SiteProps } from "./VendorShop";
import "./lexoffize.css";

// The 2014 launch site in sky blue on white; the 2020 refresh moves to a navy hero.
const ERAS = [{ from: 2014, look: "lo-launch" }, { from: 2020, look: "lo-refresh" }];

export function LexoffizeSite({ game, path, go }: SiteProps) {
  const v = booksVendor("lexoffize")!, one = editionIn(path), year = yearOf(game.hour);
  const home = (e: MouseEvent) => { e.preventDefault(); go(booksUrl(v)); };
  return (
    <div className={`lo ${eraOf(ERAS, year)}`}>
      <header className="lo-head">
        <a className="lo-logo" href="#home" onClick={home}>lex<b>offize</b><i>.</i></a>
        <nav className="lo-nav">
          <a href="#home" aria-current={one ? undefined : "page"} onClick={home}>{t("books-editions.nav")}</a>
        </nav>
      </header>
      <section className="lo-hero">
        <h1>{v.program}</h1>
        <p>{t("books-vendors.about.lexoffize")}</p>
      </section>
      <main className="lo-main">
        <Editions game={game} v={v} one={one} table />
      </main>
      <footer className="lo-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
    </div>
  );
}
