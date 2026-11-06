import { lobbySlots } from "../../../sim/20-world/lobby";
import { BAY, bounds, carItem, fenceLine, it, lotRow, M, pick, STREET, treeItem, type Item, type LotMix, type SiteClass, type SiteSpec } from "./layout";
import { CAR_TONES, PLAYER_CAR } from "./palette";
import { compoundOf, type Setting, type UtilKind } from "./setting";

// Footprint (x by y, in m) and height (px) of the utility modules. Only read inside functions: layout.ts imports this file.
export const UTIL: Record<Exclude<UtilKind, "rail">, { w: number; d: number; top: number }> = {
  subst: { w: 8.4, d: 3.2, top: 47 }, gen: { w: 6, d: 2.5, top: 93 }, tank: { w: 3, d: 3, top: 192 }, cont: { w: 6.1, d: 2.5, top: 83 },
  pallet: { w: 1.3, d: 1.3, top: 26 }, dock: { w: 8, d: 3.2, top: 38 }, cooling: { w: 7.4, d: 2.2, top: 24 },
};

const MIX: Record<Setting, LotMix> = { suburb: "houses", industrial: "warehouses", nowhere: "farm", business: "offices" };

// The modules packed in rows behind the room, front row first, with a lane in front of each row; a module that finds no room is dropped.
function packUtil(kinds: UtilKind[], xs: number, xmax: (y1: number) => number, y1: number, yMin: number, gap: number): Item[] {
  const mods = kinds.filter((k): k is keyof typeof UTIL => k !== "rail").flatMap((k) => (k === "cont" ? [k, k] : k === "pallet" ? [k, k, k] : [k]));
  const out: Item[] = [], lanes = new Set<number>();
  let x = xs, y = y1;
  for (const k of mods) {
    const { w, d, top } = UTIL[k];
    if (x + w > xmax(y)) { x = xs; y -= 5.5 + gap / 2; }
    if (y - d < yMin) continue;
    out.push(it(k, x, y - d, x + w, y, top, "back"));
    lanes.add(y);
    x += w + gap;
  }
  for (const ly of lanes) out.push(it("path", xs, ly + 0.3, ly > -11 ? xmax(ly) - 1 : xmax(ly), ly + 1.2, 0, "back", { kind: "lane" }));
  return out;
}

