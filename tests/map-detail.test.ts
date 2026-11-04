import { describe, expect, it } from "vitest";
import { clipLine, encode, fade, meetsBox, regionBox, simplify, townClass, townLevel } from "../src/ui/map/detail";
import { decode } from "../src/ui/map/streets/decode";

describe("map detail layers", () => {
  it("always keeps some layer opaque between street and world zoom", () => {
    for (let k = 1e-4; k < 0.03; k *= 1.05) {
      const f = fade(k);
      expect(Math.max(f.patch, f.region, f.europe)).toBe(1);
    }
    expect(fade(0.3)).toEqual({ patch: 0, region: 0, europe: 0, detail: 0 });
    expect(fade(0.001).patch).toBe(1);
  });
  it("fades the street patch out before the regional layer", () => {
    expect(fade(0.008).patch).toBe(0);
    expect(fade(0.008).region).toBe(1);
    expect(fade(0.03).europe).toBe(1);
  });
  it("shows more town classes as the view closes in", () => {
    const levels = [0.2, 0.1, 0.02, 0.008, 0.002, 0.0005].map(townLevel);
    expect(levels).toEqual([0, 1, 2, 3, 4, 5]);
    expect([2e6, 4e5, 2e5, 5e4, 9e3].map(townClass)).toEqual([1, 2, 3, 4, 5]);
  });
  it("spans 150 km around a city", () => {
    const b = regionBox(50.11, 8.68);
    expect((b.n - b.s) * 111).toBeCloseTo(300, 0);
    expect(meetsBox(b, regionBox(49.45, 11.08))).toBe(true);
    expect(meetsBox(b, regionBox(52.37, 13.4))).toBe(false);
  });
  it("simplifies within tolerance and keeps the ends", () => {
    const line: [number, number][] = Array.from({ length: 101 }, (_, i) => [i / 10, Math.sin(i / 10) * 0.001]);
    const s = simplify(line, 0.01);
    expect(s).toEqual([line[0], line[100]]);
    expect(simplify(line, 0).length).toBe(101);
  });
  it("clips a line to the box", () => {
    const b = { w: 0, s: 0, e: 10, n: 10 };
    expect(clipLine([[-1, 5], [1, 5], [2, 5], [11, 5], [3, 3], [4, 4]], b)).toEqual([[[1, 5], [2, 5]], [[3, 3], [4, 4]]]);
  });
  it("packs lines so the street decoder reads them back", () => {
    const lines: [number, number][][] = [[[8.1234, 50.5], [8.2, 50.6]], [[-0.1, 51.5], [0.05, 51.4]]];
    const back = decode(encode(lines));
    back.forEach((l, i) => l.forEach((p, j) => { expect(p[0]).toBeCloseTo(lines[i][j][0], 4); expect(p[1]).toBeCloseTo(lines[i][j][1], 4); }));
  });
});
