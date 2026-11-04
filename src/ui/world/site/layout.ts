import { hallCapacity } from "../../../sim/20-world/properties";
import type { GameState, Location } from "../../../sim/50-state";
import { iso } from "../grid";
import { WALL } from "../draw";
import { CAR_TONES, PLAYER_CAR } from "./palette";

export type SiteClass = "S" | "M" | "L";
export type ItemType = "tree" | "bin" | "hedge" | "car" | "bays" | "house" | "box" | "yard" | "lobby" | "street" | "path" | "walk" | "sign" | "fence" | "booth" | "gate" | "light" | "pole";
// One placed module. The footprint is in tiles on the site's ground plane; top is its height in px above that plane.
export interface Item {
  t: ItemType; x0: number; y0: number; x1: number; y1: number; top: number; layer: "back" | "front";
  seed?: number; tone?: string; coil?: boolean; dir?: "x" | "y"; kind?: string; count?: number; moving?: boolean;
}
export interface Seat { x: number; y: number; facing: "n" | "e" | "s" | "w" }
export interface SiteSpec {
  kind: "garden" | "plot" | "none"; cls: SiteClass; seed: number; w: number; h: number;
  // Height of the ground plane behind the walls, 0 except in the basement where the garden lies at the wall top.
  lift: number; plot: { x0: number; y0: number; x1: number; y1: number };
  items: Item[]; bay: { x: number; y: number; dir: "x" | "y" } | null; seats: Seat[];
  box: { x: number; y: number; w: number; h: number };
}

// 32-bit FNV-1a; the whole look of a location comes from this and the class.
export const fnv1a = (s: string): number => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
// The variant of a slot, from the seed.
export const pick = (seed: number, slot: number, n: number): number => fnv1a(`${seed}:${slot}`) % n;

export function siteClass(loc: Location, game: GameState): SiteClass {
  if (loc.space === "hall") {
    const p = game.properties.find((x) => x.locationId === loc.id), n = p ? hallCapacity(p) : 0;
    return n <= 20 ? "S" : n <= 48 ? "M" : "L";
  }
  return loc.space === "basement" ? "S" : loc.space === "office" || loc.space === "cage" || loc.space === "suite" ? "M" : "S";
}

// Whether a point on the site at height z can be seen past the room's far walls (a wall is 96 px tall and covers the ground behind it).
export function visibleBehind(x: number, y: number, z: number, w: number, h: number): boolean {
  if (y < 0 && x - y >= 0 && x - y <= w && 32 * y >= z - WALL) return false;
  if (x < 0 && y - x >= 0 && y - x <= h && 32 * x >= z - WALL) return false;
  return true;
}

// Metres from the scale table: one tile is 1 m and one metre of height is 32 px.
export const M = 32;
export const STREET = 7, KERB = 0.15, WALK = 1.8, BAY = { w: 2.5, l: 5 };
// Real footprints of the baked cars (L x W in m), by model.
export const CAR_SIZE: Record<string, [number, number]> = { sedan: [4.5, 1.8], hatchback: [4.0, 1.75], van: [4.9, 1.95] };

