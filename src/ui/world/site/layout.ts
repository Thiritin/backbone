import { lobbyClass } from "../../../sim/20-world/lobby";
import { hallCapacity } from "../../../sim/20-world/properties";
import type { GameState, Location } from "../../../sim/50-state";
import { iso } from "../grid";
import { WALL } from "../draw";
import { CAR_TONES, PLAYER_CAR } from "./palette";
import type { Facing } from "./heading";
import { buildSite } from "./compound";
import { settingOf, type Setting } from "./setting";

export type SiteClass = "S" | "M" | "L";
export type ItemType = "tree" | "bin" | "hedge" | "car" | "bays" | "house" | "box" | "yard" | "lobby" | "street" | "path" | "walk" | "sign" | "fence" | "booth" | "gate" | "light" | "pole" | "cam" | "lamp" | "office" | "tank" | "cont" | "pallet" | "subst" | "gen" | "dock" | "cooling" | "planter" | "rack" | "busstop" | "turbine" | "solar" | "field" | "rail" | "landmark";
// One placed module. The footprint is in tiles on the site's ground plane; top is its height in px above that plane.
export interface Item {
  t: ItemType; x0: number; y0: number; x1: number; y1: number; top: number; layer: "back" | "front";
  seed?: number; tone?: string; coil?: boolean; dir?: Facing; kind?: string; count?: number; moving?: boolean;
}
export interface Seat { x: number; y: number; facing: "n" | "e" | "s" | "w" }
export interface SiteSpec {
  kind: "garden" | "plot" | "none"; setting: Setting; cls: SiteClass; seed: number; w: number; h: number;
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
    const p = game.properties.find((x) => x.locationId === loc.id || x.hall?.locationId === loc.id), n = p ? hallCapacity(p) : 0;
    return lobbyClass(n);
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
export const CAR_SIZE: Record<string, [number, number]> = { sedan: [5, 2], hatchback: [4, 2], van: [5, 2], coupe: [4, 2] };
const LOT_CARS = ["hatchback", "coupe"];

export const it = (t: ItemType, x0: number, y0: number, x1: number, y1: number, top: number, layer: Item["layer"], o: Partial<Item> = {}): Item => ({ t, x0, y0, x1, y1, top, layer, ...o });
// A car with its near-left corner at (x, y), long side along x.
export const carItem = (kind: string, x: number, y: number, tone: string, layer: Item["layer"], o: Partial<Item> = {}) => {
  const [l, w] = CAR_SIZE[kind];
  return it("car", x, y, x + l, y + w, Math.round(1.45 * M), layer, { tone, dir: "x", kind, ...o });
};
// A tree standing at a tile; the footprint is its crown width.
export const treeItem = (kind: "oak" | "pine", x: number, y: number, seed: number, layer: Item["layer"]) => {
  const r = kind === "oak" ? 2.3 : 1.8;
  return it("tree", x - r, y - r, x + r, y + r, Math.round((kind === "oak" ? 7.5 : 10) * M), layer, { kind, seed });
};
// A trimmed hedge along x in runs of at most 4 m so each run sorts on its own.
export const hedgeRuns = (x0: number, x1: number, y: number, seed: number, layer: Item["layer"], top = 1.6) => {
  const out: Item[] = [];
  for (let a = x0; a < x1; a += 4) out.push(it("hedge", a, y, Math.min(a + 4, x1), y + 0.8, Math.round(top * M), layer, { seed: seed + a }));
  return out;
};
// A security fence line in segments of 5 m; the coil runs along the top of the double fence only.
export const fenceLine = (axis: "x" | "y", fixed: number, a0: number, a1: number, layer: Item["layer"], coil = true, top = 3.2) => {
  const out: Item[] = [];
  for (let a = a0; a < a1; a += 10) {
    const b = Math.min(a + 10, a1);
    out.push(axis === "x" ? it("fence", a, fixed, b, fixed + 0.1, Math.round(top * M), layer, { dir: "x", coil }) : it("fence", fixed, a, fixed + 0.1, b, Math.round(top * M), layer, { dir: "y", coil }));
  }
  return out;
};
export type LotMix = "mixed" | "houses" | "warehouses" | "offices" | "farm";
interface LotDef { t: "house" | "box" | "office"; id: string; w: number; d: number; top: number; hall?: boolean; plaster?: boolean }
const WH: LotDef = { t: "box", id: "warehouse", w: 22, d: 10, top: 7, plaster: true };
const LOTS: Record<LotMix, LotDef[]> = {
  houses: [{ t: "house", id: "house", w: 9, d: 7, top: 7, plaster: true }],
  mixed: [{ t: "house", id: "house", w: 9, d: 7, top: 7, plaster: true }, { t: "house", id: "house-c", w: 11, d: 8, top: 8.5, plaster: true }, { t: "house", id: "house-k", w: 7, d: 8, top: 8.5, plaster: true }, WH],
  farm: [{ t: "house", id: "house-c", w: 11, d: 8, top: 8.5, plaster: true }, { ...WH }, { t: "house", id: "house-k", w: 7, d: 8, top: 8.5, plaster: true }, { ...WH }, { t: "house", id: "house", w: 9, d: 7, top: 7, plaster: true }],
  warehouses: [WH, { ...WH }, { t: "box", id: "water-tower", w: 6, d: 6, top: 16 }],
  offices: [{ t: "office", id: "shop-a", w: 5, d: 6, top: 8, plaster: true }, { t: "office", id: "shop-c", w: 10, d: 12, top: 10, plaster: true }, { t: "office", id: "office-f", w: 6, d: 7, top: 12 }, { t: "office", id: "office-tower", w: 8, d: 8, top: 16 }, { t: "office", id: "shop-a", w: 5, d: 6, top: 8, plaster: true }, { t: "office", id: "shop-c", w: 10, d: 12, top: 10, plaster: true }],
};
const WARM = ["w-tone-hall-2", "w-tone-hall-4", "w-tone-hall-5"];
// A row of lots along a street. The buildings come from a seeded order of the mix, so a row never repeats a model and the row on the other side carries on from where this one stops (start).
// Each is set back a seeded 0 to 3 m with its own driveway across the sidewalk and a car on it. frontY is the front line before the setback and roadY the street edge the driveways reach.
// plant adds the chimney of a works to the mix.
export const DRIVE = 3;
export const lotRow = (seed: number, tag: number, xStart: number, dir: 1 | -1, count: number, frontY: number, roadY: number, layer: Item["layer"], mix: LotMix = "mixed", start = 0, plant = false): Item[] => {
  const out: Item[] = [], plain = mix === "houses", defs = plain ? LOTS.houses : plant ? [...LOTS[mix], { t: "box" as const, id: "chimney", w: 8, d: 8, top: 12 }] : LOTS[mix];
  const order = defs.map((_, i) => i).sort((a, b) => fnv1a(`${seed}:${b}`) % 977 - (fnv1a(`${seed}:${a}`) % 977));
  if (plant) order.splice(order.indexOf(defs.length - 1), 1), order.unshift(defs.length - 1);
  let cursor = xStart;
  for (let k = 0; k < count; k++) {
    const d = defs[order[(start + k) % defs.length]], width = d.w + 4, y1 = frontY - (plain ? 0 : [0, 1, 2][pick(seed, tag + k + 200, 3)]);
    const x0 = dir > 0 ? cursor : cursor - width, bx1 = x0 + d.w, dx0 = bx1 - DRIVE - 1;
    const tone = d.hall ? WARM[pick(seed, tag + k + 40, 3)] : d.plaster ? ["w-tone-plaster-a", "w-tone-plaster-b", "w-tone-plaster-c"][pick(seed, tag + k + 40, 3)] : undefined;
    out.push(it(d.t, x0, y1 - d.d, bx1, y1, Math.round(d.top * M), layer, { tone, kind: d.id }));
    out.push(it("path", dx0, y1, dx0 + DRIVE, roadY, 0, layer, { kind: "drive" }));
    if (pick(seed, tag + k + 80, 4) > 0) {
      const ck = LOT_CARS[pick(seed, tag + k + 240, LOT_CARS.length)], [cl, cw] = CAR_SIZE[ck];
      out.push(it("car", dx0 + Math.floor((DRIVE - cw) / 2), y1, dx0 + Math.floor((DRIVE - cw) / 2) + cw, y1 + cl, Math.round(1.45 * M), layer, { tone: CAR_TONES[pick(seed, tag + k + 120, CAR_TONES.length)], dir: "ny", kind: ck }));
    }
    if (mix === "houses" || d.t === "house") out.push(...hedgeRuns(x0, dx0 - 0.5, frontY + 1.2, seed + k, layer, 0.9), ...hedgeRuns(dx0 + DRIVE + 0.5, x0 + width, frontY + 1.2, seed + k, layer, 0.9));
    cursor += dir * (width + (plain ? 2 : 2 + pick(seed, tag + k + 220, 4)));
  }
  return out;
};
// A seeded tree belt south of the street: uneven spacing and species, trunks well off the kerb so no canopy hangs over the road.
export const beltTrees = (seed: number, edge: number, layer: Item["layer"]): Item[] => {
  const out: Item[] = [];
  for (let k = 0, x = -50; x < 50; k++) {
    const kind = pick(seed, 500 + k, 5) < 2 ? "oak" : "pine", r = kind === "oak" ? 2.3 : 1.8;
    out.push(treeItem(kind, x, edge + 2.5 + r + pick(seed, 540 + k, 8) / 2, seed ^ (60 + k), layer));
    x += 6.5 + pick(seed, 580 + k, 9) / 2;
  }
  return out;
};
export const bounds = (all: Item[], lift: number, w: number, h: number) => {
  const items = all.filter((i) => i.t !== "street" && i.t !== "walk" && i.t !== "field" && i.t !== "rail" && i.t !== "turbine" && i.t !== "landmark");
  const x0 = Math.min(0, ...items.map((i) => i.x0)), y0 = Math.min(0, ...items.map((i) => i.y0));
  const x1 = Math.max(w, ...items.map((i) => i.x1)), y1 = Math.max(h, ...items.map((i) => i.y1));
  const top = Math.max(WALL, ...items.map((i) => (i.y1 <= 0 || i.x1 <= 0 ? lift : 0) + i.top));
  const l = iso(x0, y1).x, r = iso(x1, y0).x, t = iso(x0, y0).y - top - 8, b = iso(x1, y1).y + 8;
  return { x: l - 8, y: t, w: r - l + 16, h: b - t };
};

// The site around a location. Only the basement and an own hall have one so far; every other space is a bare ground plane.
export function siteOf(game: GameState, loc: Location, w: number, h: number): SiteSpec {
  const home = game.properties.find((p) => p.locationId === loc.id || p.hall?.locationId === loc.id), staff = home ? game.staff.filter((e) => e.desk?.propertyId === home.id).length : 0;
  const cls = siteClass(loc, game), seed = fnv1a(`${loc.id}:${cls}`);
  const none = (): SiteSpec => ({ kind: "none", setting: "suburb", cls, seed, w, h, lift: 0, plot: { x0: 0, y0: 0, x1: w, y1: h }, items: [], bay: null, seats: [], box: bounds([], 0, w, h) });
  const tone = (slot: number) => CAR_TONES[pick(seed, slot, CAR_TONES.length)];
  if (loc.space === "basement") {
    // The garden lies at the wall top; the street runs behind it at y = -17..-10 with sidewalks, a hedge and two houses across it.
    const sy0 = -17, sy1 = sy0 + STREET, nearWalk = sy1 + KERB, hedgeY = -6.9;
    const items: Item[] = [
      it("street", -300, sy0, w + 300, sy1, 0, "back"),
      it("walk", -300, nearWalk, w + 300, nearWalk + WALK, 0, "back"), it("walk", -300, sy0 - KERB - WALK, w + 300, sy0 - KERB, 0, "back"),
      it("path", 3.6, hedgeY - 0.1, 4.8, -0.6, 0, "back"),
      ...hedgeRuns(-12, 3.6, hedgeY, seed, "back"), ...hedgeRuns(4.8, w + 6, hedgeY, seed, "back"),
      ...lotRow(seed, 200, -28, 1, 6, -24.5, sy0, "back", "houses"),
      treeItem("oak", -4, -2.7, seed ^ 1, "back"), treeItem("pine", w + 9, -5.2, seed ^ 3, "back"),
      carItem("sedan", -8, nearWalk - 2, tone(3), "back"),
      it("bin", w + 1, -3, w + 1.7, -2.3, 30, "back"), it("bin", w + 1, -4.2, w + 1.7, -3.5, 30, "back"),
      carItem("hatchback", 0.5, nearWalk - 2, PLAYER_CAR, "back", { kind: "hatchback", moving: false }),
      carItem("sedan", -16, sy0 + 1.4, tone(4), "back", { dir: "nx", moving: true }),
    ];
    return { kind: "garden", setting: "suburb", cls, seed, w, h, lift: WALL, plot: { x0: -16, y0: -34, x1: w + 14, y1: 0 }, items, bay: { x: 0.5, y: nearWalk - 2, dir: "x" }, seats: [], box: bounds(items, WALL, w, h) };
  }
  if (loc.space === "hall" || loc.space === "office" || loc.space === "share" || loc.space === "cage" || loc.space === "suite") return buildSite(settingOf(loc, game), cls, seed, w, h, loc.space !== "hall", staff);
  return none();
}

// The tile and heading of the player's car.
export const reservedBay = (s: SiteSpec) => s.bay;
// The lobby's seat slots, the same shape as the office seats.
export const lobbySeats = (s: SiteSpec): Seat[] => s.seats.slice(1);

const SOLID = new Set<ItemType>(["tree", "pole", "light", "hedge", "fence", "gate", "booth", "bin", "car", "house", "box", "lobby", "yard", "sign", "cam", "lamp", "office", "tank", "cont", "pallet", "subst", "gen", "dock", "cooling", "planter", "rack", "busstop", "turbine", "solar", "landmark"]);
const GROUND = new Set<ItemType>(["street", "walk", "path", "bays", "field", "rail"]);
// Pairs that share ground on purpose: a car in its bay or on the street, fence lines that meet at a corner.
const MAY_SHARE = (a: Item, b: Item) => a.t === "field" || a.t === "rail" || (a.t === "fence" && b.t === "fence") || (a.t === "car" && (b.t === "bays" || b.t === "street")) || (["bin", "lamp", "planter", "rack", "busstop", "booth"].includes(a.t) && b.t === "walk") || (a.t === "car" && b.t === "path") || (a.t === "path" && b.t === "gate") || (a.t === "lobby" && b.t === "sign");
// Footprints that overlap once grown by a margin; trees, poles and floodlights keep a metre clear of everything.
export function overlaps(items: Item[]): [Item, Item][] {
  const out: [Item, Item][] = [];
  const tall = (i: Item) => i.t === "tree" || i.t === "pole" || i.t === "light" || i.t === "cam";
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const p = items[a], q = items[b];
    if (!(SOLID.has(p.t) || GROUND.has(p.t)) || !(SOLID.has(q.t) || GROUND.has(q.t))) continue;
    if (GROUND.has(p.t) && GROUND.has(q.t)) continue;
    if (MAY_SHARE(p, q) || MAY_SHARE(q, p)) continue;
    const big = (i: Item) => i.t === "house" || i.t === "box" || i.t === "office" || i.t === "fence" || i.t === "lobby" || i.t === "yard", m = (p.t === "tree" && big(q)) || (q.t === "tree" && big(p)) ? 2.5 : tall(p) || tall(q) ? 1 : 0;
    if (p.x0 - m < q.x1 && q.x0 - m < p.x1 && p.y0 - m < q.y1 && q.y0 - m < p.y1) out.push([p, q]);
  }
  return out;
}
