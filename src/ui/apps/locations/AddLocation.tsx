import { ArrowDown, ArrowUp, Check, Leaf, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { DATACENTERS, inUs, LEAD_DAYS, SPACE_SIZES, spacePrice, type Datacenter } from "../../../sim/20-world/datacenters";
import type { GameState, SpaceKind } from "../../../sim/50-state";
import { dcAvailability, fits } from "../../../sim/60-infra/status";
import { addLocation, joinWaitlist } from "../../../sim/90-actions/hardware";
import { Logo } from "../../art/logos";
import { cityNamed, WorldMap, type Bounds, type Marker } from "../../map/WorldMap";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { positionsLabel, shareLabel, shareUnits, Sheet, spaceSize } from "./ui";

type Rented = Exclude<SpaceKind, "basement">;
const CITIES = [...new Set(DATACENTERS.map((d) => d.city))];
type Area = "eu" | "us";
const AREAS: [Area, string, Bounds][] = [["eu", t("locations-1.europe"), { west: -1, south: 45, east: 17, north: 53 }], ["us", t("locations-1.northAmerica"), { west: -122, south: 28, east: -72, north: 46 }]];
const KINDS: [Rented, string][] = [["share", t("locations-1.rack")], ["cage", t("locations-1.cage")], ["suite", t("locations-1.suite")]];

// Filters narrow the list, each one a requirement a datacenter either meets or not.
type Filter = "green" | "certified" | "ab" | "backup" | "exchange" | "cages";
const FILTERS: [Filter, string, (d: Datacenter) => boolean][] = [
  ["green", t("locations-1.fGreen"), (d) => d.green], ["certified", t("locations-1.fCertified"), (d) => d.certified], ["ab", t("locations-1.fAb"), (d) => d.feeds === "ab"],
  ["backup", t("locations-1.fUps"), (d) => d.backup !== "none"], ["exchange", t("locations-1.fExchange"), (d) => !!d.exchange?.onSite], ["cages", t("locations-1.fCages"), (d) => d.cages],
];
// Sort keys; `first` is the direction a first click takes, the better end of the column.
type SortKey = "name" | "space" | "carriers" | "exchange" | "power" | "kw" | "price" | "cross" | "hands";
type Dir = "asc" | "desc";
const SORTS: Record<SortKey, { first: Dir; value: (game: GameState, d: Datacenter) => number | string }> = {
  name: { first: "asc", value: (_, d) => d.name },
  space: { first: "desc", value: (g, d) => dcAvailability(g, d.id).freeEighths },
  carriers: { first: "desc", value: (_, d) => d.carriers },
  exchange: { first: "desc", value: (_, d) => (d.exchange ? (d.exchange.onSite ? 2 : 1) : 0) },
  power: { first: "desc", value: (_, d) => (d.feeds === "ab" ? 3 : 0) + (d.backup === "ups+generator" ? 2 : d.backup === "ups" ? 1 : 0) },
  kw: { first: "desc", value: (_, d) => d.kwPerPosition },
  price: { first: "asc", value: (_, d) => d.positionPrice },
  cross: { first: "asc", value: (_, d) => d.crossConnect },
  hands: { first: "asc", value: (_, d) => d.remoteHands.perHour },
};

// A badge for a property; `off` marks the weaker side of the comparison.
const B = ({ children, off }: { children: ReactNode; off?: boolean }) => <span className={`loc-badge${off ? " off" : ""}`}>{children}</span>;
const Icon = ({ label, children }: { label: string; children: ReactNode }) => <span className="loc-icon" role="img" title={label} aria-label={label}>{children}</span>;

export function AddLocation({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const act = useStore((s) => s.act), game = useStore((s) => s.game), notify = useStore((s) => s.notify);
  const [hideFull, setHideFull] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir } | null>(null);
  const [area, setArea] = useState<Area>("eu");
  const [city, setCity] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [dcId, setDc] = useState<string | null>(null);
  const [kind, setKind] = useState<Rented>("share");
  const [size, setSize] = useState(1);
  const cities = CITIES.filter((c) => inUs(c) === (area === "us"));
  const matching = DATACENTERS.filter((d) => (city ? d.city === city : cities.includes(d.city)) && (!hideFull || dcAvailability(game, d.id).freeEighths > 0) && FILTERS.every(([f,, test]) => !filters.includes(f) || test(d)));
  const rows = sort ? [...matching].sort((a, b) => {
    const x = SORTS[sort.key].value(game, a), y = SORTS[sort.key].value(game, b);
    const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
    return sort.dir === "asc" ? c : -c;
  }) : matching;
  // Clicking a column sorts it by its better end first, then reverses, then returns to the catalog order.
  const sortBy = (key: SortKey) => setSort(!sort || sort.key !== key ? { key, dir: SORTS[key].first } : sort.dir === SORTS[key].first ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : null);
  const Th = ({ k, className, children }: { k: SortKey; className?: string; children: ReactNode }) => (
    <th className={className} aria-sort={sort?.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="loc-sort" onClick={() => sortBy(k)}>{children}{sort?.key === k && (sort.dir === "asc" ? <ArrowUp /> : <ArrowDown />)}</button>
    </th>
  );
  const dc = DATACENTERS.find((d) => d.id === dcId && rows.includes(d)) ?? null;
  const k: Rented = kind === "cage" && dc && !dc.cages ? "share" : kind;
  const n = SPACE_SIZES[k].includes(size) ? size : SPACE_SIZES[k][0];
  // A size is open when it is free now or the waitlist holds it for the player.
  const open = (s: number) => !!dc && (fits(game, dc.id, k, s) || game.waitlist.some((w) => w.dc === dc.id && w.space === k && w.size === s && w.heldUntil !== null));
  const add = () => {
    if (!dc) return;
    if (!open(n)) {
      if (act(joinWaitlist, dc.id, k, n).ok) { notify("Locations", t("locations-1.joinedWaitlist"), `${dc.name}, ${spaceSize(k, n)}`); onClose(); }
      return;
    }
    const r = act(addLocation, dc.id, k, n);
    if (r.ok && r.id) onAdded(r.id);
  };

  return (
    <Sheet title={t("locations-1.addLocation")} onClose={onClose} wide>
      <div className="loc-sheet-bar">
        <div className="seg" role="group" aria-label={t("locations-1.area")}>
          {AREAS.map(([id, label]) => <button key={id} aria-pressed={area === id} onClick={() => { setArea(id); setCity(null); }}>{label}</button>)}
        </div>
        <span className="grow" />
        <div className="loc-cities">
          <div className="seg" role="group" aria-label={t("locations-1.city")}>
            <button aria-pressed={!city} onClick={() => setCity(null)}>{t("locations-1.all")}</button>
            {cities.map((c) => <button key={c} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>)}
          </div>
        </div>
      </div>
      <div className="loc-filters" role="group" aria-label={t("locations-1.filter")}>
        <span className="loc-k">{t("locations-1.filter")}</span>
        <button className="loc-chip" aria-pressed={hideFull} onClick={() => setHideFull(!hideFull)}>{hideFull && <Check />}{t("locations-1.hideFull")}</button>
        {FILTERS.map(([f, label]) => {
          const on = filters.includes(f);
          return <button key={f} className="loc-chip" aria-pressed={on} onClick={() => setFilters(on ? filters.filter((x) => x !== f) : [...filters, f])}>{on && <Check />}{label}</button>;
        })}
        {(filters.length > 0 || hideFull || sort) && <button className="loc-chip reset" onClick={() => { setFilters([]); setHideFull(false); setSort(null); }}>{t("locations-1.reset")}</button>}
      </div>
      <WorldMap key={area} className="wm-add" initial={AREAS.find((a) => a[0] === area)![2]} markers={markers(city, hot)} onMarkerClick={(c) => setCity(c === city ? null : c)} onCityClick={(c) => setCity(CITIES.includes(c.name) && c.name !== city ? c.name : null)}>
        {city && (
          <div className="wm-panel" role="group" aria-label={city}>
            <h3>{city}</h3>
            {rows.map((d) => <button key={d.id} aria-pressed={d === dc} onClick={() => setDc(d.id)}><Logo provider={d.provider} size={16} />{d.name}</button>)}
          </div>
        )}
      </WorldMap>
      <div className="loc-dcs">
        <table className="table">
          <thead>
            <tr><Th k="name">{t("locations-1.datacenter")}</Th><Th k="space">{t("locations-1.space")}</Th><Th k="carriers">{t("locations-1.carriers")}</Th><Th k="exchange">{t("locations-1.exchange")}</Th><Th k="power">{t("locations-1.power")}</Th><Th k="kw" className="r">kW</Th><Th k="price" className="r">{t("locations-1.position")}</Th><Th k="cross" className="r">{t("locations-1.crossConnect")}</Th><Th k="hands">{t("locations-1.remoteHands")}</Th><th>{t("locations-1.other")}</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => <DcRow key={d.id} game={game} dc={d} selected={d === dc} onPick={() => setDc(d.id)} onHover={(on) => setHot(on ? d.city : null)} />)}
          </tbody>
        </table>
        {rows.length === 0 && <p className="loc-muted loc-none">{t("locations-1.noMatch")}</p>}
      </div>
      <div className="loc-sheet-foot">
        {dc ? <>
          <span className="logo-cell"><Logo provider={dc.provider} size={18} />{dc.name}</span>
          <div className="seg" role="group" aria-label={t("locations-1.space")}>
            {KINDS.map(([id, label]) => <button key={id} aria-pressed={k === id} disabled={id === "cage" && !dc.cages} onClick={() => setKind(id)}>{label}</button>)}
          </div>
          <div className="seg" role="group" aria-label={t("locations-1.size")}>
            {SPACE_SIZES[k].map((s) => (
              <button key={s} className={open(s) ? "" : "unfit"} aria-pressed={n === s} aria-label={k === "share" ? shareLabel(s) : positionsLabel(s)} onClick={() => setSize(s)}>
                <span className="num">{k !== "share" ? s : s === 1 ? t("locations-1.full") : `1/${s}`}</span>
              </button>
            ))}
          </div>
          <span className="grow" />
          {k === "share" && <>
            <span className="loc-k">{t("locations-1.rack")}</span><strong className="num">{shareUnits(n)}U · {+(dc.kwPerPosition / n).toFixed(2)} kW</strong>
          </>}
          <span className="loc-k">{t("locations-1.perMonth")}</span><strong className="num">{euro(spacePrice(dc, k, n))}</strong>
          <span className="loc-k">{t("locations-1.leadTime")}</span><strong className="num">{t("locations-1.nDays", { n: LEAD_DAYS[k] })}</strong>
          <button className="btn primary" onClick={add}>{open(n) ? t("locations-1.addLocation") : t("locations-1.joinWaitlist")}</button>
        </> : <span className="loc-muted">{t("locations-1.noneSelected")}</span>}
      </div>
    </Sheet>
  );
}

