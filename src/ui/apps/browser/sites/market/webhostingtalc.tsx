import type { ReactNode } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import type { Vendor } from "../../../../../sim/10-catalog/cpus";
import type { Listing } from "../../../../../sim/10-catalog/used";
import type { GameState } from "../../../../../sim/50-state";
import { Isometric } from "../../../../art/Isometric";
import { BrandLogo } from "../../../../art/logos";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { CLASS_TREE, classLabel, inClass } from "../../../shop/filter";
import { day } from "../../../hw";
import { BuyBox, cpuName, Facts, facets, filtered, listingClass, listingName, listingRows, MyListings, onChannel, priceNow, queryOf, useShipTo, withQuery, type MarketProps, type MarketSort } from "./shared";
import "./webhostingtalc.css";

// WebHostingTalc: vBolletin 3 tables in 2005, thread prefixes from 2008, a lighter ZenForo board from 2014.
type Look = "vb3" | "vb38" | "xf";
const lookOf = (y: number): Look => (y >= 2014 ? "xf" : y >= 2008 ? "vb38" : "vb3");
const LIST = "/forumdisplay.php?f=36";
const PRUNE = [1, 2, 7, 14, 30];
type Go = MarketProps["go"];

const hash = (s: string) => {
  let h = [...s].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
};
const HEAD = ["Rack", "Colo", "Dedi", "Byte", "Core", "Node", "Pipe", "Uplink", "Blade", "Packet"];
const TAIL = ["Guy", "Master", "Monkey", "Box", "King", "Nerd", "Wizard", "Jockey", "Head", "Ops"];
const userOf = (h: number) => `${HEAD[h % HEAD.length]}${TAIL[(h >>> 5) % TAIL.length]}${h % 3 ? "" : (h >>> 9) % 100}`;
const threadNo = (l: Listing) => l.id.replace(/\D/g, "");
const catOf = (l: Listing) => CLASS_TREE.find(([c]) => inClass(c, listingClass(l)))?.[0] ?? "";
const avatar = (h: number, user: string) => <span className="wt-av" style={{ background: `hsl(${h % 360} 45% 50%)` }} aria-hidden>{user[0]}</span>;

// Who posted a thread and how busy it is, fixed by its id and grown with its age.
function info(game: GameState, l: Listing) {
  const h = hash(l.id), age = Math.max(0, game.hour - l.postedAt), replies = Math.min(h % 14, Math.floor(age / 8));
  return {
    h, starter: userOf(h), last: replies ? userOf(hash(`${l.id}r`)) : userOf(h), replies,
    views: 20 + replies * 17 + ((h >>> 7) % 240) + Math.floor(age / 3), lastAt: l.postedAt + (replies ? Math.floor((age * ((h >>> 11) % 100)) / 100) : 0),
  };
}

