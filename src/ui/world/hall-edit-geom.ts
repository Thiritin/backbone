// Pure geometry of the hall's edit mode: turning a group, laying a drag line, deriving runs and aisles, and the way on foot
// from the door to a service front. Nothing here reads the game state, so the tests call it directly.
import type { Area, Facing, Pt } from "../../sim/20-world/layout";

export type { Facing, Pt };
export const TURN: Record<Facing, Facing> = { n: "e", e: "s", s: "w", w: "n" };
export const key = (p: Pt) => `${p.x},${p.y}`;
const STEP: Record<Facing, Pt> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
export const stepOf = (p: Pt, f: Facing, k = 1): Pt => ({ x: p.x + STEP[f].x * k, y: p.y + STEP[f].y * k });

// An object by the scene tile rectangle it covers: (x, y) is the top corner, fw by fh the size after facing.
export interface Part extends Pt { fw: number; fh: number; facing: Facing; wall?: boolean }

export const tilesOf = (p: Part): Pt[] => Array.from({ length: p.fw * p.fh }, (_, i) => ({ x: p.x + (i % p.fw), y: p.y + Math.floor(i / p.fw) }));

// One quarter turn clockwise of every part around the tile `pivot`. Wall parts stay where they hang.
export function turnParts<T extends Part>(parts: T[], pivot: Pt): T[] {
  return parts.map((p) => (p.wall ? p : { ...p, x: pivot.x + pivot.y - p.y - p.fh + 1, y: pivot.y + p.x - pivot.x, fw: p.fh, fh: p.fw, facing: TURN[p.facing] }));
}

// Tiles of a straight line from one tile to another along the longer axis of the drag, one every `step` tiles. A part that is
// `fw` wide and `fh` deep steps by its own size along the axis, so a line of racks leaves no gaps and no overlaps.
export function dragLine(from: Pt, to: Pt, fw = 1, fh = 1): Pt[] {
  const dx = to.x - from.x, dy = to.y - from.y, alongX = Math.abs(dx) >= Math.abs(dy), step = alongX ? fw : fh;
  const n = Math.floor(Math.abs(alongX ? dx : dy) / step);
  const sign = Math.sign(alongX ? dx : dy) || 1;
  return Array.from({ length: n + 1 }, (_, i) => (alongX ? { x: from.x + sign * i * step, y: from.y } : { x: from.x, y: from.y + sign * i * step }));
}

// Racks side by side with the same facing form a run; a gap or another facing starts the next one.
export function runsOf(racks: (Pt & { facing: Facing })[]): { facing: Facing; tiles: Pt[] }[] {
  const out: { facing: Facing; tiles: Pt[] }[] = [];
  for (const f of ["n", "e", "s", "w"] as Facing[]) {
    const along = f === "n" || f === "s";
    const mine = racks.filter((r) => r.facing === f).sort((a, b) => (along ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
    let cur: Pt[] = [];
    for (const r of mine) {
      const last = cur[cur.length - 1];
      if (last && (along ? r.y === last.y && r.x === last.x + 1 : r.x === last.x && r.y === last.y + 1)) cur.push(r);
      else { if (cur.length) out.push({ facing: f, tiles: cur }); cur = [r]; }
    }
    if (cur.length) out.push({ facing: f, tiles: cur });
  }
  return out;
}

// The floor tiles a light rail hangs over: the fronts of racks that no body stands on and that lie outside every excluded tile.
export function aisleTiles(fronts: Pt[], bodies: Iterable<string>, excluded: Iterable<string> = []): Pt[] {
  const skip = new Set([...bodies, ...excluded]), seen = new Set<string>();
  return fronts.filter((p) => { const k = key(p); if (skip.has(k) || seen.has(k)) return false; seen.add(k); return true; });
}

// The tiles one step in front of a footprint, as wide as the footprint.
export function frontOf(tiles: Pt[], facing: Facing): Pt[] {
  if (!tiles.length) return [];
  const along = facing === "n" || facing === "s";
  const v = (p: Pt) => (along ? p.y : p.x), edge = facing === "s" || facing === "e" ? Math.max(...tiles.map(v)) : Math.min(...tiles.map(v));
  return tiles.filter((p) => v(p) === edge).map((p) => stepOf(p, facing));
}

// The tile indices from `from` up to `to` along a wall that are not doorways: one stub wall piece stands on each.
export const wallPieces = (from: number, to: number, gaps: number[]): number[] => Array.from({ length: to - from }, (_, i) => from + i).filter((i) => !gaps.includes(i));

// The way on foot from one tile to another over tiles not in `blocked`; areas join only through facing passages.
export function walkPath(areas: Area[], blocked: Set<string>, from: Pt, to: Pt): Pt[] | null {
  const areaAt = (p: Pt) => areas.find((a) => p.x >= a.rect.x && p.y >= a.rect.y && p.x < a.rect.x + a.rect.w && p.y < a.rect.y + a.rect.h);
  const link = (a: Pt, b: Pt, aa: Area, ba: Area) => aa.passages.some((p) => p.to === ba.id && key(p.tile) === key(a)) && ba.passages.some((p) => p.to === aa.id && key(p.tile) === key(b));
  const seen = new Map<string, string | null>([[key(from), null]]), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], pa = areaAt(p);
    if (!pa) continue;
    for (const f of ["n", "e", "s", "w"] as Facing[]) {
      const q = stepOf(p, f), qa = areaAt(q);
      if (!qa || seen.has(key(q)) || blocked.has(key(q)) || (qa !== pa && !link(p, q, pa, qa))) continue;
      seen.set(key(q), key(p));
      queue.push(q);
    }
  }
  if (!seen.has(key(to))) return null;
  const path: Pt[] = [];
  for (let k: string | null = key(to); k; k = seen.get(k) ?? null) { const [x, y] = k.split(",").map(Number); path.unshift({ x, y }); }
  return path;
}

// The row where the two-tile ticket board hangs on the left wall: beside the wall screen when free, else the first free pair of rows; null when the wall is full.
// `taken` holds the wall's fixtures and the screen as [row, rows] spans.
export function boardRow(height: number, taken: { y: number; len: number }[], screenY: number | null): number | null {
  const free = (r: number) => r >= 0 && r + 2 <= height && taken.every((q) => r >= q.y + q.len || r + 2 <= q.y);
  const near = screenY === null ? [] : [screenY + 2, screenY - 2];
  return [...near, ...Array.from({ length: Math.max(0, height - 1) }, (_, r) => r)].find(free) ?? null;
}
