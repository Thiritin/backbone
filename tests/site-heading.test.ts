import { describe, expect, it } from "vitest";
import { facing, FRONT, laneOffset } from "../src/ui/world/site/heading";
import { MODELS } from "../src/ui/world/site/models.gen";

describe("car facing", () => {
  it("points the front along the motion for every heading", () => {
    for (const v of [[1, 0], [-1, 0], [0, 1], [0, -1], [5, 2], [-3, 1], [1, 4], [2, -7]]) {
      const [fx, fy] = FRONT[facing(v[0], v[1])];
      expect(Math.sign(fx)).toBe(Math.abs(v[0]) >= Math.abs(v[1]) ? Math.sign(v[0]) : 0);
      expect(Math.sign(fy)).toBe(Math.abs(v[0]) >= Math.abs(v[1]) ? 0 : Math.sign(v[1]));
    }
  });

  it("keeps right-hand traffic: +x runs in the far half, -x in the near half", () => {
    expect(laneOffset("x", 1)).toBeGreaterThan(0);
    expect(laneOffset("nx", 1)).toBeLessThan(0);
  });

  it("bakes every car in all four facings with the footprint turned to match", () => {
    for (const k of ["sedan", "hatchback", "van", "coupe"]) {
      const f = (d: string) => MODELS.find((m) => m.id === `${k}-${d}`)!.fp;
      expect(f("nx")).toEqual(f("x"));
      expect(f("ny")).toEqual(f("y"));
      expect(f("x")).toEqual([f("y")[1], f("y")[0]]);
    }
  });
});