// A compound for an own hall, or the walled unit of a rented room when edge is set.
export function buildSite(setting: Setting, cls: SiteClass, seed: number, w: number, h: number, edge = false, staff = 0): SiteSpec {
  const c = compoundOf(setting, cls, seed, edge), e = edge ? 0 : c.reach, gap = 4, dbl = c.fence === "double";
  const px0 = edge ? -4 : -9 - e, px1 = edge ? w + 16 : w + 13 + e, py0 = edge ? -8 : -14 - e, py1 = h + 9;
  const sy0 = py1 + 2.35, sy1 = sy0 + STREET, gateX0 = w + 3, gateX1 = w + 9, bayY = (k: number) => h + 1 - BAY.w * (k + 1);
  const tone = (slot: number) => CAR_TONES[pick(seed, slot, CAR_TONES.length)];
  const by = py0 - (setting === "nowhere" ? 8 : 14), top = dbl ? 3.2 : 2.6, boothX1 = gateX1 + (c.guard ? 5.2 : 3);
  const items: Item[] = [
    it("street", -300, sy0, w + 300, sy1, 0, "front", { moving: true }),
    it("walk", -300, py1 + 0.4, w + 300, py1 + 0.4 + 1.8, 0, "front"),
    it("bays", w + 1, bayY(edge ? 1 : 3), w + 1 + BAY.l, bayY(-1), 0, "front", { count: edge ? 2 : 4 }),
    carItem("hatchback", w + 1.4, bayY(0) + 0.1, PLAYER_CAR, "front", { kind: "hatchback", dir: "nx" }),
    ...Array.from({ length: edge ? 1 : Math.min(3, staff) }, (_, k) => carItem(["hatchback", "sedan", "van"][k], w + 1.2, bayY(k + 1) + 0.1, tone(5 + k), "front", { kind: ["hatchback", "sedan", "van"][k], dir: "nx" })),
    it("gate", gateX0, py1 - 0.3, gateX1, py1 + 0.3, M, "front", { kind: setting !== "business" && c.slide ? "slide" : "barrier" }),
    it("booth", gateX1 + 1.1, py1 - 1.6, boothX1, py1 + 0.7, Math.round(2.8 * M), "front"),
    carItem(setting === "industrial" ? "van" : "coupe", -34, sy0 + 4.2, tone(7), "front", { kind: setting === "industrial" ? "van" : "coupe", moving: true }), carItem(setting === "industrial" ? "van" : "hatchback", w + 16, sy0 + 1.4, tone(8), "front", { kind: setting === "industrial" ? "van" : "hatchback", dir: "nx", moving: true }),
    it("cam", gateX0 - 1.6, py1 - 3.5, gateX0 - 1.4, py1 - 3.3, 5 * M, "front", { kind: "gate" }),
    ...fenceLine("x", py0, px0, px1, "back", dbl, top), ...fenceLine("y", px0, py0, py1, "back", dbl, top), ...fenceLine("y", px1, py0, py1, "front", dbl, top),
    ...fenceLine("x", py1, px0, gateX0, "front", false, 2.6), ...fenceLine("x", py1, boothX1, px1, "front", false, 2.6),
  ];
  if (edge) {
    items.push(it("light", w + 7.9, h + 0.9, w + 8.1, h + 1.1, 8 * M, "front"), ...packUtil(["cont", "pallet"], px0 + 2, () => w - 1, -3.5, py0 + 1.2, 1.2));
  } else {
    items.push(
      it("lobby", 0, h, 9, h + 6, 96, "front"), it("sign", 5.2, h + 0.6, 7, h + 0.8, 56, "front"),
      it("yard", w - 11, -9.4, w - 1, -4.5, 56, "back", { count: 3 }),
      it("path", 3.4, h + 6, 4.8, h + 8.2, 0, "front"), it("path", 3.4, h + 7.2, gateX0 + 3, h + 8.2, 0, "front"), it("path", gateX0 + 1, h + 7.2, gateX0 + 3, py1 + 0.4, 0, "front"),
      it("light", px1 - 6.1, py0 + 5.9, px1 - 5.9, py0 + 6.1, 8 * M, "back"), it("light", px0 + 5.9, 3, px0 + 6.1, 3.2, 8 * M, "back"),
      it("bin", w + 7, h + 2.3, w + 7.7, h + 3, 30, "front"), it("bin", w + 7.9, h + 2.3, w + 8.6, h + 3, 30, "front"),
    );
    // Tanks stand in a farm beside the room on the larger classes; the rest packs in rows behind it, spaced wider as the site grows.
    const tanks = cls === "S" ? [] : c.util.filter((k) => k === "tank"), rest = c.util.filter((k) => cls === "S" || k !== "tank");
    tanks.forEach((_, k) => items.push(it("tank", px0 + 8, 2 + k * 5, px0 + 11, 5 + k * 5, UTIL.tank.top, "back")));
    items.push(...packUtil(rest, px0 + (dbl ? gap + 1.5 : 2), (y) => (y > -10 ? w - 12.5 : px1 - 9), -4.5, py0 + (dbl ? gap + 0.6 : 1.5), cls === "L" ? 3.5 : cls === "M" ? 2.2 : 1.2));
    if (dbl) {
      items.push(
        ...fenceLine("x", py0 + gap, px0 + gap, px1 - gap, "back", false, 2.6), ...fenceLine("y", px0 + gap, py0 + gap, py1 - 5, "front", false, 2.6), ...fenceLine("y", px1 - gap, py0 + gap, py1 - 5, "front", false, 2.6),
        it("cam", px1 - 2.1, py0 + 1.9, px1 - 1.9, py0 + 2.1, 5 * M, "back"), it("cam", px0 + 1.9, py0 + 1.9, px0 + 2.1, py0 + 2.1, 5 * M, "back"),
      );
    }
  }

  // Neighbours, scenery and trees by setting. Industrial rows are few and wide apart; business rows are denser; the farm grows with the class.
  const n = setting === "business" ? (edge ? 2 : 3) : setting === "nowhere" ? { S: 2, M: 3, L: 4 }[cls] : edge ? 2 : 3, off = setting === "nowhere" ? 7 : 10;
  const left = lotRow(seed, 300, px0 - off, -1, n, h + 4, sy0, "front", MIX[setting], 0, setting === "industrial" && cls === "L" && !edge);
  items.push(...left);
  if (setting !== "nowhere") items.push(...lotRow(seed, 400, px1 + off, 1, n, h + 4, sy0, "front", MIX[setting], n));
  if (setting === "nowhere") {
    // A windbreak in two or three clumps of irregular spacing, well off the fence, and a track to the street.
    const span = px1 - px0 - 20, clumps = Math.max(1, Math.min(2 + pick(seed, 610, 2), Math.floor(span / 8.6)));
    for (let g = 0; g < clumps; g++) {
      const cx = px0 + 10 + (span * g) / clumps + pick(seed, 620 + g, 5) / 3;
      for (let k = 0; k < Math.max(1, Math.min(3 + pick(seed, 630 + g, 3), Math.floor(span / clumps / 8.6))); k++) items.push(treeItem(pick(seed, 650 + g * 8 + k, 4) === 0 ? "oak" : "pine", cx + k * 6.9 + pick(seed, 660 + g * 8 + k, 5) / 4, by - 2 + pick(seed, 670 + g * 8 + k, 7) / 2, seed ^ (70 + g * 8 + k), "back"));
    }
    items.push(it("path", px1 + 4, py0 - 10, px1 + 6.5, sy0, 0, "back", { kind: "track" }));
    items.push(it("turbine", px1 + 12, py0 + 2, px1 + 18.3, py0 + 13.7, 24 * M, "back"));
    if (cls === "L") items.push(it("turbine", px1 + 32, py0 + 2, px1 + 38.3, py0 + 13.7, 24 * M, "back"));
    {
      const y0 = py0 + 15, rows = Math.max(1, Math.min({ S: 2, M: 3, L: 3 }[cls], Math.floor((py1 - 3 - y0) / 7)));
      items.push(it("solar", px1 + 10, y0, px1 + 10 + 12 * { S: 2, M: 2, L: 3 }[cls], y0 + 7 * rows, 70, "back"));
    }
    const f = (k: number, x0: number, y0: number, x1: number, y1: number) => it("field", x0, y0, x1, y1, 0, "back", { count: pick(seed, 20 + k, 3) });
    items.push(f(0, px0 - 70, py0 - 60, px0 - 4, py0 - 14), f(1, px0 - 4, py0 - 60, px1 + 4, py0 - 14), f(2, px1 + 4, py0 - 60, px1 + 70, py0 - 14), f(3, px0 - 70, py0 - 10, px0 - 8, h - 10), f(4, px1 + 8, py0 - 10, px1 + 70, sy0 - 3));
  } else {
    const oak = setting === "business";
    items.push(treeItem("oak", w + 4 + e, by, seed ^ 2, "back"), treeItem("pine", w + 23 + e, by + 2.5, seed ^ 1, "back"));
    if (!edge) items.push(...[-7, -1, 5].map((x, k) => treeItem(oak ? "oak" : "pine", x - e, by + 0.5, seed ^ (10 + k), "back")).slice(0, setting === "industrial" ? 1 : 3));
    // Trees stand behind the buildings, never on the verge, so no canopy covers the road or a driveway.
    items.filter((i) => i.t === "house" || i.t === "box" || i.t === "office").forEach((l, k) => {
      if (setting === "industrial" ? k % 3 === 0 : k % 2 === 0) items.push(treeItem(oak ? "oak" : "pine", (l.x0 + l.x1) / 2, l.y0 - 5.8, seed ^ (90 + k), "front"));
    });
    if (setting === "business" && !edge && cls !== "S") {
      // More content as the site grows: planters on M, a second parking strip on L.
      items.push(it("planter", -6.5, cls === "L" ? 12.4 : 2, -5.3, cls === "L" ? 13.4 : 3, 26, "front"), it("planter", -6.5, cls === "L" ? 14 : 5, -5.3, cls === "L" ? 15 : 6, 26, "front"));
      if (cls === "L") items.push(it("bays", -9.5, 2, -4.5, 2 + BAY.w * 4, 0, "front", { count: 4 }), carItem("coupe", -8.9, 2.35, tone(11), "front", { kind: "coupe", dir: "x" }), carItem("sedan", -8.9, 2 + BAY.w * 2 + 0.3, tone(12), "front", { kind: "sedan", dir: "x" }));
    }
  }
  if (c.siding) items.push(it("rail", px0 - 40, py0 - 14, px1 + 40, py0 - 11, 0, "back"));
  if (setting === "business") {
    const drives = items.filter((i) => i.t === "path"), free = (i: Item) => !drives.some((d) => d.x0 - 0.5 < i.x1 && i.x0 < d.x1 + 0.5 && d.y1 > i.y0);
    const walkY = py1 + 0.7;
    const street: Item[] = [
      ...Array.from({ length: 4 }, (_, k) => it("lamp", -25 + 14 * k + 0.1, walkY + 1.1, -25 + 14 * k + 0.4, walkY + 1.4, 5 * M, "front")),
      it("busstop", 12, walkY, 15.5, walkY + 1.2, Math.round(2.6 * M), "front"),
      it("planter", 20, walkY + 0.2, 21.2, walkY + 0.9, 26, "front"), it("planter", 8.5, walkY + 0.2, 9.7, walkY + 0.9, 26, "front"),
      it("rack", -3, h + 1, -1.2, h + 1.5, 28, "front"),
    ].filter(free);
    items.push(...street.filter((i) => !edge || i.t !== "rack"));
  }
  const seats = edge ? [] : lobbySlots(cls, h);
  return { kind: "plot", setting, cls, seed, w, h, lift: 0, plot: { x0: px0, y0: py0, x1: px1, y1: py1 }, items, bay: { x: w + 1.4, y: bayY(0) + 0.1, dir: "x" }, seats, box: bounds(items, 0, w, h) };
}