const L = ({ to, go, className, current, children }: { to: string; go: Go; className?: string; current?: boolean; children: ReactNode }) => (
  <a href={to} className={className} aria-current={current ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);
const Rep = ({ n }: { n: number }) => <span className="wt-rep" aria-label={`${t("shop.reputation")} ${n}`}>{Array.from({ length: Math.max(0, Math.min(10, n)) }, (_, k) => <i key={k} />)}</span>;
const pruneOf = (path: string) => Number(new URLSearchParams(path.split("?")[1] ?? "").get("daysprune")) || -1;

function Search({ list, go }: { list: string; go: Go }) {
  return (
    <form key={list} className="wt-search" onSubmit={(e) => { e.preventDefault(); go(withQuery(list, { q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || null })); }}>
      <input name="q" defaultValue={queryOf(list).q} placeholder={t("whtalc.search")} aria-label={t("whtalc.search")} />
      <button className="mk-btn">{t("whtalc.go")}</button>
    </form>
  );
}

function Post({ n, at, user, h, city, children }: { n: number; at: number; user: string; h: number; city?: string; children: ReactNode }) {
  return (
    <article className="wt-post">
      <header><span>{day(at)}</span><span>#{n}</span></header>
      <div className="wt-post-row">
        <aside className="wt-user">
          {avatar(h, user)}
          <b>{user}</b>
          <span className="wt-rank">{t(`whtalc.rank.${(h >>> 3) % 3}`)}</span>
          <Facts rows={[...(city ? [[t("whtalc.location"), city]] as [string, string][] : []), [t("whtalc.posts"), (12 + ((h >>> 13) % 4000)).toLocaleString(LOCALE)]]} />
          <Rep n={1 + ((h >>> 17) % 5)} />
        </aside>
        <div className="wt-msg">{children}</div>
      </div>
    </article>
  );
}

function Thread({ game, l }: { game: GameState; l: Listing }) {
  const [to, setTo] = useShipTo(game), i = info(game, l), shown = Math.min(2, i.replies);
  return (
    <>
      <Post n={1} at={l.postedAt} user={i.starter} h={i.h} city={l.city}>
        <h2>{t("whtalc.title", { name: listingName(l), price: euro(priceNow(game, l)), city: l.city })}</h2>
        <div className="wt-pic"><Isometric model={modelById(l.model)} brand={l.brand} w={200} count={Math.min(l.qty, 4)} /></div>
        <p className="wt-brand"><BrandLogo brand={l.brand} size={14} />{l.brand}</p>
        <Facts rows={listingRows(game, l, to, true)} className="wt-facts" />
        <div className="wt-buy">
          <b className="num">{t("shop.ask", { price: euro(l.price) })}</b>
          {game.locations.length > 1 && (
            <label>{t("shop.shipTo")} <select value={to} onChange={(e) => setTo(e.target.value)}>{game.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          )}
          <BuyBox game={game} l={l} to={to} />
        </div>
      </Post>
      {Array.from({ length: shown }, (_, k) => {
        const h = hash(`${l.id}r${k}`), at = l.postedAt + Math.floor(((i.lastAt - l.postedAt) * (k + 1)) / shown);
        return <Post key={k} n={k + 2} at={at} user={k === shown - 1 ? i.last : userOf(h)} h={h}>{t(`whtalc.reply.${h % 4}`)}</Post>;
      })}
    </>
  );
}

function UserCp({ game }: { game: GameState }) {
  return (
    <>
      <section className="wt-box">
        <h3>{t("shop.reputation")}</h3>
        <p className="wt-pad"><Rep n={Math.ceil(game.usedRep / 2)} /> <b className="num">{game.usedRep}</b></p>
      </section>
      <section className="wt-box">
        <h3>{t("shop.yourListings")}</h3>
        {game.used.some((l) => l.channel === "board" && l.device) ? <MyListings game={game} channel="board" className="wt-mine" /> : <p className="wt-pad">{t("shop.noListings")}</p>}
      </section>
    </>
  );
}

function Forum({ game, path, go, look }: { game: GameState; path: string; go: Go; look: Look }) {
  const list = path.startsWith("/forumdisplay.php") ? path : LIST, q = queryOf(list), days = pruneOf(list);
  const all = onChannel(game, "board").filter((l) => !l.device), f = facets(game, all, q);
  const shown = filtered(game, all, q).filter((l) => days < 0 || l.postedAt >= game.hour - days * 24);
  const set = (patch: Parameters<typeof withQuery>[1]) => go(withQuery(list, patch));
  const title = (l: Listing) => t("whtalc.title", { name: listingName(l), price: euro(priceNow(game, l)), city: l.city });
  const open = (l: Listing) => `/showthread.php?t=${threadNo(l)}`;
  const prefix = (l: Listing) => look !== "vb3" && <L to={withQuery(list, { cat: catOf(l) })} go={go} className="wt-prefix">{classLabel(catOf(l))}</L>;
  const pick = (label: string, value: string, options: [string, string][], onChange: (v: string) => void, disabled = false) => (
    <label>{label}<select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{options.map(([v, x]) => <option key={v} value={v}>{x}</option>)}</select></label>
  );

  if (look === "xf") {
    const sorts: [MarketSort, string][] = [["end", t("whtalc.sort.ending")], ["new", t("shop.sort.newest")], ["price", t("shop.sort.priceLow")], ["priceDesc", t("shop.sort.priceHigh")]];
    return (
      <>
        <h1>{t("whtalc.forum")}</h1>
        <nav className="wt-tabs" aria-label={t("whtalc.prefix")}>
          <L to={withQuery(list, { cat: null })} go={go} className={q.cat ? "" : "on"}>{t("shop.all")}</L>
          {f.cats.map(([c, n]) => <L key={c} to={withQuery(list, { cat: c })} go={go} className={q.cat === c ? "on" : ""}>{classLabel(c)} <span className="num">{n}</span></L>)}
        </nav>
        <div className="wt-filters">
          {pick(t("shop.manufacturer"), q.brand ?? "", [["", t("shop.any")], ...f.brands.map(([b, n]) => [b, `${b} (${n})`] as [string, string])], (v) => set({ brand: v }))}
          {pick(t("shop.cpuVendor"), q.cpu ?? "", [["", t("shop.any")], ...f.cpus.map(([v, n]) => [v, `${cpuName(v as Vendor)} (${n})`] as [string, string])], (v) => set({ cpu: v }))}
          <form key={`max${q.max}`} onSubmit={(e) => { e.preventDefault(); set({ max: Number(new FormData(e.currentTarget).get("max")) || null }); }}>
            <label>{t("whtalc.maxPrice")}<input name="max" type="number" min={1} defaultValue={q.max ?? ""} /></label>
          </form>
          {pick(t("shop.sortBy"), q.sort, sorts, (v) => set({ sort: v === "end" ? null : v }))}
          <Search list={list} go={go} />
        </div>
        <ol className="wt-xlist">
          {shown.map((l) => {
            const i = info(game, l);
            return (
              <li key={l.id}>
                {avatar(i.h, i.starter)}
                <div className="wt-xmain">{prefix(l)}<L to={open(l)} go={go} className="wt-tl">{title(l)}</L><small>{i.starter} · {day(l.postedAt)}</small></div>
                <dl className="wt-xstats"><div><dt>{t("whtalc.replies")}</dt><dd className="num">{i.replies}</dd></div><div><dt>{t("whtalc.views")}</dt><dd className="num">{i.views.toLocaleString(LOCALE)}</dd></div></dl>
                <div className="wt-xlast"><span className="num">{day(i.lastAt)}</span><small>{i.last}</small></div>
              </li>
            );
          })}
          {!shown.length && <li className="wt-none">{t("shop.noListings")}</li>}
        </ol>
      </>
    );
  }

  const field = q.sort === "priceDesc" ? "price" : q.sort, order = q.sort === "new" || q.sort === "priceDesc" ? "desc" : "asc";
  const sortBy = (fld: string, ord: string) => set({ sort: fld === "price" ? (ord === "desc" ? "priceDesc" : "price") : fld === "end" ? null : fld });
  return (
    <>
      {look === "vb3" && f.cats.length > 0 && (
        <table className="wt-table">
          <thead><tr><td className="wt-tcat" colSpan={2}>{t("whtalc.subForums")}</td></tr><tr><th>{t("whtalc.forumCol")}</th><th className="num">{t("whtalc.threads")}</th></tr></thead>
          <tbody>{f.cats.map(([c, n]) => <tr key={c}><td className="alt1"><L to={withQuery(list, { cat: q.cat === c ? null : c })} go={go} className={q.cat === c ? "wt-on" : ""}>{classLabel(c)}</L></td><td className="alt2 num">{n}</td></tr>)}</tbody>
        </table>
      )}
      <table className="wt-table">
        <thead>
          <tr><td className="wt-tcat" colSpan={4}><span>{t("whtalc.threadsIn", { forum: q.cat ? classLabel(q.cat) : t("whtalc.forum") })}</span><Search list={list} go={go} /></td></tr>
          <tr><th>{t("whtalc.thread")} / {t("whtalc.starter")}</th><th>{t("whtalc.lastPost")}</th><th className="num">{t("whtalc.replies")}</th><th className="num">{t("whtalc.views")}</th></tr>
        </thead>
        <tbody>
          {shown.map((l) => {
            const i = info(game, l);
            return (
              <tr key={l.id}>
                <td className="alt1">{prefix(l)}<L to={open(l)} go={go} className="wt-tl">{title(l)}</L><small>{i.starter}</small></td>
                <td className="alt2 wt-last"><span className="num">{day(i.lastAt)}</span><small>{t("whtalc.by", { name: i.last })}</small></td>
                <td className="alt1 num">{i.replies}</td>
                <td className="alt2 num">{i.views.toLocaleString(LOCALE)}</td>
              </tr>
            );
          })}
          {!shown.length && <tr><td className="alt1 wt-none" colSpan={4}>{t("shop.noListings")}</td></tr>}
        </tbody>
      </table>
      <table className="wt-table wt-options">
        <thead><tr><td className="wt-tcat">{t("whtalc.displayOptions")}</td></tr></thead>
        <tbody><tr><td className="alt1">
          {pick(t("whtalc.sortedBy"), field, [["end", t("whtalc.sort.end")], ["new", t("whtalc.sort.new")], ["price", t("whtalc.sort.price")]], (v) => sortBy(v, order))}
          {pick(t("whtalc.sortOrder"), order, [["asc", t("whtalc.order.asc")], ["desc", t("whtalc.order.desc")]], (v) => sortBy(field, v), field !== "price")}
          {pick(t("whtalc.fromThe"), String(days), [["-1", t("whtalc.prune.all")], ...PRUNE.map((d) => [String(d), t(`whtalc.prune.${d}`)] as [string, string])], (v) => go(withQuery(list, { daysprune: v === "-1" ? null : v } as never)))}
          {look === "vb38" && pick(t("whtalc.prefix"), q.cat ?? "", [["", t("whtalc.anyPrefix")], ...f.cats.map(([c]) => [c, classLabel(c)] as [string, string])], (v) => set({ cat: v }))}
        </td></tr></tbody>
      </table>
    </>
  );
}

export function WebHostingTalc({ game, path, year, go }: MarketProps) {
  const look = lookOf(year), page = path.split("?")[0];
  const tno = page === "/showthread.php" ? new URLSearchParams(path.split("?")[1] ?? "").get("t") : null;
  const l = tno ? onChannel(game, "board").find((x) => !x.device && threadNo(x) === tno) : undefined;
  const crumbs: [string, string][] = [["/", "WebHostingTalc"], [LIST, t("whtalc.marketplace")], [LIST, t("whtalc.forum")]];
  return (
    <div className={`mk-whtalc ${look}`}>
      <header className="wt-head">
        <L to="/" go={go} className="wt-logo"><b>WebHosting</b>Talc</L>
        <nav><L to={LIST} go={go} current={page !== "/usercp.php"}>{look === "xf" ? t("whtalc.forums") : t("whtalc.marketplace")}</L><L to="/usercp.php" go={go} current={page === "/usercp.php"}>{t("whtalc.userCp")}</L></nav>
      </header>
      <div className="wt-crumbs">
        {crumbs.map(([to, x], k) => <span key={k}><L to={to} go={go}>{x}</L></span>)}
        {page === "/usercp.php" && <span>{t("whtalc.userCp")}</span>}
      </div>
      <main>
        {page === "/usercp.php" ? <UserCp game={game} />
          : page === "/showthread.php" ? (l ? <Thread game={game} l={l} /> : <p className="wt-box wt-pad">{t("whtalc.invalid")}</p>)
          : <Forum game={game} path={path} go={go} look={look} />}
      </main>
      <footer>{t("whtalc.powered", { name: look === "xf" ? "ZenForo" : "vBolletin" })} · © {year} WebHostingTalc</footer>
    </div>
  );
}
