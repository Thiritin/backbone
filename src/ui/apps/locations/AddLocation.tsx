import { Leaf, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { DATACENTERS, LEAD_DAYS, SPACE_SIZES, spacePrice, type Datacenter } from "../../../sim/20-world/datacenters";
import type { SpaceKind } from "../../../sim/50-state";
import { addLocation } from "../../../sim/90-actions/hardware";
import { Logo } from "../../art/logos";
import { cityNamed, WorldMap, type Marker } from "../../map/WorldMap";
import { useStore } from "../../store";
import { positionsLabel, shareLabel, shareUnits, Sheet } from "./ui";

type Rented = Exclude<SpaceKind, "basement">;
const CITIES = [...new Set(DATACENTERS.map((d) => d.city))];
const KINDS: [Rented, string][] = [["share", "Rack share"], ["positions", "Positions"], ["cage", "Cage"], ["suite", "Suite"]];

// A badge for a property; `off` marks the weaker side of the comparison.
const B = ({ children, off }: { children: ReactNode; off?: boolean }) => <span className={`loc-badge${off ? " off" : ""}`}>{children}</span>;
const Icon = ({ label, children }: { label: string; children: ReactNode }) => <span className="loc-icon" role="img" title={label} aria-label={label}>{children}</span>;

export function AddLocation({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const [city, setCity] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [dcId, setDc] = useState<string | null>(null);
  const [kind, setKind] = useState<Rented>("share");
  const [size, setSize] = useState(1);
  const rows = DATACENTERS.filter((d) => !city || d.city === city);
  const dc = DATACENTERS.find((d) => d.id === dcId && rows.includes(d)) ?? null;
  const k: Rented = kind === "cage" && dc && !dc.cages ? "positions" : kind;
  const n = SPACE_SIZES[k].includes(size) ? size : SPACE_SIZES[k][0];
  const add = () => {
    if (!dc) return;
    const r = act((s) => addLocation(s, dc.id, k, n));
    if (r.ok && r.id) onAdded(r.id);
  };

  return (
    <Sheet title="Add location" onClose={onClose} wide>
      <div className="loc-sheet-bar">
        <div className="seg" role="group" aria-label="City">
          <button aria-pressed={!city} onClick={() => setCity(null)}>All</button>
          {CITIES.map((c) => <button key={c} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>)}
        </div>
      </div>
      <WorldMap className="wm-add" initial={{ west: -1, south: 45, east: 17, north: 53 }} markers={markers(city, hot)} onMarkerClick={(c) => setCity(c === city ? null : c)} onCityClick={(c) => setCity(CITIES.includes(c.name) && c.name !== city ? c.name : null)}>
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
            <tr><th>Datacenter</th><th>Carriers</th><th>Exchange</th><th>Power</th><th className="r">kW</th><th className="r">Position</th><th className="r">Cross-connect</th><th>Remote hands</th><th>Other</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => <DcRow key={d.id} dc={d} selected={d === dc} onPick={() => setDc(d.id)} onHover={(on) => setHot(on ? d.city : null)} />)}
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
              <button key={s} aria-pressed={n === s} aria-label={k === "share" ? shareLabel(s) : positionsLabel(s)} onClick={() => setSize(s)}>
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
          <button className="btn primary" onClick={add}>Add location</button>
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

function DcRow({ dc, selected, onPick, onHover }: { dc: Datacenter; selected: boolean; onPick: () => void; onHover: (on: boolean) => void }) {
  const ex = dc.exchange;
  return (
    <tr className={selected ? "sel" : ""} aria-selected={selected} onClick={onPick} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <td><button className="logo-cell loc-link" onClick={onPick}><Logo provider={dc.provider} size={18} /><span>{dc.name}<span className="loc-city">{dc.city}</span></span></button></td>
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
