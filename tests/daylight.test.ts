import { describe, expect, it } from "vitest";
import { darkness, daylight, NIGHT } from "../src/ui/world/draw";

describe("room darkness", () => {
  it("is day at 08:00 in January and night at 03:00", () => {
    expect(daylight(8, 0)).toBeGreaterThan(0.5);
    expect(darkness(8, 0)).toBe(0);
    expect(darkness(3, 0)).toBe(NIGHT);
  });
  it("is one flat step, with lit lamps leaving a quarter", () => {
    const seen = new Set<number>();
    for (let h = 0; h < 24; h += 0.25) for (let m = 0; m < 12; m++) seen.add(darkness(h, m));
    expect([...seen].sort()).toEqual([0, NIGHT]);
    expect(darkness(3, 0, true)).toBe(NIGHT * 0.25);
  });
});
