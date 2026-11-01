import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { booksVendor, type BooksVendor, type BooksVendorId, type Edition } from "../../../../../sim/10-catalog/bookkeeping";
import type { GameState } from "../../../../../sim/50-state";
import { booksUrl, currentEdition, licencePrice } from "../../../../../sim/80-business/bookkeeping";
import { installBooks, setSeats, upgradeBooks } from "../../../../../sim/90-actions/bookkeeping";
import { usePageAct } from "../../pageAct";
import "./books-vendors.css";

export interface SiteProps { game: GameState; path: string; go: (url: string) => void }
// brand, ink, page and font give the vendor's look; flat drops the 2005 bevels for the cloud vendors.
export interface Look { brand: string; ink: string; page: string; font: string; flat?: boolean }

// The edition a site's path names, as in www.wizo.de/edition/l.
export const editionIn = (path: string): string | undefined => /^\/edition\/([\w-]+)/.exec(path)?.[1];

const amount = (v: BooksVendor, n: number) => (v.deployment === "browser" ? t("books-editions.perMonth", { price: euro(n) }) : euro(n));
const users = (e: Edition) => (e.users === Infinity ? t("books-editions.network") : e.seat ? t("books-editions.perSeat", { n: e.users }) : e.users > 1 ? t("books-editions.users", { n: e.users }) : t("books-editions.single"));

function Action({ game, v, e }: { game: GameState; v: BooksVendor; e: Edition }) {
  const act = usePageAct();
  const running = game.books.vendor === v.id, now = running ? currentEdition(game) : undefined;
  if (now?.id === e.id) return <span className="bv-state">{t("books-editions.yours")}</span>;
  if (!running) return <button type="button" className="bv-buy" onClick={() => act(installBooks, v.id, e.id)}>{t("vendor-sites.buy")}</button>;
  if (v.deployment === "desktop" && now && e.price < now.price) return null;
  const price = licencePrice(game, v, e);
  return <button type="button" className="bv-buy" onClick={() => act(upgradeBooks, e.id)}>{v.deployment === "desktop" ? t("books-editions.upgradeFor", { price: euro(price) }) : t("books-editions.switch")}</button>;
}

function Seats({ game, v, e }: { game: GameState; v: BooksVendor; e: Edition }) {
  const act = usePageAct(), n = game.books.seats;
  return (
    <div className="bv-row">
      <span>{t("books-editions.seats", { n })}</span>
      <span className="num">{amount(v, e.seat)}</span>
      {v.deployment === "browser" && n > 0 && <button type="button" className="bv-buy" onClick={() => act(setSeats, n - 1)}>−</button>}
      <button type="button" className="bv-buy" onClick={() => act(setSeats, n + 1)}>+</button>
    </div>
  );
}

// The vendor's editions with their price, users and features, and the seats of the edition the company runs.
export function Editions({ game, v, one }: { game: GameState; v: BooksVendor; one?: string }) {
  const shown = one ? v.editions.filter((e) => e.id === one) : v.editions;
  const now = game.books.vendor === v.id ? currentEdition(game) : undefined;
  return (
    <ul className="bv-list">
      {shown.map((e) => (
        <li key={e.id}>
          <h2>{v.program} {e.name}</h2>
          <ul className="bv-features">
            {e.features.map((f) => <li key={f}>{t(`books-editions.feature.${f}`)}</li>)}
            <li>{users(e)}</li>
          </ul>
          <div className="bv-row">
            <span className="num bv-amount">{e.price ? amount(v, e.price) : t("books-editions.free")}</span>
            {e.update > 0 && <span>{t("books-vendors.priceUpdates", { price: euro(e.update) })}</span>}
            <Action game={game} v={v} e={e} />
          </div>
          {now?.id === e.id && e.seat > 0 && <Seats game={game} v={v} e={e} />}
        </li>
      ))}
    </ul>
  );
}

// A bookkeeping vendor's shop: its editions, or the one edition the path names.
export function VendorShop({ game, path, go, id, logo, look }: SiteProps & { id: BooksVendorId; logo: ReactNode; look: Look }) {
  const v = booksVendor(id)!, one = editionIn(path);
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url); };
  const style = { "--bv-brand": look.brand, "--bv-ink": look.ink, "--bv-page": look.page, "--bv-font": look.font } as CSSProperties;
  return (
    <div className={look.flat ? "bv flat" : "bv"} style={style}>
      <div className="bv-page">
        <header className="bv-head">{logo}<span className="bv-tag">{t(`books-vendors.about.${v.id}`)}</span></header>
        <nav className="bv-nav"><a href="#home" aria-current={one ? undefined : "page"} onClick={link(booksUrl(v))}>{t("books-editions.nav")}</a></nav>
        <main className="bv-main">
          <h1>{v.program}</h1>
          <Editions game={game} v={v} one={one} />
        </main>
        <footer className="bv-foot">{t("books-vendors.footer", { year: yearOf(game.hour), name: v.name })}</footer>
      </div>
    </div>
  );
}
