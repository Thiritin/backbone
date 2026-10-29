import { describe, expect, it } from "vitest";
import { place, step, tidy } from "../src/ui/desktop/menu";

const a = { label: "A" }, b = { label: "B", disabled: true }, c = { label: "C" };

describe("context menu", () => {
  it("drops empty entries and stray separators", () => {
    expect(tidy([null, a, false, null, null, undefined, c, null])).toEqual([a, null, c]);
    expect(tidy([null, false])).toEqual([]);
  });

  it("steps over separators and disabled items, wrapping at both ends", () => {
    const items = [a, null, b, c];
    expect(step(items, -1, 1)).toBe(0);
    expect(step(items, 0, 1)).toBe(3);
    expect(step(items, 3, 1)).toBe(0);
    expect(step(items, -1, -1)).toBe(3);
    expect(step(items, 0, -1)).toBe(3);
    expect(step([b, null], -1, 1)).toBe(-1);
  });

  it("stays inside the viewport", () => {
    expect(place(100, 100, 200, 150, 1000, 800)).toEqual({ left: 100, top: 100 });
    expect(place(900, 100, 200, 150, 1000, 800)).toEqual({ left: 700, top: 100 });
    expect(place(900, 100, 200, 150, 1000, 800, 880)).toEqual({ left: 680, top: 100 });
    expect(place(100, 700, 200, 150, 1000, 800)).toEqual({ left: 100, top: 550 });
    expect(place(100, 50, 200, 900, 1000, 800).top).toBe(6);
  });
});
