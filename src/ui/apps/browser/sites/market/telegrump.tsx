import { useState, type FormEvent } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import type { Listing } from "../../../../../sim/10-catalog/used";
import type { GameState } from "../../../../../sim/50-state";
import { t } from "../../../../../i18n/en";
import { Isometric } from "../../../../art/Isometric";
import { BrandLogo } from "../../../../art/logos";
import { classLabel } from "../../../shop/filter";
import { BuyBox, cpuName, facets, Facts, filtered, listingName, listingRows, onChannel, priceNow, queryOf, useShipTo, withQuery, type MarketProps, type MarketQuery } from "./shared";
import "./telegrump.css";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const NA = ["rack", "colo", "volt", "blade", "patch", "iron", "byte", "fan", "rail", "uplink", "spare", "pdu"], NB = ["monkey", "rat", "lord", "head", "dude", "smith", "bot", "fox", "x", "guy"];
const nickOf = (id: string) => { const h = hash(id); return `${NA[h % NA.length]}${NB[(h >>> 4) % NB.length]}${h % 3 ? (h >>> 8) % 100 : ""}`; };
const minute = (l: Listing) => (hash(l.id) >>> 3) % 60;
const timeOf = (l: Listing) => `${String(l.postedAt % 24).padStart(2, "0")}:${String(minute(l)).padStart(2, "0")}`;
const stamp = (l: Listing) => l.postedAt * 60 + minute(l);
const tint = (s: string, pal: string[]) => pal[hash(s) % pal.length];
const MIRC = ["#009300", "#fc0000", "#7f0000", "#9c009c", "#fc7f00", "#00009c", "#009393", "#0000fc"];
const TG = ["#e17076", "#7bc862", "#e5ca77", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
const summary = (game: GameState, l: Listing, to: string) => listingRows(game, l, to, false).map(([k, v]) => `${k} ${v}`);
const field = (e: FormEvent<HTMLFormElement>, name: string) => { e.preventDefault(); return String(new FormData(e.currentTarget).get(name) ?? "").trim(); };
const price = (s: string) => Math.round(Number(s.replace(/[^\d.]/g, ""))) || null;

interface View {
  game: GameState; q: MarketQuery; f: ReturnType<typeof facets>; all: Listing[]; shown: Listing[]; to: string; setTo: (id: string) => void;
  set: (patch: Parameters<typeof withQuery>[1]) => void; open: (l: Listing) => void; back: () => void; msg: string | undefined; l: Listing | undefined; k: string;
}

// Telegrump: a web IRC gateway until 2012, Telegram Web from 2013, the rounder dark Web K from 2021.
export function Telegrump({ game, path, year, go }: MarketProps) {
  const [to, setTo] = useShipTo(game);
  const base = path.split("?")[0], qs = path.slice(base.length), list = `/${qs}`;
  const q = queryOf(path);
  if (!/[?&]sort=/.test(qs)) q.sort = "new";
  const all = onChannel(game, "chat"), msg = base.match(/^\/m\/(.+)$/)?.[1], shown = filtered(game, all, q);
  if (q.sort === "new") shown.sort((a, b) => stamp(b) - stamp(a));
  const v: View = {
    game, q, f: facets(game, all, q), all, shown, to, setTo, msg, l: msg ? all.find((x) => x.id === decodeURIComponent(msg)) : undefined,
    set: (patch) => go(withQuery(list, patch)), open: (l) => go(`/m/${encodeURIComponent(l.id)}${qs}`), back: () => go(list), k: path,
  };
  return year < 2013 ? <Irc {...v} /> : <Web {...v} k2={year >= 2021} />;
}

const ShipTo = ({ game, to, setTo }: View) => (
  <label className="tg-ship">{t("shop.shipTo")} <select value={to} onChange={(e) => setTo(e.target.value)}>{game.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
);

const Pic = ({ l, w }: { l: Listing; w: number }) => <Isometric model={modelById(l.model)} brand={l.brand} w={w} count={Math.min(l.qty, 4)} />;

function Detail({ game, l, to }: View & { l: Listing }) {
  return (
    <div className="tg-detail">
      <div className="tg-pic"><Pic l={l} w={200} /></div>
      <div>
        <h2><BrandLogo brand={l.brand} size={16} />{listingName(l)}</h2>
        <Facts rows={listingRows(game, l, to, true)} className="tg-facts" />
        <p className="tg-price num">{euro(priceNow(game, l))}</p>
        <BuyBox game={game} l={l} to={to} className="tg-buy" />
      </div>
    </div>
  );
}

function Irc(v: View) {
  const { game, q, f, shown, set, open, back, msg, l, to } = v;
  const [cmd, setCmd] = useState<"q" | "max">("q");
  const chan = q.cat ? `#${slug(classLabel(q.cat))}` : "#telegrump";
  const nicks = [...new Set(shown.map((x) => nickOf(x.id)))].sort();
  const join = (name: string, on: boolean, n: number, pick: () => void) => (
    <li key={name}><button className={on ? "on" : undefined} onClick={pick}>{name}</button><span className="num">{n}</span></li>
  );
  const send = (e: FormEvent<HTMLFormElement>) => { const s = field(e, "line"); set(cmd === "max" ? { max: price(s) } : { q: s }); };
  return (
    <div className="mk-tg irc">
      <header>
        <b>Telegrump IRC</b>
        <nav>
          <button className={msg ? undefined : "on"} onClick={back}>{chan}</button>
          {msg && <button className="on">{l ? nickOf(l.id) : msg}</button>}
        </nav>
        <ShipTo {...v} />
      </header>
      <div className="tg-topic">
        {chan} | {t("tg.topic", { n: shown.length })}{q.brand && ` | #${slug(q.brand)}`}{q.cpu && ` | #${slug(cpuName(q.cpu))}`}{q.q && ` | ${t("tg.cmdSearch")} ${q.q}`}{q.max && ` | ${t("tg.cmdMax")} ${euro(q.max)}`}
      </div>
      <div className="tg-body">
        <ul className="tg-chans">
          {join("#telegrump", !q.cat, v.all.length, () => set({ cat: null }))}
          {f.cats.map(([c, n]) => join(`#${slug(classLabel(c))}`, q.cat === c, n, () => set({ cat: c })))}
          {f.cpus.map(([c, n]) => join(`#${slug(cpuName(c))}`, q.cpu === c, n, () => set({ cpu: q.cpu === c ? null : c })))}
          {f.brands.map(([b, n]) => join(`#${slug(b)}`, q.brand === b, n, () => set({ brand: q.brand === b ? null : b })))}
        </ul>
        {msg ? (
          <div className="tg-log">
            {l ? <><p><span className="tg-ts">[{timeOf(l)}]</span> <b style={{ color: tint(l.id, MIRC) }}>&lt;{nickOf(l.id)}&gt;</b> {t("tg.wts")} {listingName(l)}</p><Detail {...v} l={l} /></> : <p className="tg-sys">* {msg}: {t("tg.notFound")}</p>}
          </div>
        ) : (
          <ol className="tg-log">
            {shown.map((x) => (
              <li key={x.id}>
                <span className="tg-ts">[{timeOf(x)}]</span> <b style={{ color: tint(x.id, MIRC) }}>&lt;{nickOf(x.id)}&gt;</b> {t("tg.wts")}{" "}
                <button className="tg-link" onClick={() => open(x)}>{listingName(x)}</button> <span className="tg-thumb"><Pic l={x} w={34} /></span>
                {summary(game, x, to).map((s) => ` | ${s}`)} | <b className="num">{euro(priceNow(game, x))}</b> <BuyBox game={game} l={x} to={to} className="tg-buy" />
              </li>
            ))}
            {!shown.length && <li className="tg-sys">* {t("shop.noListings")}</li>}
            <li className="tg-sys">* {t("tg.talking", { channel: chan })}</li>
          </ol>
        )}
        <div className="tg-nicks">
          <p>{t("tg.users", { n: nicks.length + 1 })}</p>
          <ul><li>@TrumpServ</li>{nicks.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      </div>
      <form className="tg-input" onSubmit={send}>
        <select value={cmd} onChange={(e) => setCmd(e.target.value as "q" | "max")}><option value="q">{t("tg.cmdSearch")}</option><option value="max">{t("tg.cmdMax")}</option></select>
        <input name="line" key={cmd + v.k} defaultValue={cmd === "max" ? q.max ?? "" : q.q} />
        <button className="mk-btn">{t("tg.send")}</button>
      </form>
    </div>
  );
}

function Web(v: View & { k2: boolean }) {
  const { game, q, f, shown, set, open, back, msg, l, to, k2 } = v;
  const title = q.cat ? classLabel(q.cat) : "Telegrump";
  const chat = (cat: string | null, name: string, n: number) => {
    const top = filtered(game, v.all, { ...q, cat }).sort((a, b) => stamp(b) - stamp(a))[0];
    return (
      <li key={name}>
        <button className={!msg && q.cat === cat ? "on" : undefined} onClick={() => set({ cat })}>
          <span className="tg-ava" style={{ background: tint(name, TG) }}>{name[0]}</span>
          <span className="tg-chat"><b>{name}</b><small>{top ? listingName(top) : ""}</small></span>
          <span className="tg-meta"><small>{top ? timeOf(top) : ""}</small>{n > 0 && <i className="num">{n}</i>}</span>
        </button>
      </li>
    );
  };
  const tags: [string, boolean, () => void][] = [
    ...f.brands.map(([b]): [string, boolean, () => void] => [`#${b.toLowerCase().replace(/[^a-z0-9]/g, "")}`, q.brand === b, () => set({ brand: q.brand === b ? null : b })]),
    ...f.cpus.map(([c]): [string, boolean, () => void] => [`#${c}`, q.cpu === c, () => set({ cpu: q.cpu === c ? null : c })]),
  ];
  const bubble = (x: Listing, long: boolean) => (
    <li key={x.id}>
      <span className="tg-ava" style={{ background: tint(x.id, TG) }}>{nickOf(x.id)[0]}</span>
      <div className="tg-msg">
        <div className="tg-bubble">
          <b className="tg-from" style={{ color: tint(x.id, TG) }}>{nickOf(x.id)}</b>
          <button className="tg-photo" aria-label={t("shop.details")} onClick={() => open(x)}><Pic l={x} w={long ? 240 : 180} /></button>
          <p className="tg-name"><BrandLogo brand={x.brand} size={14} />{listingName(x)}</p>
          {long ? <Facts rows={listingRows(game, x, to, true)} className="tg-facts" /> : <p className="tg-sum">{summary(game, x, to).join(" · ")}</p>}
          <p className="tg-foot"><b className="num">{euro(priceNow(game, x))}</b><small>{timeOf(x)}</small></p>
        </div>
        <BuyBox game={game} l={x} to={to} className="tg-kb" />
      </div>
    </li>
  );
  return (
    <div className={`mk-tg web${k2 ? " k2" : ""}`}>
      {!k2 && <header><b>Telegrump</b></header>}
      <div className="tg-body">
        <aside>
          <form onSubmit={(e) => set({ q: field(e, "q") })}>
            <input name="q" type="search" key={v.k} defaultValue={q.q} placeholder={t("shop.feature.search")} aria-label={t("shop.feature.search")} />
          </form>
          <ul>
            {chat(null, "Telegrump", v.all.length)}
            {f.cats.map(([c, n]) => chat(c, classLabel(c), n))}
          </ul>
        </aside>
        <main>
          <div className="tg-head">
            {msg && <button className="tg-back" aria-label={t("shop.back")} onClick={back}>←</button>}
            <span className="tg-ava" style={{ background: tint(title, TG) }}>{title[0]}</span>
            <span className="tg-chat"><b>{title}</b><small>{t("tg.topic", { n: shown.length })}</small></span>
            <ShipTo {...v} />
          </div>
          {!msg && (
            <div className="tg-tags">
              {tags.map(([s, on, pick]) => <button key={s} className={on ? "on" : undefined} onClick={pick}>{s}</button>)}
              <form onSubmit={(e) => set({ max: price(field(e, "max")) })}>
                <label>{t("tg.max")} <input name="max" type="number" min={1} key={v.k} defaultValue={q.max ?? ""} /></label>
              </form>
              <select aria-label={t("tg.sort")} value={q.sort} onChange={(e) => set({ sort: e.target.value === "new" ? null : e.target.value })}>
                <option value="new">{t("shop.sort.newest")}</option><option value="price">{t("shop.sort.priceLow")}</option><option value="priceDesc">{t("shop.sort.priceHigh")}</option>
              </select>
            </div>
          )}
          <ol className="tg-log">
            {msg ? (l ? bubble(l, true) : <li className="tg-sys"><span>{t("tg.notFound")}</span></li>) : shown.map((x) => bubble(x, false))}
            {!msg && !shown.length && <li className="tg-sys"><span>{t("shop.noListings")}</span></li>}
          </ol>
        </main>
      </div>
    </div>
  );
}
