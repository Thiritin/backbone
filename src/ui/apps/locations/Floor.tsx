import { Plus, Truck } from "lucide-react";
import { useRef, useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById } from "../../../sim/10-catalog/hardware";
import { BASEMENT, RACK_MODELS, rackUnits as simRackUnits } from "../../../sim/20-world/datacenters";
import type { GameState, Location, Rack } from "../../../sim/50-state";
import { rackPower } from "../../../sim/60-infra/status";
import { buyRack } from "../../../sim/90-actions/hardware";
import { DeviceSvg, LED } from "../../art/fronts";
import { useStore } from "../../store";
import { day, deviceLamps } from "../hw";
import { PowerMeter, useDismiss } from "./ui";

export const rackUnits = (r: Rack) => simRackUnits(r.model);

export function Floor({ game, loc, onRack }: { game: GameState; loc: Location; onRack: (id: string) => void }) {
  const at = new Map(game.racks.filter((r) => r.locationId === loc.id).map((r) => [r.position, r]));
  return (
    <div className="loc-floor" aria-label="Floor">
      {Array.from({ length: loc.positions }, (_, i) => i + 1).map((p) => {
        const r = at.get(p);
        return r ? <RackTile key={p} game={game} rack={r} onOpen={() => onRack(r.id)} /> : <FreeTile key={p} loc={loc} position={p} onBought={onRack} />;
      })}
    </div>
  );
}

function RackTile({ game, rack, onOpen }: { game: GameState; rack: Rack; onOpen: () => void }) {
  const units = rackUnits(rack), devices = game.devices.filter((d) => d.rackId === rack.id);
  const used = devices.reduce((n, d) => n + modelById(d.model).height, 0), power = rackPower(game, rack.id), uh = 2.6;
  return (
    <button className={`loc-tile${rack.arriveAt !== null ? " transit" : ""}`} onClick={onOpen}>
      <span className="loc-tile-pos num">{rack.position}</span>
      <svg width="46" height={units * uh + 6} viewBox={`0 0 46 ${units * uh + 6}`} aria-hidden="true">
        <rect width="46" height={units * uh + 6} rx="3" fill="var(--rack)" />
        {devices.map((d) => {
          const m = modelById(d.model), y = 3 + (units - d.slot - m.height + 1) * uh;
          return <g key={d.id}><rect x="5" y={y + 0.3} width="36" height={m.height * uh - 0.6} rx="0.6" fill="oklch(0.48 0.01 255)" /><circle cx="37" cy={y + (m.height * uh) / 2} r="0.9" fill={LED[deviceLamps(game, d.id, m).state]} /></g>;
        })}
      </svg>
      <strong>{rack.name}</strong>
      {rack.provided && <span className="pill">Provided</span>}
      <span className="num loc-tile-sub">{used} / {units} U</span>
      {rack.arriveAt !== null
        ? <span className="pill"><Truck />Arrives <span className="num">{day(rack.arriveAt)}</span></span>
        : <PowerMeter watts={power.watts} limit={power.limitWatts} tripped={power.tripped} />}
      {power.tripped && <span className="pill bad">Tripped</span>}
    </button>
  );
}

function FreeTile({ loc, position, onBought }: { loc: Location; position: number; onBought: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false));
  const models = RACK_MODELS.filter((m) => loc.space !== "basement" || m.units <= BASEMENT.maxUnits);
  return (
    <div className="loc-tile-wrap" ref={ref}>
      <button className="loc-tile free" aria-expanded={open} aria-label={`Position ${position} free`} onClick={() => setOpen(!open)}>
        <span className="loc-tile-pos num">{position}</span>
        <Plus />
        <span className="loc-tile-sub">Free</span>
      </button>
      {open && (
        <div className="loc-pop" role="dialog" aria-label={`Buy a rack for position ${position}`}>
          {models.map((m) => (
            <div key={m.id} className="loc-pop-row">
              <strong className="num">{m.units}U</strong>
              <span className="grow" />
              <span className="num">{euro(m.price)}</span>
              <button className="btn primary" onClick={() => { const r = act((s) => buyRack(s, loc.id, m.id, position)); if (r.ok) { setOpen(false); if (r.id) onBought(r.id); } }}>Buy</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CarrierPanel({ game, loc, selected, onDevice }: { game: GameState; loc: Location; selected: string | null; onDevice: (id: string) => void }) {
  const gws = game.devices.filter((d) => d.panel === loc.id);
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>Carrier panel</h3></div>
      <div className="loc-panel">
        {gws.map((d) => {
          const m = modelById(d.model);
          return (
            <button key={d.id} className="loc-panel-dev" aria-pressed={d.id === selected} onClick={() => onDevice(d.id)}>
              <DeviceSvg model={m} brand={d.brand} name={d.name} {...deviceLamps(game, d.id, m)} w={420} u={26} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