// One marker per catalog city, counting its datacenters.
const markers = (city: string | null, hot: string | null): Marker[] => CITIES.flatMap((name) => {
  const c = cityNamed(name), n = DATACENTERS.filter((d) => d.city === name).length;
  return c ? [{ id: name, lon: c.lon, lat: c.lat, label: name, kind: "datacenter", count: n, selected: name === city || name === hot }] : [];
});

// Free space as a value and a bar of competitors, the player (rented and held) and free positions.
function Availability({ game, dc }: { game: GameState; dc: Datacenter }) {
  const a = dcAvailability(game, dc.id), pct = (n: number) => `${(100 * n) / a.capacity}%`;
  const text = a.free > 0 ? t("locations-1.nFree", { n: a.free }) : a.freeEighths > 0 ? t("locations-1.eighthsFree", { n: a.freeEighths }) : t("locations-1.full");
  return (
    <span className="loc-avail">
      <span className={`num${a.freeEighths ? "" : " loc-full"}`}>{text}</span>
      <span className="loc-avail-bar" role="img" aria-label={t("locations-1.availAria", { others: a.others, mine: a.mine + a.held, free: a.free, capacity: a.capacity })}>
        <span className="others" style={{ width: pct(a.others) }} />
        <span className="mine" style={{ width: pct(a.mine + a.held) }} />
      </span>
    </span>
  );
}

