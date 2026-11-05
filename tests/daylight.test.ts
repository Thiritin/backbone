import { describe, expect, it } from "vitest";
import { darkness, daylight, NIGHT } from "../src/ui/world/draw";

describe("room darkness", () => {
  it("is day at 08:00 in January with at most a faint dawn tint", () => {
    expect(daylight(8, 0)).toBeGreaterThan(0.5);
    expect(darkness(8, 0)).toBeLessThan(NIGHT / 2);
    expect(darkness(12, 0)).toBe(0);
  });
  it("is full night at 03:00", () => expect(darkness(3, 0)).toBe(NIGHT));
});
