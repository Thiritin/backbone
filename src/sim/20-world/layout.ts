import type { Location, Rack } from "../50-state";

export type Facing = "n" | "e" | "s" | "w";
export interface Tile { x: number; y: number; facing: Facing }
export interface RoomSize { w: number; h: number }

// Basement fixed objects, all against a wall: row y = 0 along the far wall, column x = 0 along the left one.
export const FIXTURES: Record<string, { x: number; y: number }> = {
  scanner: { x: 4, y: 0 },
  desk: { x: 5, y: 0 },
  pc: { x: 6, y: 0 },
  fan: { x: 8, y: 0 },
  fusebox: { x: 0, y: 2 },
  shelf: { x: 0, y: 4 },
  door: { x: 0, y: 6 },
  letterbox: { x: 0, y: 7 },
};

export function roomSize(loc: Location): RoomSize {
  return loc.space === "basement" ? { w: 12, h: 9 } : { w: 16, h: 12 };
}

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

// The far wall's row first, then the left and the right column; corners are left out since their facing is ambiguous. The near side has no wall.
export function wallTiles(loc: Location): Tile[] {
  const { w, h } = roomSize(loc);
  const tiles: Tile[] = [];
  for (let x = 1; x < w - 1; x++) tiles.push({ x, y: 0, facing: "s" });
  for (let y = 1; y < h - 1; y++) tiles.push({ x: 0, y, facing: "e" });
  for (let y = 1; y < h - 1; y++) tiles.push({ x: w - 1, y, facing: "w" });
  if (loc.space !== "basement") return tiles;
  const fixed = new Set(Object.values(FIXTURES).map(key));
  return tiles.filter((t) => !fixed.has(key(t)));
}

export function rackTiles(loc: Location, racks: Rack[]): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {};
  const taken = new Set<string>(), walls = new Set(wallTiles(loc).map(key));
  // A stored tile that is no longer against a wall, as in saves from older layouts, gets a new one.
  for (const r of here) if (r.tile && walls.has(key(r.tile)) && !taken.has(key(r.tile))) { out[r.id] = r.tile; taken.add(key(r.tile)); }
  const free = wallTiles(loc).filter((t) => !taken.has(key(t)));
  for (const r of here) if (!out[r.id] && free.length) out[r.id] = free.shift()!;
  return out;
}

export function freeRackTiles(loc: Location, racks: Rack[]): Tile[] {
  const taken = new Set(Object.values(rackTiles(loc, racks)).map(key));
  return wallTiles(loc).filter((t) => !taken.has(key(t)));
}