const it = (t: ItemType, x0: number, y0: number, x1: number, y1: number, top: number, layer: Item["layer"], o: Partial<Item> = {}): Item => ({ t, x0, y0, x1, y1, top, layer, ...o });
// A car with its near-left corner at (x, y), long side along x.
const carItem = (kind: string, x: number, y: number, tone: string, layer: Item["layer"], o: Partial<Item> = {}) => {
  const [l, w] = CAR_SIZE[kind];
  return it("car", x, y, x + l, y + w, Math.round(1.45 * M), layer, { tone, dir: "x", kind, ...o });
};
// A tree standing at a tile; the footprint is its crown width.
const treeItem = (kind: "oak" | "pine", x: number, y: number, seed: number, layer: Item["layer"]) => {
  const r = kind === "oak" ? 2.3 : 1.8;
  return it("tree", x - r, y - r, x + r, y + r, Math.round((kind === "oak" ? 7.5 : 10) * M), layer, { kind, seed });
};
// A trimmed hedge along x in runs of at most 4 m so each run sorts on its own.
const hedgeRuns = (x0: number, x1: number, y: number, seed: number, layer: Item["layer"], top = 1.6) => {
  const out: Item[] = [];
  for (let a = x0; a < x1; a += 4) out.push(it("hedge", a, y, Math.min(a + 4, x1), y + 0.8, Math.round(top * M), layer, { seed: seed + a }));
  return out;
};
// A security fence line in segments of 5 m; the coil runs along the top of the double fence only.
const fenceLine = (axis: "x" | "y", fixed: number, a0: number, a1: number, layer: Item["layer"], coil = true, top = 3.2) => {
  const out: Item[] = [];
  for (let a = a0; a < a1; a += 5) {
    const b = Math.min(a + 5, a1);
    out.push(axis === "x" ? it("fence", a, fixed, b, fixed + 0.1, Math.round(top * M), layer, { dir: "x", coil }) : it("fence", fixed, a, fixed + 0.1, b, Math.round(top * M), layer, { dir: "y", coil }));
  }
  return out;
};
// A row of lots along a street, each with a building facing the street, its own driveway across the sidewalk and a low hedge on either side of it.
// Lots run from xStart in direction dir; frontY is every building's front line and roadY the street edge the driveways reach.
export const HOUSE = { w: 9, d: 7 }, SHED = { w: 22, d: 10 }, DRIVE = 3;
const lotRow = (seed: number, tag: number, xStart: number, dir: 1 | -1, count: number, frontY: number, roadY: number, layer: Item["layer"], first?: "house" | "box", sheds = true): Item[] => {
  const out: Item[] = [];
  let cursor = xStart;
  for (let k = 0; k < count; k++) {
    const kind = k === 0 && first ? first : sheds && pick(seed, tag + k, 4) === 3 ? "box" : "house", dim = kind === "box" ? SHED : HOUSE, width = dim.w + 4;
    const x0 = dir > 0 ? cursor : cursor - width, bx1 = x0 + dim.w, dx0 = bx1 - DRIVE - 0.5;
    out.push(kind === "box" ? it("box", x0, frontY - dim.d, bx1, frontY, 7 * M, layer, { tone: ["w-tone-plaster-a", "w-tone-plaster-b", "w-tone-plaster-c"][pick(seed, tag + k + 40, 3)] }) : it("house", x0, frontY - dim.d, bx1, frontY, Math.round(7 * M), layer, { tone: ["w-tone-plaster-a", "w-tone-plaster-b", "w-tone-plaster-c"][pick(seed, tag + k + 40, 3)] }));
    out.push(it("path", dx0, frontY, dx0 + DRIVE, roadY, 0, layer, { kind: "drive" }));
    if (pick(seed, tag + k + 80, 4) > 0) out.push(it("car", dx0 + 0.6, frontY + 0.4, dx0 + 0.6 + CAR_SIZE.sedan[1], frontY + 0.4 + CAR_SIZE.sedan[0], Math.round(1.45 * M), layer, { tone: CAR_TONES[pick(seed, tag + k + 120, CAR_TONES.length)], dir: "y", kind: "sedan" }));
    out.push(...hedgeRuns(x0, dx0 - 0.5, frontY + 1.2, seed + k, layer, 0.9), ...hedgeRuns(dx0 + DRIVE + 0.5, x0 + width, frontY + 1.2, seed + k, layer, 0.9));
    cursor += dir * (width + 2);
  }
  return out;
};
// A seeded tree belt south of the street: uneven spacing and species, trunks well off the kerb so no canopy hangs over the road.
const beltTrees = (seed: number, edge: number, layer: Item["layer"]): Item[] => {
  const out: Item[] = [];
  for (let k = 0, x = -50; x < 50; k++) {
    const kind = pick(seed, 500 + k, 5) < 2 ? "oak" : "pine", r = kind === "oak" ? 2.3 : 1.8;
    out.push(treeItem(kind, x, edge + 2.5 + r + pick(seed, 540 + k, 8) / 4, seed ^ (60 + k), layer));
    x += 6.5 + pick(seed, 580 + k, 9) / 2;
  }
  return out;
};
const bounds = (all: Item[], lift: number, w: number, h: number) => {
  const items = all.filter((i) => i.t !== "street" && i.t !== "walk");
  const x0 = Math.min(0, ...items.map((i) => i.x0)), y0 = Math.min(0, ...items.map((i) => i.y0));
  const x1 = Math.max(w, ...items.map((i) => i.x1)), y1 = Math.max(h, ...items.map((i) => i.y1));
  const top = Math.max(WALL, ...items.map((i) => (i.y1 <= 0 || i.x1 <= 0 ? lift : 0) + i.top));
  const l = iso(x0, y1).x, r = iso(x1, y0).x, t = iso(x0, y0).y - top - 8, b = iso(x1, y1).y + 8;
  return { x: l - 8, y: t, w: r - l + 16, h: b - t };
};

