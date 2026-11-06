import { describe, expect, it } from "vitest";
import { buildSite } from "../src/ui/world/site/compound";
import type { Item } from "../src/ui/world/site/layout";

const settings = ["industrial", "nowhere", "business"] as const;
const classes = ["S", "M", "L"] as const;
const key = (x: number, y: number) => `${x},${y}`;

// Fence ends as tile points; an x-run is (x0,y)..(x1,y), a y-run (x,y0)..(x,y1).
const ends = (f: Item) => (f.dir === "x" ? [[f.x0, f.y0], [f.x1, f.y0]] : [[f.x0, f.y0], [f.x0, f.y1]]);

describe("compound fence", () => {
  for (const setting of settings) for (const cls of classes) for (const seed of [1, 7, 4321]) {
    it(`${setting} ${cls} ${seed} is closed on whole tiles with a gate on the street side`, () => {
      const sp = buildSite(setting, cls, seed, 20, 12, false, 3);
      const fences = sp.items.filter((i) => i.t === "fence");
      for (const f of fences) for (const [x, y] of ends(f)) { expect(Number.isInteger(x)).toBe(true); expect(Number.isInteger(y)).toBe(true); }
      // Each ring (outer, inner) is a set of runs; every end point is shared by two runs except the two gate ends.
      const deg = new Map<string, number>();
      for (const f of fences) for (const [x, y] of ends(f)) deg.set(key(x, y), (deg.get(key(x, y)) ?? 0) + 1);
      const open = [...deg.entries()].filter(([, d]) => d !== 2);
      const gate = sp.items.find((i) => i.t === "gate")!;
      const solid = sp.items.filter((i) => ["lobby", "yard", "booth", "gate", "bays"].includes(i.t));
      for (const f of fences) for (const o of solid) expect(f.x0 < o.x1 && f.x1 > o.x0 && f.y0 < o.y1 && f.y1 > o.y0, `${f.x0},${f.y0},${f.x1},${f.y1} meets ${o.t} ${o.x0},${o.y0},${o.x1},${o.y1}`).toBe(false);
      const booth = sp.items.find((i) => i.t === "booth")!;
      expect([2, 6]).toContain(open.length);
      for (const [k] of open) { const [x, y] = k.split(",").map(Number); expect(x >= 2 && x <= booth.x1).toBe(true); expect(y).toBeGreaterThan(gate.y0 - 6); }
    });
  }
});
