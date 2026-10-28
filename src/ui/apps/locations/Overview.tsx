import type { GameState, Location } from "../../../sim/50-state";
import { freePositions } from "../../../sim/60-infra/status";
import { LED } from "../../art/fronts";
import { Logo } from "../../art/logos";
import { day } from "../hw";
import { backupLabel, dcOf, exchangeLabel, Facts, feedsLabel, locationPower, PowerMeter, providerOf, spaceLabel } from "./ui";

// Map of the backbone cities, projected like the wallpaper.
const CITY: Record<string, [number, number]> = {
  London: [-0.13, 51.5], Paris: [2.35, 48.86], Amsterdam: [4.9, 52.37], Frankfurt: [8.68, 50.11],
  Berlin: [13.4, 52.52], Zurich: [8.54, 47.37], Milan: [9.19, 45.46], Vienna: [16.37, 48.21],
};
const LINKS = [["Frankfurt", "Amsterdam"], ["Frankfurt", "Paris"], ["Frankfurt", "Berlin"], ["Frankfurt", "Zurich"], ["Frankfurt", "Vienna"], ["Amsterdam", "London"], ["London", "Paris"], ["Paris", "Milan"], ["Zurich", "Milan"], ["Berlin", "Vienna"], ["Amsterdam", "Berlin"], ["Milan", "Vienna"]];
const W = 640, H = 300;
const xy = (city: string): [number, number] => { const [lon, lat] = CITY[city] ?? CITY.Frankfurt; return [(lon + 2.2) * 31, (53.6 - lat) * 34.5]; };

export function Overview({ game, onOpen }: { game: GameState; onOpen: (id: string) => void }) {
  return (
    <div className="loc-scroll">
      <div className="loc-map"><EuropeMap game={game} onOpen={onOpen} /></div>
      <div className="loc-cards">
        {game.locations.map((l) => <LocationCard key={l.id} game={game} loc={l} onOpen={() => onOpen(l.id)} />)}
      </div>
    </div>
  );
}

function EuropeMap({ game, onOpen }: { game: GameState; onOpen: (id: string) => void }) {
  let dots = "";
  for (let x = -392; x < W + 400; x += 16) for (let y = 8; y < H; y += 16) dots += `M${x} ${y}h0.01`;
  const seen: Record<string, number> = {};
  return (
    <svg viewBox="-60 10 760 290" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Map of your locations">
      
      <path d={dots} stroke="var(--map-block)" strokeWidth="5" strokeLinecap="round" />
      <g fill="none" stroke="var(--map-major)" strokeWidth="2.5" strokeLinecap="round">
        {LINKS.map(([a, b]) => {
          const [x1, y1] = xy(a), [x2, y2] = xy(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.15;
          return <path key={a + b} d={`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`} />;
        })}
      </g>
      <g fontFamily="Inter, sans-serif" fontSize="11" fill="var(--map-label)">
        {Object.keys(CITY).map((c) => { const [x, y] = xy(c); return <g key={c}><circle cx={x} cy={y} r="2.5" fill="var(--map-label)" /><text x={x + 6} y={y - 6}>{c}</text></g>; })}
      </g>
      <g fontFamily="Inter, sans-serif">
        {game.locations.map((l) => {
          const k = (seen[l.city] = (seen[l.city] ?? -1) + 1), [cx, cy] = xy(l.city), x = cx + k * 20, y = cy + 14 + (k % 2) * 4;
          const bad = locationPower(game, l.id).tripped;
          return (
            <g key={l.id} className="loc-pin" role="button" tabIndex={0} aria-label={l.name} onClick={() => onOpen(l.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(l.id)}>
              <circle cx={x} cy={y} r="7.5" fill="var(--win)" stroke="var(--accent)" strokeWidth="2" />
              <circle cx={x} cy={y} r="2.6" fill="var(--accent)" />
              {bad && <circle cx={x + 6.5} cy={y - 6.5} r="3.6" fill={LED.bad} stroke="var(--map-bg)" strokeWidth="1.5" />}
              <text x={x} y={y + 21 + k * 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)" stroke="var(--map-bg)" strokeWidth="3.5" paintOrder="stroke" strokeLinejoin="round">{l.name}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function LocationCard({ game, loc, onOpen }: { game: GameState; loc: Location; onOpen: () => void }) {
  const dc = dcOf(loc), power = locationPower(game, loc.id), used = loc.positions - freePositions(game, loc.id).length;
  const arriving = game.racks.filter((r) => r.locationId === loc.id && r.arriveAt !== null);
  return (
    <div className="loc-card loc-site" onClick={onOpen}>
      <div className="loc-card-h">
        <h3><Logo provider={providerOf(loc)} size={18} /><button className="loc-link" onClick={onOpen}>{loc.name}</button></h3>
        <span className="grow" />
        {loc.readyAt > game.hour && <span className="pill">Ready <span className="num">{day(loc.readyAt)}</span></span>}
      </div>
      <Facts rows={[
        ["Space", spaceLabel(loc)],
        ["Positions", <span className="num">{used} / {loc.positions}</span>],
        ["Power protection", dc ? `${feedsLabel(dc)}, ${backupLabel(dc)}` : "None"],
        ["Green power", dc?.green ? "Yes" : "No"],
        ["Carriers", dc ? <span className="num">{dc.carriers}</span> : "Home line"],
        ["Exchange", exchangeLabel(dc)],
      ]} />
      <div className="loc-row"><span className="loc-k">Power</span><PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} /></div>
      {arriving.map((r) => <div key={r.id} className="loc-row"><span className="loc-k">In transit</span>{r.name}<span className="grow" /><span className="num">{day(r.arriveAt!)}</span></div>)}
    </div>
  );
}
