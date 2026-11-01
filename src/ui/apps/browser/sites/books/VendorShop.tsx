import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { BOOK_MODULES, booksVendor, modulePrice, type BooksVendor, type BooksVendorId } from "../../../../../sim/10-catalog/bookkeeping";
import { hasModule, moduleById } from "../../../../../sim/10-catalog/modules";
import type { GameState } from "../../../../../sim/50-state";
import { booksUrl } from "../../../../../sim/80-business/bookkeeping";
import { bought } from "../../../../../sim/80-business/lexwear";
import { buyLicence } from "../../../../../sim/90-actions/lexwear";
import { useStore } from "../../../../store";
import "./books-vendors.css";

export interface SiteProps { game: GameState; path: string; go: (url: string) => void }
// brand, ink, page and font give the vendor's look; flat drops the 2005 bevels for the cloud vendors.
export interface Look { brand: string; ink: string; page: string; font: string; flat?: boolean }

const name = (id: string) => t(`vendor-sites.module.${id}`);
const pitch = (v: BooksVendor, id: string) => (id === "hbci" ? t("books-vendors.pitchHbci", { program: v.program }) : t(`vendor-sites.pitch.${id}`));

function State({ game, v, id }: { game: GameState; v: BooksVendor; id: string }) {
  const act = useStore((s) => s.act);
  const price = modulePrice(v, id), running = game.books.vendor === v.id;
  if (price === "included") return <span className="bv-state">{t("books-vendors.included")}</span>;
  if (running && hasModule(game, id)) return <span className="bv-state">{t(v.keys ? "vendor-sites.registered" : "books-vendors.active")}</span>;
  if (v.keys && bought(game, id, v.id)) return <span className="bv-state">{t("vendor-sites.bought")}</span>;
  if (!v.keys && !running) return <span className="bv-muted">{t("books-vendors.needs", { program: v.program })}</span>;
  return <button type="button" className="bv-buy" onClick={() => act(buyLicence, id, v.id)}>{t("vendor-sites.buy")}</button>;
}

// A bookkeeping vendor's shop on the Lexwear pattern: the modules it sells this year, one page per module.
export function VendorShop({ game, path, go, id, logo, look }: SiteProps & { id: BooksVendorId; logo: ReactNode; look: Look }) {
  const v = booksVendor(id)!, year = yearOf(game.hour);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const shown = BOOK_MODULES.filter((m) => modulePrice(v, m) !== "never" && moduleById(m)!.year <= year);
  const one = /^\/module\/([\w-]+)/.exec(path)?.[1];
  const list = one && shown.includes(one) ? [one] : shown;
  const style = { "--bv-brand": look.brand, "--bv-ink": look.ink, "--bv-page": look.page, "--bv-font": look.font } as CSSProperties;
  return (
    <div className={look.flat ? "bv flat" : "bv"} style={style}>
      <div className="bv-page">
        <header className="bv-head">{logo}<span className="bv-tag">{t(`books-vendors.about.${v.id}`)}</span></header>
        <nav className="bv-nav"><a href="#home" aria-current={list === shown ? "page" : undefined} onClick={link(booksUrl(v))}>{t("vendor-sites.navModules")}</a></nav>
        <main className="bv-main">
          <h1>{t("books-vendors.heading", { program: v.program })}</h1>
          <ul className="bv-list">
            {list.map((m) => {
              const price = modulePrice(v, m);
              return (
                <li key={m}>
                  <h2><a href={`#${m}`} onClick={link(booksUrl(v, m))}>{name(m)}</a></h2>
                  <p>{pitch(v, m)}</p>
                  <div className="bv-row">
                    {typeof price === "number" && <span className="num bv-amount">{euro(price)}</span>}
                    <State game={game} v={v} id={m} />
                  </div>
                </li>
              );
            })}
          </ul>
        </main>
        <footer className="bv-foot">{t("books-vendors.footer", { year, name: v.name })}</footer>
      </div>
    </div>
  );
}
