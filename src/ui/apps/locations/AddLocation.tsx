import { Leaf, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { DATACENTERS, inUs, LEAD_DAYS, SPACE_SIZES, spacePrice, type Datacenter } from "../../../sim/20-world/datacenters";
import type { GameState, SpaceKind } from "../../../sim/50-state";
import { dcAvailability, fits } from "../../../sim/60-infra/status";
import { addLocation, joinWaitlist } from "../../../sim/90-actions/hardware";
import { Logo } from "../../art/logos";
import { cityNamed, WorldMap, type Bounds, type Marker } from "../../map/WorldMap";
import { useStore } from "../../store";
import { positionsLabel, shareLabel, shareUnits, Sheet, spaceSize } from "./ui";

type Rented = Exclude<SpaceKind, "basement">;
const CITIES = [...new Set(DATACENTERS.map((d) => d.city))];
type Area = "eu" | "us";
const AREAS: [Area, string, Bounds][] = [["eu", "Europe", { west: -1, south: 45, east: 17, north: 53 }], ["us", "North America", { west: -122, south: 28, east: -72, north: 46 }]];
const KINDS: [Rented, string][] = [["share", "Rack share"], ["positions", "Positions"], ["cage", "Cage"], ["suite", "Suite"]];

// A badge for a property; `off` marks the weaker side of the comparison.
const B = ({ children, off }: { children: ReactNode; off?: boolean }) => <span className={`loc-badge${off ? " off" : ""}`}>{children}</span>;
const Icon = ({ label, children }: { label: string; children: ReactNode }) => <span className="loc-icon" role="img" title={label} aria-label={label}>{children}</span>;

export function AddLocation({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const act = useStore((s) => s.act), game = useStore((s) => s.game), notify = useStore((s) => s.notify);
  const [hideFull, setHideFull] = useState(false);
  const [area, setArea] = useState<Area>("eu");
  const [city, setCity] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [dcId, setDc] = useState<string | null>(null);
  const [kind, setKind] = useState<Rented>("share");
  const [size, setSize] = useState(1);
  const cities = CITIES.filter((c) => inUs(c) === (area === "us"));
  const rows = DATACENTERS.filter((d) => (city ? d.city === city : cities.includes(d.city)) && (!hideFull || dcAvailability(game, d.id).freeEighths > 0));
  const dc = DATACENTERS.find((d) => d.id === dcId && rows.includes(d)) ?? null;
  const k: Rented = kind === "cage" && dc && !dc.cages ? "positions" : kind;
  const n = SPACE_SIZES[k].includes(size) ? size : SPACE_SIZES[k][0];
  // A size is open when it is free now or the waitlist holds it for the player.
  const open = (s: number) => !!dc && (fits(game, dc.id, k, s) || game.waitlist.some((w) => w.dc === dc.id && w.space === k && w.size === s && w.heldUntil !== null));
  const add = () => {
    if (!dc) return;
    if (!open(n)) {
      if (act((s) => joinWaitlist(s, dc.id, k, n)).ok) { notify("Locations", "Joined waitlist", `${dc.name}, ${spaceSize(k, n)}`); onClose(); }
      return;
    }
    const r = act((s) => addLocation(s, dc.id, k, n));
    if (r.ok && r.id) onAdded(r.id);
  };

  return (
    <Sheet title="Add location" onClose={onClose} wide>
      <div className="loc-sheet-bar">
        <div className="seg" role="group" aria-label="Area">
          {AREAS.map(([id, label]) => <button key={id} aria-pressed={area === id} onClick={() => { setArea(id); setCity(null); }}>{label}</button>)}
        </div>
        <span className="grow" />
        <button className="btn ghost" aria-pressed={hideFull} onClick={() => setHideFull(!hideFull)}>Hide full</button>
        <div className="loc-cities">
          <div className="seg" role="group" aria-label="City">
            <button aria-pressed={!city} onClick={() => setCity(null)}>All</button>
            {cities.map((c) => <button key={c} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>)}
          </div>
        </div>
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
            <tr><th>Datacenter</th><th>Space</th><th>Carriers</th><th>Exchange</th><th>Power</th><th className="r">kW</th><th className="r">Position</th><th className="r">Cross-connect</th><th>Remote hands</th><th>Other</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => <DcRow key={d.id} game={game} dc={d} selected={d === dc} onPick={() => setDc(d.id)} onHover={(on) => setHot(on ? d.city : null)} />)}
          </tbody>
        </table>
      </div>
      <div className="loc-sheet-foot">
        {dc ? <>
          <span className="logo-cell"><Logo provider={dc.provider} size={18} />{dc.name}</span>
          <div className="seg" role="group" aria-label="Space">
            {KINDS.map(([id, label]) => <button key={id} aria-pressed={k === id} disabled={id === "cage" && !dc.cages} onClick={() => setKind(id)}>{label}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Size">
            {SPACE_SIZES[k].map((s) => (
              <button key={s} className={open(s) ? "" : "unfit"} aria-pressed={n === s} aria-label={k === "share" ? shareLabel(s) : positionsLabel(s)} onClick={() => setSize(s)}>
                <span className="num">{k !== "share" ? s : s === 1 ? "Full" : `1/${s}`}</span>
              </button>
            ))}
          </div>
          <span className="grow" />
          {k === "share" && <>
            <span className="loc-k">Share</span><strong className="num">{shareUnits(n)}U · {+(dc.kwPerPosition / n).toFixed(2)} kW</strong>
          </>}
          <span className="loc-k">Per month</span><strong className="num">{euro(spacePrice(dc, k, n))}</strong>
          <span className="loc-k">Lead time</span><strong className="num">{LEAD_DAYS[k]} days</strong>
          <button className="btn primary" onClick={add}>{open(n) ? "Add location" : "Join waitlist"}</button>
        </> : <span className="loc-muted">No datacenter selected</span>}
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
  const text = a.free > 0 ? `${a.free} free` : a.freeEighths > 0 ? `${a.freeEighths}/8 rack free` : "Full";
  return (
    <span className="loc-avail">
      <span className={`num${a.freeEighths ? "" : " loc-full"}`}>{text}</span>
      <span className="loc-avail-bar" role="img" aria-label={`${a.others} rented by others, ${a.mine + a.held} yours, ${a.free} free of ${a.capacity}`}>
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
      <td>{ex ? <B off={!ex.onSite}>{ex.name} {ex.onSite ? "on site" : "by cross-connect"}</B> : <B off>None</B>}</td>
      <td><span className="loc-badges"><B off={dc.feeds === "single"}>{dc.feeds === "ab" ? "A+B" : "Single"}</B><B off={dc.backup === "none"}>{dc.backup === "ups+generator" ? "UPS + gen" : dc.backup === "ups" ? "UPS" : "No UPS"}</B></span></td>
      <td className="r num">{dc.kwPerPosition}</td>
      <td className="r num">{euro(dc.positionPrice)}</td>
      <td className="r num">{euro(dc.crossConnect)}</td>
      <td><span className="num">{euro(dc.remoteHands.perHour)}/h, {dc.remoteHands.responseHours} h</span></td>
      <td><span className="loc-badges">{dc.green && <Icon label="Green power"><Leaf /></Icon>}{dc.certified && <Icon label="Certified"><ShieldCheck /></Icon>}{dc.cages ? <B>Cages</B> : <B off>No cages</B>}</span></td>
    </tr>
  );
}
