import { describe, expect, it } from "vitest";
import { footprint } from "../src/sim/20-world/layout";
import { itemBox } from "../src/ui/world/hall-art";
import type { Facing } from "../src/sim/20-world/layout";
import type { HallItemKind } from "../src/sim/50-state";

const KINDS: HallItemKind[] = ["crac", "transformer", "switchgear", "generator", "ups", "battery"];
const FACINGS: Facing[] = ["n", "e", "s", "w"];
const ORIGIN = { x: 6, y: 0 };

describe("plant items fit their footprints", () => {
  for (const kind of KINDS) for (const halle of [false, true]) it(`${kind} (${halle ? "halle" : "office"}) draws inside its tiles and rows of 1 to 4 never touch`, () => {
    for (const facing of FACINGS) for (let n = 1; n <= 4; n++) {
      const seen = new Set<string>();
      let x = 0;
      for (let k = 0; k < n; k++) {
        const tiles = footprint(kind, { x, y: 0, facing }, halle, ORIGIN);
        const xs = tiles.map((p) => p.x), ys = tiles.map((p) => p.y);
        const b = itemBox(kind, ORIGIN.x + x, ORIGIN.y, facing, halle);
        expect(b.x0).toBeGreaterThan(Math.min(...xs));
        expect(b.y0).toBeGreaterThan(Math.min(...ys));
        expect(b.x1).toBeLessThan(Math.max(...xs) + 1);
        expect(b.y1).toBeLessThan(Math.max(...ys) + 1);
        for (const p of tiles) { const key = `${p.x},${p.y}`; expect(seen.has(key)).toBe(false); seen.add(key); }
        x += Math.max(...xs) - Math.min(...xs) + 1;
      }
    }
  });
});