function DcRow({ game, dc, selected, onPick, onHover }: { game: GameState; dc: Datacenter; selected: boolean; onPick: () => void; onHover: (on: boolean) => void }) {
  const ex = dc.exchange;
  return (
    <tr className={selected ? "sel" : ""} aria-selected={selected} onClick={onPick} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <td><button className="logo-cell loc-link" onClick={onPick}><Logo provider={dc.provider} size={18} /><span>{dc.name}<span className="loc-city">{dc.city}</span></span></button></td>
      <td><Availability game={game} dc={dc} /></td>
      <td><B off={dc.carriers < 5}><span className="num">{dc.carriers}</span></B></td>
      <td>{ex ? <B off={!ex.onSite}>{ex.onSite ? t("locations-1.exOnSite", { name: ex.name }) : t("locations-1.exCross", { name: ex.name })}</B> : <B off>{t("locations-1.none")}</B>}</td>
      <td><span className="loc-badges"><B off={dc.feeds === "single"}>{dc.feeds === "ab" ? "A+B" : t("locations-1.single")}</B><B off={dc.backup === "none"}>{dc.backup === "ups+generator" ? "UPS + gen" : dc.backup === "ups" ? "UPS" : t("locations-1.noUps")}</B></span></td>
      <td className="r num">{dc.kwPerPosition}</td>
      <td className="r num">{euro(dc.positionPrice)}</td>
      <td className="r num">{euro(dc.crossConnect)}</td>
      <td><span className="num">{euro(dc.remoteHands.perHour)}/h, {dc.remoteHands.responseHours} h</span></td>
      <td><span className="loc-badges">{dc.green && <Icon label={t("locations-1.greenPower")}><Leaf /></Icon>}{dc.certified && <Icon label={t("locations-1.fCertified")}><ShieldCheck /></Icon>}{dc.cages ? <B>{t("locations-1.fCages")}</B> : <B off>{t("locations-1.noCages")}</B>}</span></td>
    </tr>
  );
}
