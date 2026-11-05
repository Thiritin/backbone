import { describe, expect, it } from "vitest";
import { daylight } from "../src/ui/world/draw";

describe("room daylight", () => {
  it("is day at 08:00 in January and night at 03:00", () => {
    expect(daylight(8, 0)).toBeGreaterThan(0.5);
    expect(daylight(3, 0)).toBe(0);
  });
  it("is night after the winter dusk", () => expect(daylight(19, 0)).toBeLessThan(0.5));
});
