import type { ReactNode } from "react";
import { useState } from "react";
import { euro } from "../../../../../sim/00-core/money";
import { boardSpec, componentParts, genOf, isDriveKind, modelById, modelName, wattsFactorOf, type ComponentKind, type DeviceModel } from "../../../../../sim/10-catalog/hardware";
import { cardOf } from "../../../../../sim/10-catalog/gpu";
import { defaultVendor, skuById, VENDOR_NAME, VENDORS, type Vendor } from "../../../../../sim/10-catalog/cpus";
import { bidHistory, currentBid, leading, onMarket, shipHours, type Channel, type Listing } from "../../../../../sim/10-catalog/used";
import type { GameState } from "../../../../../sim/50-state";
import { bidListing, buyListing, cancelListing } from "../../../../../sim/90-actions/used";
import { useSessionState } from "../../../../session";
import { useStore } from "../../../../store";
import { t } from "../../../../../i18n/en";
import { classOf, CLASS_TREE, inClass, rowLabel } from "../../../shop/filter";
import { clockLabel, cores, day, disk, height, memoryDriveRows, portsText, ram, speed } from "../../../hw";

// The pieces every used-market site lays out in its own look: the listings a query keeps, their facts and the buy controls.
export interface MarketProps { game: GameState; path: string; year: number; go: (path: string) => void }

const days = (h: number) => t("shop.duration", { h });
const years = (y: number) => t("shop.years", { n: y.toFixed(1) });

// A server listing's CPU maker; older listings carry the preset's.
export const listingVendor = (l: Listing): Vendor | undefined => {
  const m = modelById(l.model);
  return m.server ? l.vendor ?? defaultVendor(m.server.arch) : undefined;
};
export const listingName = (l: Listing): string => `${l.qty > 1 ? `${l.qty} × ` : ""}${modelName(modelById(l.model), l.brand)}`;
// What a listing costs now: the running bid of an auction, the ask elsewhere.
export const priceNow = (game: GameState, l: Listing): number => (l.channel === "ebuy" ? currentBid(l, game.hour) : l.price);
export const leads = (game: GameState, l: Listing): boolean => leading(l, game.hour);
export const timeLeft = (game: GameState, l: Listing): string => days(l.expiresAt - game.hour);
export const ageText = (l: Listing): string => years(l.age);
export const postedOn = (l: Listing): string => day(l.postedAt);

// The technical facts of one unit as the Shop lists them, from the parts it was built with.
function techRows(m: DeviceModel, brand: string, vendor: Vendor | undefined): [string, string][] {
  const parts = componentParts(m, vendor), sum = (f: (k: ComponentKind) => boolean) => parts.filter((p) => f(p.kind)).reduce((n, p) => n + (p.size ?? 0), 0);
  const s = m.server, board = s && vendor ? boardSpec(m, vendor) : undefined, drives = parts.filter((p) => isDriveKind(p.kind)), cards = parts.filter((p) => p.kind === "gpu");
  const cpu = parts.find((p) => p.kind === "cpu"), sku = cpu?.sku ? skuById(cpu.sku) : undefined;
  return [
    ["Height", height(m)],
    ...(m.throughputGbit ? [["Throughput", speed(m.throughputGbit)]] as [string, string][] : []),
    ...(s && vendor ? [
      ["CPU", `${s.sockets} × ${VENDOR_NAME[vendor]} ${sku?.name ?? ""}`.trim()], ["Cores", cores(sum((k) => k === "cpu"))], ...(sku ? [["Threads", `${s.sockets * sku.threads}`]] as [string, string][] : []),
      ["Clock", clockLabel(cpu ?? { kind: "cpu", vendor, gen: genOf(m) })],
      ["Mainboard", board?.name ?? ""], ["RAM", ram(sum((k) => k === "ram"))],
      ...(cards.length ? [["GPUs", `${cards.length} × ${cardOf(cards[0].size).name}`]] as [string, string][] : []),
      ["Storage", drives.length ? t("shop.storageIn", { size: disk(sum(isDriveKind)), n: drives.length, kind: s.disk }) : t("shop.noneValue")],
    ] as [string, string][] : []),
    ...(m.kind === "gateway" ? [["Routing", m.fullTable ? t("shop.routingFull") : t("shop.routingDefault")]] as [string, string][] : []),
    ...(m.batteryWh ? [["Battery", `${m.batteryWh} Wh`]] as [string, string][] : m.outlets ? [["Outlets", `${m.outlets}`]] as [string, string][] : m.ports.length ? [[s ? "NICs" : "Ports", portsText(m)]] as [string, string][] : []),
    ...(m.watts ? [["PSUs", `${m.psus}`], ["Power", `${Math.round(wattsFactorOf(m, brand) * m.watts)} W`]] as [string, string][] : []),
  ].filter(([, v]) => v !== "") as [string, string][];
}

