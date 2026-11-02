import { type FormEvent } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import type { Listing } from "../../../../../sim/10-catalog/used";
import { t } from "../../../../../i18n/en";
import { Isometric } from "../../../../art/Isometric";
import { classLabel } from "../../../shop/filter";
import { BuyBox, cpuName, facets, Facts, filtered, listingName, listingRows, onChannel, postedOn, priceNow, queryOf, useShipTo, withQuery, type MarketProps } from "./shared";
import "./craigslost.css";

const field = (e: FormEvent<HTMLFormElement>, name: string) => String(new FormData(e.currentTarget).get(name) ?? "").trim();
const price = (s: string) => Math.round(Number(s.replace(/[^\d.]/g, ""))) || null;

// Craigslost: a plain classifieds board, the same list of links in every year.
export function Craigslost({ game, path, go }: MarketProps) {
  const [to, setTo] = useShipTo(game);
  const base = path.split("?")[0], qs = path.slice(base.length), list = `/${qs}`;
  const q = queryOf(path);
  if (!/[?&]sort=/.test(qs)) q.sort = "new";
  const all = onChannel(game, "chat"), shown = filtered(game, all, q), f = facets(game, all, q);
  if (q.sort === "new") shown.sort((a, b) => b.postedAt - a.postedAt);
  const id = base.match(/^\/p\/(.+)$/)?.[1], l = id ? all.find((x) => x.id === decodeURIComponent(id)) : undefined;
  const set = (patch: Parameters<typeof withQuery>[1]) => go(withQuery(list, patch));
  const open = (x: Listing) => go(`/p/${encodeURIComponent(x.id)}${qs}`);
  const search = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); set({ q: field(e, "q"), max: price(field(e, "max")) }); };
  const pick = (name: string, on: boolean, n: number, fn: () => void) => (
    <li key={name}><button className={on ? "on" : undefined} onClick={fn}>{name}</button> <span className="num">({n})</span></li>
  );
  const pic = (x: Listing, w: number) => <Isometric model={modelById(x.model)} brand={x.brand} w={w} count={Math.min(x.qty, 4)} />;

  return (
    <div className="mk-cl">
      <header>
        <button className="cl-logo" onClick={() => go("/")}>CL</button>
        <nav>
          <button onClick={() => go("/")}>craigslost</button> &gt; <button onClick={() => set({ cat: null })}>{t("cl.forSale")}</button>
          {q.cat && <> &gt; <button onClick={() => go(list)}>{classLabel(q.cat)}</button></>}
        </nav>
        <label className="cl-ship">{t("shop.shipTo")} <select value={to} onChange={(e) => setTo(e.target.value)}>{game.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </header>
      {id ? (
        <main className="cl-post">
          <button className="cl-link" onClick={() => go(list)}>&lt;&lt; {t("shop.back")}</button>
          {l ? (
            <>
              <h2>{listingName(l)} - <span className="num">{euro(priceNow(game, l))}</span></h2>
              <p className="cl-date">{t("cl.posted", { date: postedOn(l) })}</p>
              <div className="cl-body">
                <div className="cl-pic">{pic(l, 220)}</div>
                <div>
                  <Facts rows={listingRows(game, l, to, true)} className="cl-facts" />
                  <BuyBox game={game} l={l} to={to} className="cl-buy" />
                </div>
              </div>
            </>
          ) : <p>{t("cl.notFound")}</p>}
        </main>
      ) : (
        <div className="cl-cols">
          <aside>
            <form onSubmit={search}>
              <input name="q" type="search" key={`q${path}`} defaultValue={q.q} placeholder={t("shop.feature.search")} aria-label={t("shop.feature.search")} />
              <input name="max" type="number" min={1} key={`m${path}`} defaultValue={q.max ?? ""} placeholder={t("cl.max")} aria-label={t("cl.max")} />
              <button className="mk-btn">{t("shop.feature.search")}</button>
            </form>
            <select aria-label={t("cl.sort")} value={q.sort} onChange={(e) => set({ sort: e.target.value === "new" ? null : e.target.value })}>
              <option value="new">{t("shop.sort.newest")}</option><option value="price">{t("shop.sort.priceLow")}</option><option value="priceDesc">{t("shop.sort.priceHigh")}</option>
            </select>
            <ul>
              {pick(t("cl.all"), !q.cat, all.length, () => set({ cat: null }))}
              {f.cats.map(([c, n]) => pick(classLabel(c), q.cat === c, n, () => set({ cat: c })))}
            </ul>
            {f.cpus.length > 0 && <ul>{f.cpus.map(([c, n]) => pick(cpuName(c), q.cpu === c, n, () => set({ cpu: q.cpu === c ? null : c })))}</ul>}
            {f.brands.length > 0 && <ul>{f.brands.map(([b, n]) => pick(b, q.brand === b, n, () => set({ brand: q.brand === b ? null : b })))}</ul>}
          </aside>
          <main>
            <p className="cl-count">{t("cl.count", { n: shown.length })}</p>
            <ul className="cl-rows">
              {shown.map((x) => (
                <li key={x.id}>
                  <span className="cl-date num">{postedOn(x)}</span>
                  <button className="cl-thumb" aria-label={t("shop.details")} onClick={() => open(x)}>{pic(x, 40)}</button>
                  <button className="cl-link" onClick={() => open(x)}>{listingName(x)}</button>
                  <span className="cl-price num">{euro(priceNow(game, x))}</span>
                </li>
              ))}
              {!shown.length && <li>{t("shop.noListings")}</li>}
            </ul>
          </main>
        </div>
      )}
    </div>
  );
}
