// GDD, Own datacenter, In the room: what an own hall adds to the room drawn from its rows. Customer racks stand locked, empty
// positions are marked floor tiles, the floor between two rows facing each other is the cold aisle, cable trays run above the
// rows, positions beyond the cooled count shimmer while the hall runs hot, and a tripped hall goes dark.
import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import { customerTiles, zoneTiles, type Fixture, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import type { GameState, Location } from "../../sim/50-state";
import { editThings, PlanBoard } from "./hall-edit";
import { annexScene } from "./hall-annex";
import { Hatch, MainBoard } from "./hall-art";
import { at3, cageFence, Door, Night, onX, onY, pts, rackHeight, RackBox, WALL } from "./draw";
import { hueOf } from "./hall-doors";
import { iso } from "./grid";
import "./hall.css";

type Thing = { depth: number; node: ReactNode };
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

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
    meetmedoor: (f: Fixture) => <ServiceDoor f={f} label={t("hall.room.meetme")} />,
    planboard: (f: Fixture) => <PlanBoard f={f} />,
    camera: (f: Fixture) => <Camera f={f} />,
    mainboard: (f: Fixture) => <MainBoard x={f.x} y={f.y} axis="y" />,
    // Cooling units and NOC desks are items of the layout, drawn with the rest of the placed things.
    cooling: () => null,
    noc: (f: Fixture) => <polygon points={pts(iso(f.x, f.y), iso(f.x + (f.w ?? 1), f.y), iso(f.x + (f.w ?? 1), f.y + 1), iso(f.x, f.y + 1))} fill="rgba(0,0,0,0)" />,
  });
  annexScene(game, loc, plan, tiles, (depth, node) => things.push({ depth, node }));
  const taken = new Set(Object.values(tiles).map(key)), customers = customerTiles(loc, plan);
  for (const c of customers) taken.add(key(c.tile));
  // Zones are floor paint: a grey band for open colocation; cages and the meet-me area carry the fence as well.
  for (const z of zoneTiles(loc, plan)) {
    if (!z.tiles.length) continue;
    for (const tl of z.tiles) things.push({ depth: -1.8, node: <polygon key={`z${z.id}${key(tl)}`} className={`w-zone-${z.kind}`} pointerEvents="none" points={pts(iso(tl.x, tl.y), iso(tl.x + 1, tl.y), iso(tl.x + 1, tl.y + 1), iso(tl.x, tl.y + 1))} /> });
    for (const tl of z.tiles) if (!taken.has(key(tl))) things.push({ depth: -1, node: <g key={`mark${key(tl)}`} aria-hidden pointerEvents="none"><Mark tile={tl} /></g> });
    const xs = z.tiles.map((q) => q.x), ys = z.tiles.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
    things.push({ depth: -1.7, node: <polygon key={`ze${z.id}`} className={`w-zone-edge w-zone-edge-${z.kind}`} pointerEvents="none" points={pts(iso(x0, y0), iso(x0 + w, y0), iso(x0 + w, y0 + h), iso(x0, y0 + h))} /> });
    if (z.kind === "meetme") things.push({ depth: -1.6, node: <g key={`zh${z.id}`} pointerEvents="none"><Hatch x={x0} y={y0} w={w} h={h} m={0.12} /></g> });
    if (z.kind === "colo") continue;
    things.push(...cageFence({ x0, y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), door: x0 }).map((f, i) => ({ ...f, node: <g key={`${z.id}:${i}`}>{f.node}</g> })));
  }
  for (const c of customers) {
    const ex = c.id === hall.exchange?.id;
    things.push({ depth: c.tile.x + c.tile.y, node: <g key={`colo${c.id}${key(c.tile)}`} aria-label={c.name}><RackBox tile={c.tile} units={42} items={[]} leds={[]} zoomed={false} mesh neighbour /><Lock tile={c.tile} />{ex && <Plate tile={c.tile} name={c.name} hue={hueOf(c.id)} />}</g> });
  }
  if (editing) editThings(game, loc, plan, (depth, node) => things.push({ depth, node }));
  if (loc.tripped) things.push({ depth: 1e9, node: <Night key="dark" w={size.w} h={size.h} opacity={0.6} /> });
}