// The facts of a listing, labelled: the unit's technical rows, then what the sale says. Short is the few a result row shows.
export function listingRows(game: GameState, l: Listing, to: string, long: boolean): [string, string][] {
  const m = modelById(l.model), city = game.locations.find((x) => x.id === to)!.city, auction = l.channel === "ebuy", vendor = listingVendor(l);
  const tech = techRows(m, l.brand, vendor), get = (k: string) => tech.find(([x]) => x === k)?.[1] ?? "";
  const short: [string, string][] = m.server
    ? [["CPU", `${get("Cores")} ${get("CPU")}, ${get("Clock")}`], ["RAM", get("RAM")], ["Storage", get("Storage")]]
    : tech.filter(([k]) => ["Ports", "Battery", "Outlets", "Throughput"].includes(k));
  const rows: [string, string][] = [
    ...(long ? tech : short),
    ["Age", years(l.age)],
    ...(long ? [["Seller", l.city]] as [string, string][] : []),
    ...(long ? [[auction ? "Ends" : "Listed for", days(l.expiresAt - game.hour)]] as [string, string][] : []),
    ["Shipping", days(shipHours(l, city))],
    ...(l.defect ? [["Defect", t(`shop.defect.${l.defect}`)]] as [string, string][] : []),
    ...(l.bid ? [["Your maximum", euro(l.bid)]] as [string, string][] : []),
  ].map(([k, v]) => [rowLabel(k), v]);
  // Memory and drive rows come labelled already.
  if (long && m.server) rows.splice(tech.length, 0, ...memoryDriveRows(componentParts(m, vendor)));
  return rows;
}

export const Facts = ({ rows, className }: { rows: [string, string][]; className?: string }) => (
  <dl className={className}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
);

export function Money({ value, onChange, label, className = "used-input" }: { value: number; onChange: (v: number) => void; label: string; className?: string }) {
  return (
    <span className={className}>
      <input type="number" min={1} step={1} aria-label={label} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Math.round(Number(e.target.value)))} />
      <span aria-hidden>€</span>
    </span>
  );
}

// The buy or bid control of a listing: a maximum and a bid button on eBuy, a buy button at the ask elsewhere.
export function BuyBox({ game, l, to, buy, bid, className }: { game: GameState; l: Listing; to: string; buy?: ReactNode; bid?: ReactNode; className?: string }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const city = game.locations.find((x) => x.id === to)!.city, now = currentBid(l, game.hour);
  const [max, setMax] = useState(Math.ceil((now * 1.1) / 10) * 10);
  const name = listingName(l);
  if (l.channel !== "ebuy") {
    const take = () => { if (act(buyListing, l.id, to).ok) notify("Shop", t("shop.bought", { name }), t("shop.arrives", { date: day(game.hour + shipHours(l, city)) })); };
    return <span className={className}><button className="mk-btn" disabled={l.price > game.cash} onClick={take}>{buy ?? t("shop.buy")}</button></span>;
  }
  const place = () => { if (act(bidListing, l.id, max, to).ok) notify("Shop", t("shop.bidOn", { name }), t("shop.maximum", { price: euro(max) })); };
  return (
    <span className={className}>
      <Money value={max} onChange={setMax} label={t("shop.maximumBid")} className="mk-money" />
      <button className="mk-btn" disabled={!(max > now) || max > game.cash} onClick={place}>{bid ?? t("shop.bid")}</button>
    </span>
  );
}

// The auction's bids, newest first.
export function BidHistory({ game, l, className }: { game: GameState; l: Listing; className?: string }) {
  return (
    <table className={className}>
      <thead><tr><th>{t("shop.bidder")}</th><th>{t("shop.date")}</th><th className="num">{t("shop.bidAmount")}</th></tr></thead>
      <tbody>{[...bidHistory(l, game.hour)].reverse().map((b, i) => <tr key={i}><td>{t(`shop.bidder.${b.by}`)}</td><td className="num">{day(b.hour)}, {String(b.hour % 24).padStart(2, "0")}:00</td><td className="num">{euro(b.amount)}</td></tr>)}</tbody>
    </table>
  );
}

