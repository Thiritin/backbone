import { describe, expect, it } from "vitest";
import { aisleTiles, dragLine, frontOf, key, runsOf, tilesOf, turnParts, wallPieces, walkPath, type Part } from "../src/ui/world/hall-edit-geom";
import { areasOf } from "../src/sim/20-world/layout";

const rack: Part = { x: 4, y: 3, fw: 1, fh: 1, facing: "s" };
const vent: Part = { x: 5, y: 3, fw: 1, fh: 1, facing: "n" };
const crac: Part = { x: 6, y: 2, fw: 2, fh: 1, facing: "e" };

describe("hall edit geometry", () => {
  it("returns a turned group to itself after four quarter turns", () => {
    const group = [rack, vent, { ...crac, fw: 2, fh: 1, facing: "s" as const }];
    const pivot = { x: 5, y: 3 };
    let g = group;
    for (let i = 0; i < 4; i++) g = turnParts(g, pivot);
    expect(g).toEqual(group);
    const once = turnParts(group, pivot);
    expect(once[2]).toMatchObject({ fw: 1, fh: 2, facing: "w" });
    expect(tilesOf(once[2])).toHaveLength(2);
  });

  it("lays a drag line of racks along the longer axis", () => {
    const line = dragLine({ x: 3, y: 2 }, { x: 3, y: 7 });
    expect(line).toHaveLength(6);
    expect(line.every((p) => p.x === 3)).toBe(true);
    expect(line.map((p) => p.y)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(dragLine({ x: 2, y: 2 }, { x: 8, y: 2 }, 2, 1)).toHaveLength(4);
  });

  it("splits runs where the facing changes or a gap occurs", () => {
    const racks = [{ x: 1, y: 1, facing: "s" as const }, { x: 2, y: 1, facing: "s" as const }, { x: 4, y: 1, facing: "s" as const }, { x: 5, y: 1, facing: "n" as const }, { x: 6, y: 1, facing: "n" as const }];
    const runs = runsOf(racks);
    expect(runs.map((r) => [r.facing, r.tiles.length]).sort()).toEqual([["n", 2], ["s", 1], ["s", 2]]);
    expect(runsOf([{ x: 1, y: 1, facing: "e" }, { x: 1, y: 2, facing: "e" }, { x: 1, y: 4, facing: "e" }]).map((r) => r.tiles.length)).toEqual([2, 1]);
  });

  it("keeps light rails off every body tile", () => {
    const bodies = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }];
    const fronts = bodies.flatMap((b) => frontOf([b], "s"));
    const rails = aisleTiles(fronts, bodies.map(key), [key({ x: 2, y: 3 })]);
    expect(rails.every((p) => !bodies.some((b) => key(b) === key(p)))).toBe(true);
    expect(rails.map(key)).toEqual(["3,4"]);
  });

  it("finds the way through a doorway and none when it is walled off", () => {
    const areas = areasOf({ w: 16, h: 8 }, false);
    const to = { x: 17, y: 3 };
    expect(walkPath(areas, new Set(), { x: 3, y: 1 }, { x: 16, y: 1 })?.at(-1)).toEqual({ x: 16, y: 1 });
    expect(walkPath(areas, new Set(), { x: 3, y: 3 }, to)).not.toBeNull();
    expect(walkPath(areas, new Set([key({ x: 15, y: 1 })]), { x: 3, y: 1 }, { x: 16, y: 1 })).toBeNull();
    expect(wallPieces(0, 4, [1])).toEqual([0, 2, 3]);
  });
});