// The site around a location. Only the basement and an own hall have one so far; every other space is a bare ground plane.
export function siteOf(game: GameState, loc: Location, w: number, h: number): SiteSpec {
  const cls = siteClass(loc, game), seed = fnv1a(`${loc.id}:${cls}`);
  const none = (): SiteSpec => ({ kind: "none", cls, seed, w, h, lift: 0, plot: { x0: 0, y0: 0, x1: w, y1: h }, items: [], bay: null, seats: [], box: bounds([], 0, w, h) });
  const tone = (slot: number) => CAR_TONES[pick(seed, slot, CAR_TONES.length)];
  if (loc.space === "basement") {
    // The garden lies at the wall top; the street runs behind it at y = -17..-10 with sidewalks, a hedge and two houses across it.
    const sy0 = -17, sy1 = sy0 + STREET, nearWalk = sy1 + KERB, hedgeY = -6.9;
    const items: Item[] = [
      it("street", -300, sy0, w + 300, sy1, 0, "back"),
      it("walk", -300, nearWalk, w + 300, nearWalk + WALK, 0, "back"), it("walk", -300, sy0 - KERB - WALK, w + 300, sy0 - KERB, 0, "back"),
      it("path", 3.6, hedgeY - 0.1, 4.8, -0.6, 0, "back"),
      ...hedgeRuns(-12, 3.6, hedgeY, seed, "back"), ...hedgeRuns(4.8, w + 6, hedgeY, seed, "back"),
      ...lotRow(seed, 200, -28, 1, 6, -24.5, sy0, "back", "house", false),
      treeItem("oak", -4, -2.7, seed ^ 1, "back"), treeItem("pine", w + 9, -5.2, seed ^ 3, "back"),
      carItem("sedan", -8, nearWalk - 1.85, tone(3), "back"),
      it("bin", w + 1, -3, w + 1.7, -2.3, 30, "back"), it("bin", w + 1, -4.2, w + 1.7, -3.5, 30, "back"),
      carItem("hatchback", 0.5, nearWalk - 1.85, PLAYER_CAR, "back", { kind: "hatchback", moving: false }),
      carItem("sedan", -16, sy0 + 1.4, tone(4), "back", { moving: true }),
    ];
    return { kind: "garden", cls, seed, w, h, lift: WALL, plot: { x0: -16, y0: -34, x1: w + 14, y1: 0 }, items, bay: { x: 0.5, y: nearWalk - 1.85, dir: "x" }, seats: [], box: bounds(items, WALL, w, h) };
  }
  if (loc.space !== "hall") return none();
  // The compound: an outer fence at the plot edge with an inner line 3 m inside on three sides, a gate in the front fence and the street behind a sidewalk.
  const px0 = -9, px1 = w + 13, py0 = -14, py1 = h + 9, gap = 4;
  const sy0 = py1 + 2.35, sy1 = sy0 + STREET;
  // Lobby A in front of the left side, parking on the right, the yard behind the right wall.
  const lobby = it("lobby", 0, h, 9, h + 6, WALL, "front"), bayY = (k: number) => h + 1 - BAY.w * (k + 1);
  const gateX0 = w + 3, gateX1 = w + 9;
  const items: Item[] = [
    it("street", -300, sy0, w + 300, sy1, 0, "front", { moving: true }),
    it("walk", -300, py1 + 0.4, w + 300, py1 + 0.4 + WALK, 0, "front"),
    it("yard", w - 11, -9.4, w - 1, -4.5, 56, "back", { count: 3 }),
    ...fenceLine("x", py0, px0, px1, "back"), ...fenceLine("x", py0 + gap, px0 + gap, px1 - gap, "back", false, 2.6),
    ...fenceLine("y", px0, py0, py1, "back"), ...fenceLine("y", px0 + gap, py0 + gap, py1 - 5, "front", false, 2.6),
    ...fenceLine("y", px1, py0, py1, "front"), ...fenceLine("y", px1 - gap, py0 + gap, py1 - 5, "front", false, 2.6),
    ...fenceLine("x", py1, px0, gateX0, "front", false, 2.6), ...fenceLine("x", py1, gateX1, px1, "front", false, 2.6),
    it("gate", gateX0, py1 - 0.3, gateX1, py1 + 0.3, Math.round(1 * M), "front"),
    it("booth", gateX1 + 0.6, py1 - 3.3, gateX1 + 3, py1 - 1.3, Math.round(2.8 * M), "front"),
    it("light", px1 - 6.1, py0 + 5.9, px1 - 5.9, py0 + 6.1, 8 * M, "back"), it("light", px0 + 5.9, 3, px0 + 6.1, 3.2, 8 * M, "back"),
    ...lotRow(seed, 300, px0 - 2, -1, 3, h + 4, sy0, "front", "box"), ...lotRow(seed, 400, px1 + 2, 1, 3, h + 4, sy0, "front", "house"),
    it("path", 3.4, h + 6, 4.8, h + 8.2, 0, "front"), it("path", 3.4, h + 7.2, gateX0 + 3, h + 8.2, 0, "front"), it("path", gateX0 + 1, h + 7.2, gateX0 + 3, py1 + 0.4, 0, "front"),
    it("bays", w + 1, bayY(3), w + 1 + BAY.l, bayY(-1), 0, "front", { count: 4 }),
    carItem("hatchback", w + 1.4, bayY(0) + 0.35, PLAYER_CAR, "front", { kind: "hatchback" }), carItem("sedan", w + 1.2, bayY(1) + 0.35, tone(5), "front"), carItem("van", w + 1.1, bayY(3) + 0.3, tone(6), "front", { kind: "van" }),
    lobby, it("sign", 5.2, h + 0.6, 7, h + 0.8, 56, "front"),
    treeItem("oak", w + 4, -20.5, seed ^ 2, "back"), treeItem("pine", w + 23, -18, seed ^ 1, "back"),
    ...[-7, -1, 5].map((x, k) => treeItem("pine", x, -20, seed ^ (10 + k), "back")),
    ...beltTrees(seed, sy1 + 0.15, "front"),
    carItem("sedan", -34, sy0 + 4.2, tone(7), "front", { moving: true }), carItem("van", w + 16, sy0 + 1.4, tone(8), "front", { kind: "van", moving: true }),
    it("bin", w + 7, h + 2.3, w + 7.7, h + 3, 30, "front"), it("bin", w + 7.9, h + 2.3, w + 8.6, h + 3, 30, "front"),
  ];
  const seats: Seat[] = [{ x: 4, y: h + 3, facing: "n" }, { x: 5, y: h + 3, facing: "n" }];
  return { kind: "plot", cls, seed, w, h, lift: 0, plot: { x0: px0, y0: py0, x1: px1, y1: py1 }, items, bay: { x: w + 1.4, y: bayY(0) + 0.35, dir: "x" }, seats, box: bounds(items, 0, w, h) };
}

