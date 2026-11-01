import type { FormEvent, ReactNode } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import { bidHistory, onMarket, type Listing } from "../../../../../sim/10-catalog/used";
import type { GameState } from "../../../../../sim/50-state";
import { Isometric } from "../../../../art/Isometric";
import { BrandLogo } from "../../../../art/logos";
import { t } from "../../../../../i18n/en";
import { BidHistory, BuyBox, cpuName, facets, Facts, filtered, leads, listingName, listingRows, MyListings, onChannel, priceNow, queryOf, timeLeft, useShipTo, withQuery, type MarketProps, type MarketQuery, type MarketSort } from "./shared";
import "./ebuy.css";

// 2005: dense table under yellow and blue tabs; 2012: refinement bar over a list; 2019: flat filter pills over cards.
type Look = "y05" | "y12" | "y19";
type Patch = Parameters<typeof withQuery>[1];
type Href = (to: string) => { href: string; onClick: (e: { preventDefault: () => void }) => void };
interface Ctx { game: GameState; look: Look; to: string; href: Href; ship: ReactNode }

const SORTS: MarketSort[] = ["end", "new", "price", "priceDesc"];
const bids = (game: GameState, l: Listing) => bidHistory(l, game.hour).filter((b) => b.by !== "start").length;
const item = (l: Listing) => `/itm/${l.id}`;
const Pic = ({ l, w }: { l: Listing; w: number }) => <Isometric model={modelById(l.model)} brand={l.brand} w={w} count={Math.min(l.qty, 4)} />;
const Pill = ({ game, l }: { game: GameState; l: Listing }) =>
  l.bid ? <span className={`eb-pill ${leads(game, l) ? "ok" : "warn"}`}>{leads(game, l) ? t("shop.leading") : t("shop.outbid")}</span> : null;
const Maker = ({ game, l }: { game: GameState; l: Listing }) => <span className="eb-maker"><BrandLogo brand={l.brand} size={14} />{l.brand}<Pill game={game} l={l} /></span>;

export function Ebuy({ game, path, year, go }: MarketProps) {
  const look: Look = year < 2010 ? "y05" : year < 2019 ? "y12" : "y19";
  const [to, setTo] = useShipTo(game);
  const route = path.split("?")[0], q = queryOf(path), results = route === "/" || route.startsWith("/sch");
  const here = results ? `/sch/${path.slice(route.length)}` : "/sch/";
  const href: Href = (p) => ({ href: `#${p}`, onClick: (e) => { e.preventDefault(); go(p); } });
  const search = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); go(withQuery(here, { q: String(new FormData(e.currentTarget).get("q") ?? "") })); };
  const ship = (
    <label className="eb-ship"><span>{t("shop.shipTo")}</span>
      <select value={to} onChange={(e) => setTo(e.target.value)}>{game.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </label>
  );
  const c: Ctx = { game, look, to, href, ship }, mine = route.startsWith("/myebuy");
  return (
    <div className={`mk-ebuy ${look}`}>
      <header>
        <a className="eb-logo" aria-label="eBuy" {...href("/")}><i>e</i><i>b</i><i>u</i><i>y</i></a>
        <nav>
          <a {...href("/")} aria-current={!mine || undefined}>{t("ebuy.buy")}</a>
          <a {...href("/myebuy")} aria-current={mine || undefined}>{t("ebuy.myEbuy")}</a>
        </nav>
        <form className="eb-search" key={q.q} onSubmit={search}>
          <input name="q" type="search" defaultValue={q.q} aria-label={t("ebuy.search")} />
          <button>{t("ebuy.search")}</button>
        </form>
      </header>
      <main>
        {route.startsWith("/itm/") ? <Item c={c} id={route.slice(5)} /> : mine ? <Mine c={c} /> : <Results c={c} q={q} here={here} go={go} />}
      </main>
      <footer>{t("ebuy.footer", { year })}</footer>
    </div>
  );
}

