import type { Facing } from "../../sim/20-world/layout";

// Two-to-one pixel diamonds at the hotel-chat native size; tile corners land on whole pixels.
export const TW = 64, TH = 32;

export interface Pt { x: number; y: number }

// Screen point of the grid corner (x, y); a tile's top corner is its own grid corner.
export const iso = (x: number, y: number): Pt => ({ x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) });
// Screen centre of tile (x, y), fractional while walking.
export const center = (x: number, y: number): Pt => iso(x + 0.5, y + 0.5);

export const key = (x: number, y: number) => `${x},${y}`;

const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Breadth-first distances from start over free tiles; the start counts as free.
export function distances(start: Pt, w: number, h: number, blocked: Set<string>): Map<string, Pt[]> {
  const paths = new Map<string, Pt[]>([[key(start.x, start.y), []]]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift()!, path = paths.get(key(p.x, p.y))!;
    for (const [dx, dy] of STEPS) {
      const n = { x: p.x + dx, y: p.y + dy }, k = key(n.x, n.y);
      if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h || blocked.has(k) || paths.has(k)) continue;
      paths.set(k, [...path, n]);
      queue.push(n);
    }
  }
  return paths;
}

// The path to the closest of the targets, or null when none is reachable.
export function pathTo(start: Pt, targets: Pt[], w: number, h: number, blocked: Set<string>): Pt[] | null {
  const paths = distances(start, w, h, blocked);
  let best: Pt[] | null = null;
  for (const t of targets) {
    const p = paths.get(key(t.x, t.y));
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

// The tiles an object is used from: its own tile when it can be stood on, else the free tiles beside it.
export const useTiles = (t: Pt, blocked: Set<string>): Pt[] =>
  blocked.has(key(t.x, t.y)) ? STEPS.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy })) : [t];

export const facingOf = (dx: number, dy: number): Facing => (dx > 0 ? "e" : dx < 0 ? "w" : dy > 0 ? "s" : "n");
