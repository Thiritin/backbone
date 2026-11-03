import type { Location, Rack, SpaceKind } from "../50-state";

export type Facing = "n" | "e" | "s" | "w";
export interface Tile { x: number; y: number; facing: Facing }
export interface RoomSize { w: number; h: number }
// A fixed object on tile (x, y), w tiles wide; kind defaults to its id, so a room can hold two of a kind.
export interface Fixture { x: number; y: number; w?: number; kind?: string }
// A row of rack tiles from x0 to x1, fronts facing the cold aisle.
interface Row { y: number; x0: number; x1: number; facing: Facing }
// A room without rows lists its rack tiles, and a basement the shelf's tile.
interface Room { size: RoomSize; fixtures: Record<string, Fixture>; rows: Row[]; racks?: Tile[]; shelf?: Tile }

// Fixed objects stand against or hang on a wall, row y = 0 along the far wall and column x = 0 along the left one, except the basement's floor clutter. The door is always on the left wall; the suite's NOC desk stands in front of the rack rows so none hides it.
const ROOMS: Record<SpaceKind, Room> = {
  basement: {
    size: { w: 9, h: 7 },
    // The laundry corner and the desk take the far wall, under its two cellar windows; chair, mat, drain and lamp stand on the open floor.
    fixtures: {
      boiler: { x: 0, y: 0 }, washer: { x: 1, y: 0 }, window: { x: 1, y: 0 }, dryer: { x: 2, y: 0 },
      scanner: { x: 3, y: 0 }, hygrometer: { x: 3, y: 0 }, desk: { x: 4, y: 0 }, pc: { x: 4, y: 0 }, fan: { x: 4, y: 0 },
      fusebox: { x: 0, y: 1 }, jack: { x: 0, y: 1 }, shelf: { x: 0, y: 2 }, door: { x: 0, y: 4 }, letterbox: { x: 0, y: 5 },
      chair: { x: 4, y: 1 }, mat: { x: 1, y: 4 }, drain: { x: 3, y: 5 }, lamp: { x: 4, y: 4 },
    },
    rows: [],
    shelf: { x: 5, y: 0, facing: "s" },
    racks: [{ x: 6, y: 0, facing: "s" }, { x: 7, y: 0, facing: "s" }],
  },
  share: {
    size: { w: 8, h: 6 },
    fixtures: { shelf: { x: 0, y: 1 }, extinguisher: { x: 0, y: 3 }, door: { x: 0, y: 4 }, xconnect: { x: 2, y: 0, w: 2 }, cooling: { x: 5, y: 0, w: 2 } },
    rows: [{ y: 2, x0: 2, x1: 5, facing: "s" }],
  },
  cage: {
    size: { w: 12, h: 8 },
    fixtures: {
      shelf: { x: 0, y: 1 }, pdu: { x: 11, y: 3 }, extinguisher: { x: 0, y: 4 }, door: { x: 0, y: 5 },
      xconnect: { x: 2, y: 0, w: 2 }, cooling: { x: 7, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" },
    },
    rows: [{ y: 2, x0: 2, x1: 9, facing: "s" }, { y: 4, x0: 2, x1: 9, facing: "n" }],
  },
  suite: {
    size: { w: 16, h: 11 },
    fixtures: {
      shelf: { x: 0, y: 1 }, pdu: { x: 15, y: 3 }, extinguisher: { x: 0, y: 7 }, door: { x: 0, y: 8 },
      xconnect: { x: 2, y: 0, w: 2 }, noc: { x: 6, y: 10, w: 2 }, cooling: { x: 7, y: 0, w: 2 }, cooling2: { x: 9, y: 0, w: 2, kind: "cooling" },
      dock: { x: 12, y: 0, w: 2 },
    },
    rows: [
      { y: 2, x0: 3, x1: 12, facing: "s" }, { y: 4, x0: 3, x1: 12, facing: "n" },
      { y: 6, x0: 3, x1: 12, facing: "s" }, { y: 8, x0: 3, x1: 12, facing: "n" },
    ],
  },
};

export const FIXTURES: Record<SpaceKind, Record<string, Fixture>> = Object.fromEntries(
  Object.entries(ROOMS).map(([k, r]) => [k, r.fixtures]),
) as Record<SpaceKind, Record<string, Fixture>>;

export const fixtures = (loc: Location) => FIXTURES[loc.space];

export function roomSize(loc: Location): RoomSize {
  return ROOMS[loc.space].size;
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

// Rows of floor in front of the rack fronts.
export function coldAisles(loc: Location): { y: number; x0: number; x1: number }[] {
  const out = new Map<number, { y: number; x0: number; x1: number }>();
  for (const r of ROOMS[loc.space].rows) {
    const y = r.y + (r.facing === "s" ? 1 : -1);
    out.set(y, { y, x0: r.x0, x1: r.x1 });
  }
  return [...out.values()];
}

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

// Tiles that take a rack: the rack rows, or the room's listed tiles. The basement's shelf has its own tile.
export function wallTiles(loc: Location): Tile[] {
  const room = ROOMS[loc.space];
  return room.racks ?? room.rows.flatMap((r) => Array.from({ length: r.x1 - r.x0 + 1 }, (_, i) => ({ x: r.x0 + i, y: r.y, facing: r.facing })));
}

export function rackTiles(loc: Location, racks: Rack[]): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {}, shelf = ROOMS[loc.space].shelf;
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
