import type { Location, Rack } from "../50-state";

export type Facing = "n" | "e" | "s" | "w";
export interface Tile { x: number; y: number; facing: Facing }
export interface RoomSize { w: number; h: number }

// Basement fixed objects. The door and letterbox sit on the bottom wall, the desk corner on the left, the shelf on the right.
export const FIXTURES: Record<string, { x: number; y: number }> = {
  door: { x: 6, y: 8 },
  letterbox: { x: 7, y: 8 },
  scanner: { x: 0, y: 3 },
  desk: { x: 0, y: 4 },
  pc: { x: 0, y: 5 },
  shelf: { x: 11, y: 4 },
  fusebox: { x: 11, y: 1 },
  fan: { x: 1, y: 0 },
};

export function roomSize(loc: Location): RoomSize {
  return loc.space === "basement" ? { w: 12, h: 9 } : { w: 16, h: 12 };
}

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

// Clockwise from the top-left, corners left out since their facing is ambiguous.
export function wallTiles(loc: Location): Tile[] {
  const { w, h } = roomSize(loc);
  const tiles: Tile[] = [];
  for (let x = 1; x < w - 1; x++) tiles.push({ x, y: 0, facing: "s" });
  for (let y = 1; y < h - 1; y++) tiles.push({ x: w - 1, y, facing: "w" });
  for (let x = w - 2; x > 0; x--) tiles.push({ x, y: h - 1, facing: "n" });
  for (let y = h - 2; y > 0; y--) tiles.push({ x: 0, y, facing: "e" });
  if (loc.space !== "basement") return tiles;
  const fixed = new Set(Object.values(FIXTURES).map(key));
  return tiles.filter((t) => !fixed.has(key(t)));
}

export function rackTiles(loc: Location, racks: Rack[]): Record<string, Tile> {
  const here = racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const out: Record<string, Tile> = {};
  const taken = new Set<string>();
  for (const r of here) if (r.tile && !taken.has(key(r.tile))) { out[r.id] = r.tile; taken.add(key(r.tile)); }
  const free = wallTiles(loc).filter((t) => !taken.has(key(t)));
  for (const r of here) if (!out[r.id] && free.length) out[r.id] = free.shift()!;
  return out;
}

export function freeRackTiles(loc: Location, racks: Rack[]): Tile[] {
  const taken = new Set(Object.values(rackTiles(loc, racks)).map(key));
  return wallTiles(loc).filter((t) => !taken.has(key(t)));
}
