import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { GameState, Location } from "../../../sim/50-state";
import { shelfId, storageStacks } from "../../../sim/60-infra/status";
import { mountDevice } from "../../../sim/90-actions/hardware";
import { DeviceSvg } from "../../art/fronts";
import { Isometric } from "../../art/Isometric";
import { useStore } from "../../store";
import { rackItems } from "./RackView";

// The places of a location's shelf with the towers standing on it. onFree makes a free place pick-able; without it a free
// place lists the stored towers to mount there.
export function Shelf({ game, loc, selected, onDevice, onMenu, onFree }: {
  game: GameState; loc: Location; selected?: string | null; onDevice?: (id: string) => void; onMenu?: (id: string, e: ReactMouseEvent) => void; onFree?: (place: number) => void;
}) {
  const [place, setPlace] = useState<number | null>(null);
  const items = rackItems(game, shelfId(loc.id));
  if (!loc.shelf) return null;
  return (
    <div className="loc-shelf">
      <div className="loc-shelf-h"><h3>Shelf</h3><span className="grow" /><span className="num loc-muted">{items.length} / {loc.shelf}</span></div>
      <div className="loc-shelf-row">
        {Array.from({ length: loc.shelf }, (_, i) => i + 1).map((p) => {
          const it = items.find((x) => x.slot === p);
          return it ? (
            <button key={p} className="loc-shelf-tower" aria-pressed={selected === it.id} aria-label={it.name} onClick={() => onDevice?.(it.id)} onContextMenu={(e) => onMenu?.(it.id, e)}>
              <DeviceSvg {...it} w={68} u={100} />
              <span className="num">{it.name}</span>
            </button>
          ) : (
            <button key={p} className="loc-shelf-free" aria-label={`Place ${p}`} onClick={() => (onFree ? onFree(p) : setPlace(place === p ? null : p))}>
              <span className="num">{p}</span>
            </button>
          );
        })}
      </div>
      {place !== null && <ShelfPick game={game} loc={loc} place={place} onDone={(id) => { setPlace(null); onDevice?.(id); }} />}
    </div>
  );
}

// Stored towers of the location that can take a free place.
function ShelfPick({ game, loc, place, onDone }: { game: GameState; loc: Location; place: number; onDone: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const rows = storageStacks(game, loc.id).filter((st) => modelById(st.model).shelf);
  return (
    <div className="loc-shelf-pick" role="group" aria-label={`Mount at place ${place}`}>
      {rows.map((st) => {
        const m = modelById(st.model);
        return (
          <div key={`${st.model}|${st.brand}`} className="loc-shop-row">
            <Isometric model={m} brand={st.brand} w={64} />
            <div className="loc-shop-main">
              <div className="loc-shop-name">{st.brand} {m.name}</div>
              <div className="loc-shop-specs num">{st.ids.length} in storage</div>
            </div>
            <button className="btn primary" onClick={() => act(mountDevice, st.ids[0], shelfId(loc.id), place).ok && onDone(st.ids[0])}>Mount</button>
          </div>
        );
      })}
      {!rows.length && <div className="loc-shop-none">No stored unit fits</div>}
    </div>
  );
}