// The player's own listings on a channel, each with its ask or start price and a button to take it down.
export function MyListings({ game, channel, className }: { game: GameState; channel: Channel; className?: string }) {
  const act = useStore((s) => s.act);
  const mine = game.used.filter((l) => l.channel === channel && l.device);
  if (!mine.length) return null;
  return (
    <ul className={className}>
      {mine.map((l) => (
        <li key={l.id}>
          <strong>{l.device!.name}</strong>
          <span className="num">{l.channel === "ebuy" ? t("shop.startsAt", { price: euro(l.price) }) : t("shop.ask", { price: euro(l.price) })} · {t("shop.until", { date: day(l.expiresAt) })}</span>
          <button className="mk-btn" onClick={() => act(cancelListing, l.id)}>{t("shop.takeDown")}</button>
        </li>
      ))}
    </ul>
  );
}

// Filters live in the address's query, as on the real sites: cat (a Shop class or class group), brand, cpu, max (price), q (text) and sort.
export type MarketSort = "end" | "new" | "price" | "priceDesc";
export interface MarketQuery { cat: string | null; brand: string | null; cpu: Vendor | null; max: number | null; q: string; sort: MarketSort }
export function queryOf(path: string): MarketQuery {
  const p = new URLSearchParams(path.split("?")[1] ?? ""), max = Number(p.get("max"));
  const cpu = p.get("cpu") as Vendor | null, sort = p.get("sort") as MarketSort | null;
  return {
    cat: p.get("cat"), brand: p.get("brand"), cpu: cpu && VENDORS.includes(cpu) ? cpu : null, max: max > 0 ? max : null, q: (p.get("q") ?? "").trim().toLowerCase(),
    sort: sort && ["end", "new", "price", "priceDesc"].includes(sort) ? sort : "end",
  };
}
// A query string with one filter changed; null or an empty value drops it.
export function withQuery(path: string, patch: Partial<Record<keyof MarketQuery, string | number | null>>): string {
  const [base, raw] = path.split("?"), p = new URLSearchParams(raw ?? "");
  for (const [k, v] of Object.entries(patch)) if (v === null || v === "" || v === undefined) p.delete(k); else p.set(k, String(v));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export const onChannel = (game: GameState, channel: Channel): Listing[] => game.used.filter((l) => l.channel === channel && onMarket(game, l));
export const listingClass = (l: Listing): string => classOf(modelById(l.model));

// The listings a query keeps, in its order.
export function filtered(game: GameState, all: Listing[], q: MarketQuery, skip?: keyof MarketQuery): Listing[] {
  const keep = all.filter((l) =>
    (skip === "cat" || inClass(q.cat, listingClass(l))) && (skip === "brand" || !q.brand || l.brand === q.brand) && (skip === "cpu" || !q.cpu || listingVendor(l) === q.cpu)
    && (skip === "max" || !q.max || priceNow(game, l) <= q.max) && (!q.q || listingName(l).toLowerCase().includes(q.q) || l.brand.toLowerCase().includes(q.q)));
  const by: Record<MarketSort, (a: Listing, b: Listing) => number> = {
    end: (a, b) => a.expiresAt - b.expiresAt, new: (a, b) => b.postedAt - a.postedAt,
    price: (a, b) => priceNow(game, a) - priceNow(game, b), priceDesc: (a, b) => priceNow(game, b) - priceNow(game, a),
  };
  return keep.sort(by[q.sort]);
}

// The values a filter offers with how many listings each keeps once the other filters apply. Classes come as the Shop's groups.
export function facets(game: GameState, all: Listing[], q: MarketQuery) {
  const count = (skip: keyof MarketQuery, f: (l: Listing) => boolean) => filtered(game, all, q, skip).filter(f).length;
  return {
    cats: CLASS_TREE.map(([c]) => [c, count("cat", (l) => inClass(c, listingClass(l)))] as [string, number]).filter(([c, n]) => n > 0 || c === q.cat),
    brands: [...new Set(all.map((l) => l.brand))].sort().map((b) => [b, count("brand", (l) => l.brand === b)] as [string, number]).filter(([b, n]) => n > 0 || b === q.brand),
    cpus: VENDORS.map((v) => [v, count("cpu", (l) => listingVendor(l) === v)] as [Vendor, number]).filter(([v, n]) => n > 0 || v === q.cpu),
  };
}
export const cpuName = (v: Vendor): string => VENDOR_NAME[v];

// Where a purchase ships: one of the player's locations, kept per session.
export function useShipTo(game: GameState): [string, (id: string) => void] {
  const [to, setTo] = useSessionState("market.to", game.locations[0].id);
  return [game.locations.some((l) => l.id === to) ? to : game.locations[0].id, setTo];
}
