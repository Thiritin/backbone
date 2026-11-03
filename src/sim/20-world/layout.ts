import type { Location, Rack, SpaceKind } from "../50-state";
import { datacenterById } from "./datacenters";

export type Facing = "n" | "e" | "s" | "w";
export interface Tile { x: number; y: number; facing: Facing }
export interface RoomSize { w: number; h: number }
// A fixed object on tile (x, y), w tiles wide; kind defaults to its id, so a room can hold two of a kind.
export interface Fixture { x: number; y: number; w?: number; kind?: string }
type Rented = Exclude<SpaceKind, "basement">;
// A rented room's hall: rack rows at y from x0 to x1, each with the way it faces in a hall with aisles; without aisles every row faces the near side. Without `mine` every rack tile is the player's (a suite); with it, the player's tiles are cut from the given rows and the rest hold neighbours' racks. The player's rows are the nearest, so no neighbour hides them.
interface Hall { size: RoomSize; fixtures: Record<string, Fixture>; rows: [number, Facing][]; x0: number; x1: number; mine?: (positions: number) => { x0: number; cols: number; rows: number[] } }
// The player's cage: the tiles inside the fence, and the column of the fence door on its near side.
export interface Cage { x0: number; y0: number; x1: number; y1: number; door: number }

const BASEMENT = {
  size: { w: 9, h: 7 },
  // The laundry corner and the desk take the far wall, under its two cellar windows; chair, mat, drain and lamp stand on the open floor.
  fixtures: {
    boiler: { x: 0, y: 0 }, washer: { x: 1, y: 0 }, window: { x: 1, y: 0 }, dryer: { x: 2, y: 0 },
    scanner: { x: 3, y: 0 }, hygrometer: { x: 3, y: 0 }, desk: { x: 4, y: 0 }, pc: { x: 4, y: 0 }, fan: { x: 4, y: 0 },
    fusebox: { x: 0, y: 1 }, jack: { x: 0, y: 1 }, shelf: { x: 0, y: 2 }, door: { x: 0, y: 4 }, letterbox: { x: 0, y: 5 },
    chair: { x: 4, y: 1 }, mat: { x: 1, y: 4 }, drain: { x: 3, y: 5 }, lamp: { x: 4, y: 4 },
    duct: { x: 0, y: 0 }, switch: { x: 0, y: 4 },
  } as Record<string, Fixture>,
  // The shelf's tile, and the tiles left for racks bought later.
  shelf: { x: 5, y: 0, facing: "s" } as Tile,
  racks: [{ x: 6, y: 0, facing: "s" }, { x: 7, y: 0, facing: "s" }] as Tile[],
};

