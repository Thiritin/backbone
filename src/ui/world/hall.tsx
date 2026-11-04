// GDD, Own datacenter, In the room: what an own hall adds to the room drawn from its rows. Customer racks stand locked, empty
// positions are marked floor tiles, the floor between two rows facing each other is the cold aisle, cable trays run above the
// rows, positions beyond the cooled count shimmer while the hall runs hot, and a tripped hall goes dark.
import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import { customerTiles, rowTiles, zoneTiles, type Fixture, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import type { GameState, HallRow, Location } from "../../sim/50-state";
import { coverage } from "../../sim/60-infra/thermal";
import { editThings, Cooler, PlanBoard } from "./hall-edit";
import { at3, cageFence, Door, Night, onX, onY, pts, Prism, rackHeight, RackBox, Shimmer, Tubes, WALL } from "./draw";
import { hueOf } from "./hall-doors";
import { iso } from "./grid";
import "./hall.css";

type Thing = { depth: number; node: ReactNode };
const STEP: Record<HallRow["facing"], [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
// Cable trays hang just above the rack tops, under the tubes.
const TRAY_Z = rackHeight(42) + 2;

const Mark = ({ tile }: { tile: Tile }) => {
  const i = 0.12;
  return <polygon className="w-hall-mark" points={pts(iso(tile.x + i, tile.y + i), iso(tile.x + 1 - i, tile.y + i), iso(tile.x + 1 - i, tile.y + 1 - i), iso(tile.x + i, tile.y + 1 - i))} />;
};

// A padlock hung on the front of a customer's rack.
const Lock = ({ tile }: { tile: Tile }) => {
  const c = at3(tile.x + 0.5, tile.y + 0.5, rackHeight(42) + 10);
  return (
    <g className="w-hall-lock" transform={`translate(${c.x} ${c.y})`}>
      <path d="M-3,-2 v-3 a3,3 0 0 1 6,0 v3" />
      <rect x="-4.5" y="-2" width="9" height="7" rx="1.2" />
    </g>
  );
};

// The exchange's rack carries a plate in the exchange's colour with its name.
const Plate = ({ tile, name, hue }: { tile: Tile; name: string; hue: number }) => {
  const c = at3(tile.x + 0.5, tile.y + 0.5, rackHeight(42) + 12);
  return (
    <g className="w-hall-plate" transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
      <rect x="-20" y="-7" width="40" height="11" rx="1.5" style={{ fill: `oklch(0.62 0.14 ${hue})` }} />
      <text x="0" y="1" >{name}</text>
    </g>
  );
};

// A steel service door in the left wall with its sign beside it.
const ServiceDoor = ({ f, label }: { f: Fixture; label: string }) => (
  <>
    <Door f={f} open={0} steel />
    <g transform={onX(0, f.y + 1, 90)}><rect className="w-hall-sign" x="-4" y="0" width="40" height="7" rx="1" /><text className="w-hall-sign-t" x="16" y="5">{label}</text></g>
  </>
);

const Camera = ({ f }: { f: Fixture }) => (
  <g transform={onY(f.x + 0.4, 0, WALL - 8)}>
    <rect className="w-hall-cam" x="0" y="0" width="10" height="5" rx="1" />
    <rect className="w-led w-led-on" x="1.5" y="1.8" width="1.5" height="1.2" />
  </g>
);

export function hallScene(game: GameState, loc: Location, plan: OfficePlan | undefined, tiles: Record<string, Tile>, size: { w: number; h: number },
  things: Thing[], draw: Record<string, (f: Fixture) => ReactNode>, editing = false): void {
  const hall = plan?.hall;
  if (!hall) return;
  Object.assign(draw, {
    xfmrdoor: (f: Fixture) => <ServiceDoor f={f} label={t("hall.room.transformer")} />,
    meetmedoor: (f: Fixture) => <ServiceDoor f={f} label={t("hall.room.meetme")} />,
    planboard: (f: Fixture) => <PlanBoard f={f} />,
    cooling: (f: Fixture) => <Cooler f={f} />,
    camera: (f: Fixture) => <Camera f={f} />,
  });
  const taken = new Set(Object.values(tiles).map(key)), customers = customerTiles(loc, plan);
  for (const c of customers) taken.add(key(c.tile));
  // The cold aisle: floor tiles two rows face onto.
  const fronts = new Map<string, number>();
  for (const r of hall.rows) for (const tl of rowTiles(r)) { const f = key({ x: tl.x + STEP[r.facing][0], y: tl.y + STEP[r.facing][1] }); fronts.set(f, (fronts.get(f) ?? 0) + 1); }
  for (const [k, n] of fronts) {
    if (n < 2) continue;
    const [x, y] = k.split(",").map(Number);
    things.push({ depth: -2, node: <polygon key={`aisle${k}`} className="w-hall-aisle" pointerEvents="none" points={pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1))} /> });
  }
  for (const r of hall.rows)
    rowTiles(r).forEach((tl) => { if (!taken.has(key(tl))) things.push({ depth: -1, node: <g key={`mark${key(tl)}`} aria-hidden pointerEvents="none"><Mark tile={tl} /></g> }); });
  // Zones are floor paint: a grey band for open colocation; cages and the meet-me area carry the fence as well.
  for (const z of zoneTiles(loc, plan)) {
    if (!z.tiles.length) continue;
    for (const tl of z.tiles) things.push({ depth: -1.8, node: <polygon key={`z${z.id}${key(tl)}`} className={`w-zone-${z.kind}`} pointerEvents="none" points={pts(iso(tl.x, tl.y), iso(tl.x + 1, tl.y), iso(tl.x + 1, tl.y + 1), iso(tl.x, tl.y + 1))} /> });
    if (z.kind === "colo") continue;
    const xs = z.tiles.map((q) => q.x), ys = z.tiles.map((q) => q.y), x0 = Math.min(...xs);
    things.push(...cageFence({ x0, y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), door: x0 }).map((f, i) => ({ ...f, node: <g key={`${z.id}:${i}`}>{f.node}</g> })));
  }
  for (const c of customers) {
    const ex = c.id === hall.exchange?.id;
    things.push({ depth: c.tile.x + c.tile.y, node: <g key={`colo${c.id}`} aria-label={c.name}><RackBox tile={c.tile} units={42} items={[]} leds={[]} zoomed={false} mesh neighbour /><Lock tile={c.tile} />{ex && <Plate tile={c.tile} name={c.name} hue={hueOf(c.id)} />}</g> });
  }
  // Positions no cooling unit covers shimmer while the hall carries heat.
  const cov = coverage(game, loc), all = hall.rows.flatMap(rowTiles);
  if ((game.ops.heat[loc.id] ?? 0) > 0.5)
    all.filter((tl, i) => cov[i] === false && taken.has(key(tl))).forEach((tl) => things.push({ depth: tl.x + tl.y + 0.9, node: <Shimmer key={`hot${key(tl)}`} tile={tl} z={rackHeight(42)} /> }));
  const trays = (
    <g key="trays" pointerEvents="none" aria-hidden>
      {hall.rows.map((r) => {
        const along = r.facing === "n" || r.facing === "s", x1 = along ? r.x + r.length : r.x + 1, y1 = along ? r.y + 1 : r.y + r.length;
        return <Prism key={r.id} x0={along ? r.x : r.x + 0.42} y0={along ? r.y + 0.42 : r.y} x1={along ? x1 : r.x + 0.58} y1={along ? r.y + 0.58 : y1} z0={TRAY_Z} z1={TRAY_Z + 1.5} tone="w-tone-cool" />;
      })}
      <Tubes tiles={all.filter((tl) => !taken.has(key(tl)))} />
    </g>
  );
  things.push({ depth: 1e6, node: trays });
  if (editing) editThings(game, loc, plan, size, tiles, (depth, node) => things.push({ depth, node }));
  if (loc.tripped) things.push({ depth: 1e9, node: <Night key="dark" w={size.w} h={size.h} opacity={0.6} /> });
}
