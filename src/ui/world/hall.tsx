// GDD, Own datacenter, In the room: what an own hall adds to the room drawn from its rows. Customer racks stand locked, empty
// positions are marked floor tiles, the floor between two rows facing each other is the cold aisle, cable trays run above the
// rows, positions beyond the cooled count shimmer while the hall runs hot, and a tripped hall goes dark.
import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import { customerTiles, siteAreas, zoneTiles, type Fixture, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import { isHalle } from "../../sim/20-world/properties";
import { airTones } from "../../sim/60-infra/airflow";
import type { GameState, Location } from "../../sim/50-state";
import { hallAt, unmaintained } from "../../sim/90-actions/hall";
import { editThings, PlanBoard } from "./hall-edit";
import { annexScene, corner, itemTiles } from "./hall-annex";
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

// A flat marker over a rack or an item that has no way to its service front.
const Unmaintained = ({ tile, z }: { tile: { x: number; y: number }; z: number }) => {
  const c = at3(tile.x + 0.5, tile.y + 0.5, z);
  return (
    <g className="w-hall-unm" transform={`translate(${c.x} ${c.y})`}>
      <title>{t("hall.unmaintained")}</title>
      <polygon points="0,-6 7,6 -7,6" /><rect x="-0.8" y="-2" width="1.6" height="4.5" /><rect x="-0.8" y="3.4" width="1.6" height="1.6" />
    </g>
  );
};

// The exchange's rack carries a plate in the exchange's colour with its name.
const Plate = ({ tile, name, hue }: { tile: Tile; name: string; hue: number }) => {
  const c = at3(tile.x + 0.5, tile.y + 0.5, rackHeight(42) + 12);
  return (
    <g className="w-hall-plate" transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
      <rect x="-20" y="-7" width="40" height="11" style={{ fill: `oklch(0.62 0.14 ${hue})` }} />
      <text x="0" y="1" >{name}</text>
    </g>
  );
};

// A steel service door in the left wall with its sign beside it.
const ServiceDoor = ({ f, label }: { f: Fixture; label: string }) => (
  <>
    <Door f={f} open={0} steel />
    <g transform={onX(0, f.y + 1, 90)}><rect className="w-hall-sign" x="-4" y="0" width="40" height="7" /><text className="w-hall-sign-t" x="16" y="5">{label}</text></g>
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
    noc: () => null,
  });
  annexScene(game, loc, plan, tiles, (depth, node) => things.push({ depth, node }));
  // Air tones are floor paint: a rack's intake and exhaust tiles in the tone of the air they get.
  for (const [k, tone] of Object.entries(airTones(game, loc))) {
    if (tone === "room" || tone === "ventIdle") continue;
    const [x, y] = k.split(",").map(Number);
    things.push({ depth: -1.9, node: <polygon key={`air${k}`} className={`w-air-${tone}`} pointerEvents="none" points={pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1))} /> });
  }
  const own = hallAt(game, loc.id), bad = new Set(unmaintained(game, loc.id));
  for (const r of game.racks) if (r.locationId === loc.id && r.tile && bad.has(`rack:${r.id}`)) things.push({ depth: r.tile.x + r.tile.y + 0.6, node: <Unmaintained key={`um${r.id}`} tile={r.tile} z={rackHeight(42) + 14} /> });
  if (own) {
    const areas = siteAreas(game, loc), halle = isHalle(own.p.buildingId);
    for (const i of own.hall.items) {
      if (!bad.has(`item:${i.id}`)) continue;
      const tl = itemTiles(i, areas, halle);
      if (tl.length) { const c = corner(tl); things.push({ depth: c.x + c.y + 1.5, node: <Unmaintained key={`um${i.id}`} tile={c} z={70} /> }); }
    }
  }
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