// Fixed objects stand against or hang on a wall, row y = 0 along the far wall and column x = 0 along the left one, or at a row's end. The door is always on the left wall and opens onto a walkway; the suite's NOC desk stands in front of the rack rows so none hides it.
const HALLS: Record<Rented, Hall> = {
  share: {
    size: { w: 12, h: 8 },
    fixtures: {
      shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 7 },
      cooling: { x: 3, y: 0, w: 2 }, cooling2: { x: 7, y: 0, w: 2, kind: "cooling" }, pdu: { x: 11, y: 6 }, cart: { x: 11, y: 4 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"]], x0: 2, x1: 10,
    mine: (n) => ({ x0: 6, cols: n, rows: [6] }),
  },
  cage: {
    size: { w: 14, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 5 },
      cooling: { x: 4, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" }, pdu: { x: 13, y: 6 }, cart: { x: 13, y: 10 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"], [8, "n"]], x0: 2, x1: 12,
    // Four positions fill one row, eight two rows of four, sixteen two rows of eight.
    mine: (n) => ({ x0: 3, cols: n > 8 ? 8 : 4, rows: n > 4 ? [6, 8] : [6] }),
  },
  // Placeholder until the office room is drawn: a door and rows for four server-room sections.
  office: {
    size: { w: 12, h: 8 },
    fixtures: { door: { x: 0, y: 5 } },
    rows: [[2, "s"], [4, "n"]], x0: 2, x1: 9,
  },
  suite: {
    size: { w: 16, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, door: { x: 0, y: 7 }, extinguisher: { x: 0, y: 9 },
      cooling: { x: 6, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" }, dock: { x: 12, y: 0, w: 2 },
      pdu: { x: 15, y: 3 }, noc: { x: 6, y: 10, w: 2 }, cart: { x: 14, y: 10 },
    },
    rows: [[2, "s"], [4, "n"], [6, "s"], [8, "n"]], x0: 3, x1: 12,
  },
};

export const FIXTURES: Record<SpaceKind, Record<string, Fixture>> = {
  basement: BASEMENT.fixtures, share: HALLS.share.fixtures, cage: HALLS.cage.fixtures, suite: HALLS.suite.fixtures, office: HALLS.office.fixtures,
};

export const fixtures = (loc: Location) => FIXTURES[loc.space];

export function roomSize(loc: Location): RoomSize {
  return loc.space === "basement" ? BASEMENT.size : HALLS[loc.space].size;
}

// Every tile a fixture covers.
export function fixtureTiles(loc: Location): { x: number; y: number }[] {
  return Object.values(fixtures(loc)).flatMap((f) => Array.from({ length: f.w ?? 1 }, (_, i) => ({ x: f.x + i, y: f.y })));
}

// The tile inside the door, where the player stands on arriving.
export function entryTile(loc: Location): { x: number; y: number } {
  const d = fixtures(loc).door;
  return { x: d.x + 1, y: d.y };
}

export const hasAisles = (loc: Location) => !!loc.dc && datacenterById(loc.dc).aisles;

// The fence around a cage, one tile clear of its racks.
export function cage(loc: Location): Cage | null {
  if (loc.space !== "cage") return null;
  const hall = HALLS.cage, m = hall.mine!(loc.positions);
  return { x0: m.x0 - 1, y0: m.rows[0] - 1, x1: m.x0 + m.cols, y1: m.rows[m.rows.length - 1] + 1, door: m.x0 };
}

// Every rack tile of a hall and whether it is the player's. Nothing stands inside a cage's fence but the player's racks.
function hallTiles(loc: Location): (Tile & { mine: boolean })[] {
  if (loc.space === "basement") return [];
  const hall = HALLS[loc.space], aisles = hasAisles(loc), m = hall.mine?.(loc.positions), c = cage(loc);
  return hall.rows.flatMap(([y, f]) => Array.from({ length: hall.x1 - hall.x0 + 1 }, (_, k) => {
    const x = hall.x0 + k, facing: Facing = aisles ? f : "s";
    return { x, y, facing, mine: !m || (m.rows.includes(y) && x >= m.x0 && x < m.x0 + m.cols) };
  })).filter((t) => t.mine || !c || t.x < c.x0 || t.x > c.x1 || t.y < c.y0 || t.y > c.y1);
}

// Other tenants' racks on the hall floor, drawn from the layout and never part of the game state.
export function neighbourRacks(loc: Location): Tile[] {
  return hallTiles(loc).filter((t) => !t.mine).map(({ x, y, facing }) => ({ x, y, facing }));
}

// Rows of floor in front of the rack fronts.
export function walkways(loc: Location): { y: number; x0: number; x1: number }[] {
  if (loc.space === "basement") return [];
  const hall = HALLS[loc.space], out = new Map<number, { y: number; x0: number; x1: number }>();
  for (const t of hallTiles(loc)) {
    const y = t.y + (t.facing === "s" ? 1 : -1);
    out.set(y, { y, x0: hall.x0, x1: hall.x1 });
  }
  return [...out.values()];
}

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

// Tiles that take a rack: the basement's listed tiles beside the shelf, or in a rented room the player's part of the rack rows.
export function wallTiles(loc: Location): Tile[] {
  if (loc.space === "basement") return BASEMENT.racks;
  return hallTiles(loc).filter((t) => t.mine).map(({ x, y, facing }) => ({ x, y, facing }));
}

export function rackTiles(loc: Location, racks: Rack[]): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {}, shelf = loc.space === "basement" ? BASEMENT.shelf : undefined;
  for (const r of here) if (r.model === "shelf" && shelf) out[r.id] = shelf;
  const spots = wallTiles(loc), taken = new Set<string>(), valid = new Map(spots.map((t) => [key(t), t]));
  // A stored tile that is no longer a rack tile, as in saves from older layouts, gets a new one; facing follows the current layout.
  for (const r of here) {
    if (out[r.id]) continue;
    const t = r.tile && valid.get(key(r.tile));
    if (t && !taken.has(key(t))) { out[r.id] = t; taken.add(key(t)); }
  }
  const free = spots.filter((t) => !taken.has(key(t)));
  for (const r of here) if (!out[r.id] && free.length) out[r.id] = free.shift()!;
  return out;
}

export function freeRackTiles(loc: Location, racks: Rack[]): Tile[] {
  const taken = new Set(Object.values(rackTiles(loc, racks)).map(key));
  return wallTiles(loc).filter((t) => !taken.has(key(t)));
}