// The tile and heading of the player's car.
export const reservedBay = (s: SiteSpec) => s.bay;
// The lobby's seat slots, the same shape as the office seats.
export const lobbySeats = (s: SiteSpec): Seat[] => s.seats;

const SOLID = new Set<ItemType>(["tree", "pole", "light", "hedge", "fence", "gate", "booth", "bin", "car", "house", "box", "lobby", "yard", "sign"]);
const GROUND = new Set<ItemType>(["street", "walk", "path", "bays"]);
// Pairs that share ground on purpose: a car in its bay or on the street, fence lines that meet at a corner.
const MAY_SHARE = (a: Item, b: Item) => (a.t === "fence" && b.t === "fence") || (a.t === "car" && (b.t === "bays" || b.t === "street")) || (a.t === "bin" && b.t === "walk") || (a.t === "car" && b.t === "path") || (a.t === "path" && b.t === "gate") || (a.t === "lobby" && b.t === "sign");
// Footprints that overlap once grown by a margin; trees, poles and floodlights keep a metre clear of everything.
export function overlaps(items: Item[]): [Item, Item][] {
  const out: [Item, Item][] = [];
  const tall = (i: Item) => i.t === "tree" || i.t === "pole" || i.t === "light";
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const p = items[a], q = items[b];
    if (!(SOLID.has(p.t) || GROUND.has(p.t)) || !(SOLID.has(q.t) || GROUND.has(q.t))) continue;
    if (GROUND.has(p.t) && GROUND.has(q.t)) continue;
    if (MAY_SHARE(p, q) || MAY_SHARE(q, p)) continue;
    const big = (i: Item) => i.t === "house" || i.t === "box" || i.t === "fence" || i.t === "lobby" || i.t === "yard", m = (p.t === "tree" && big(q)) || (q.t === "tree" && big(p)) ? 2.5 : tall(p) || tall(q) ? 1 : 0;
    if (p.x0 - m < q.x1 && q.x0 - m < p.x1 && p.y0 - m < q.y1 && q.y0 - m < p.y1) out.push([p, q]);
  }
  return out;
}