function Results({ c, q, here, go }: { c: Ctx; q: MarketQuery; here: string; go: (p: string) => void }) {
  const { game, look, href } = c, all = onChannel(game, "ebuy"), list = filtered(game, all, q), f = facets(game, all, q);
  const sch = (patch: Patch) => go(withQuery(here, patch));
  const pick = (k: "cat" | "brand" | "cpu", label: string, opts: [string, number, string][]) => (
    <label className={`eb-pick${q[k] ? " on" : ""}`}><span>{label}</span>
      <select value={q[k] ?? ""} onChange={(e) => sch({ [k]: e.target.value || null } as Patch)}>
        <option value="">{look === "y19" ? label : t("shop.all")}</option>
        {opts.map(([v, n, name]) => <option key={v} value={v}>{look === "y19" ? name : `${name} (${n})`}</option>)}
      </select>
    </label>
  );
  const brand = pick("brand", t("ebuy.brand"), f.brands.map(([b, n]) => [b, n, b]));
  const cpu = pick("cpu", t("shop.cpuVendor"), f.cpus.map(([v, n]) => [v, n, cpuName(v)]));
  const max = (
    <form className={`eb-max${q.max ? " on" : ""}`} key={q.max ?? ""} onSubmit={(e) => { e.preventDefault(); sch({ max: Number(new FormData(e.currentTarget).get("max")) || null }); }}>
      <label><span>{t("ebuy.maxPrice")}</span><input name="max" type="number" min={1} defaultValue={q.max ?? ""} /></label>
      <button className="mk-btn">{look === "y05" ? t("ebuy.showItems") : t("ebuy.go")}</button>
    </form>
  );
  const sort = (
    <label className="eb-sort"><span>{t("shop.sortBy")}</span>
      <select value={q.sort} onChange={(e) => sch({ sort: e.target.value === "end" ? null : e.target.value })}>{SORTS.map((s) => <option key={s} value={s}>{t(`ebuy.sort.${s}`)}</option>)}</select>
    </label>
  );
  const bar = <div className="eb-bar"><strong>{t("ebuy.found", { n: list.length })}</strong>{look === "y05" && sort}{c.ship}</div>;
  if (look === "y05") return (
    <div className="eb-cols">
      <aside>
        <h3>{t("ebuy.matchingCategories")}</h3>
        <ul className="eb-cats">
          <li><a {...href(withQuery(here, { cat: null }))} aria-current={!q.cat || undefined}>{t("shop.all")}</a></li>
          {f.cats.map(([k, n]) => <li key={k}><a {...href(withQuery(here, { cat: k }))} aria-current={q.cat === k || undefined}>{t(`shop.class.${k}`)}</a> <span className="num">({n})</span></li>)}
        </ul>
        <h3>{t("ebuy.searchOptions")}</h3>
        <div className="eb-options">{brand}{cpu}{max}</div>
      </aside>
      <section>{bar}<Items c={c} list={list} /></section>
    </div>
  );
  return (
    <>
      <div className="eb-refine">{pick("cat", t("ebuy.category"), f.cats.map(([k, n]) => [k, n, t(`shop.class.${k}`)]))}{brand}{cpu}{max}{sort}</div>
      {bar}
      <Items c={c} list={list} />
    </>
  );
}

function Items({ c, list }: { c: Ctx; list: Listing[] }) {
  const { game, look, to, href } = c;
  if (!list.length) return <p className="eb-none">{t("shop.noListings")}</p>;
  if (look === "y05") return (
    <table className="eb-table">
      <thead><tr><th /><th>{t("ebuy.itemTitle")}</th><th className="num">{t("ebuy.bidsCol")}</th><th className="num">{t("ebuy.price")}</th><th className="num">{t("ebuy.timeLeft")}</th></tr></thead>
      <tbody>
        {list.map((l) => (
          <tr key={l.id}>
            <td className="eb-pic"><a {...href(item(l))}><Pic l={l} w={56} /></a></td>
            <td><a className="eb-title" {...href(item(l))}>{listingName(l)}</a> <Pill game={game} l={l} /><small>{listingRows(game, l, to, false).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small></td>
            <td className="num">{bids(game, l)}</td>
            <td className="num"><b>{euro(priceNow(game, l))}</b></td>
            <td className="num">{timeLeft(game, l)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <ul className="eb-items">
      {list.map((l) => (
        <li key={l.id}>
          <a className="eb-pic" {...href(item(l))}><Pic l={l} w={look === "y19" ? 160 : 110} /></a>
          <div className="eb-info">
            <a className="eb-title" {...href(item(l))}>{listingName(l)}</a>
            <Maker game={game} l={l} />
            {look === "y12" && <Facts rows={listingRows(game, l, to, false)} className="eb-facts" />}
          </div>
          <div className="eb-price">
            <strong className="num">{euro(priceNow(game, l))}</strong>
            <span className="num">{t("ebuy.bids", { n: bids(game, l) })}</span>
            <span className="num">{timeLeft(game, l)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Item({ c, id }: { c: Ctx; id: string }) {
  const { game, to } = c, l = game.used.find((x) => x.id === id && x.channel === "ebuy" && onMarket(game, x));
  if (!l) return <p className="eb-none">{t("ebuy.notFound")}</p>;
  return (
    <div className="eb-item">
      <div className="eb-shot"><Pic l={l} w={240} /></div>
      <div className="eb-panel">
        <h1>{listingName(l)}</h1>
        <Maker game={game} l={l} />
        <dl className="eb-terms">
          <div><dt>{t("shop.currentBid")}</dt><dd className="num"><strong>{euro(priceNow(game, l))}</strong> {t("ebuy.bids", { n: bids(game, l) })}</dd></div>
          <div><dt>{t("ebuy.timeLeft")}</dt><dd className="num">{timeLeft(game, l)}</dd></div>
        </dl>
        {c.ship}
        <BuyBox key={l.id} game={game} l={l} to={to} bid={t("ebuy.placeBid")} className="eb-bidbox" />
      </div>
      <section><h2>{t("ebuy.specifics")}</h2><Facts rows={listingRows(game, l, to, true)} className="eb-facts" /></section>
      <section><h2>{t("shop.bidHistory")}</h2><BidHistory game={game} l={l} className="eb-history" /></section>
    </div>
  );
}

function Mine({ c }: { c: Ctx }) {
  const { game } = c, bidding = game.used.filter((l) => l.channel === "ebuy" && l.bid && onMarket(game, l));
  return (
    <div className="eb-mine">
      <h1>{t("ebuy.myEbuy")}</h1>
      <h2>{t("ebuy.bidding")}</h2>
      <Items c={c} list={bidding} />
      <h2>{t("ebuy.selling")}</h2>
      {game.used.some((l) => l.channel === "ebuy" && l.device) ? <MyListings game={game} channel="ebuy" className="eb-selling" /> : <p className="eb-none">{t("shop.noListings")}</p>}
    </div>
  );
}
