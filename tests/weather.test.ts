import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sky, temperature } from "../src/sim/20-world/weather";

const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m - 1, d)));

describe("weather", () => {
  it("reads the recorded Frankfurt temperature", () => {
    expect(temperature("Frankfurt", at(2005, 1, 3))).toBe(4);
  });
  it("repeats the record after its last year and survives Feb 29", () => {
    expect(temperature("Frankfurt", at(2026, 7, 1))).toBe(temperature("Frankfurt", at(2005, 7, 1)));
    expect(Number.isFinite(temperature("Frankfurt", at(2033, 2, 29)))).toBe(true);
  });
  it("is warmer in Dallas than Frankfurt in winter, deterministic per day", () => {
    expect(temperature("Dallas", at(2010, 1, 15))).toBeGreaterThan(temperature("Frankfurt", at(2010, 1, 15)));
    expect(sky("Dallas", at(2010, 1, 15))).toBe(sky("Dallas", at(2010, 1, 15)));
  });
  it("snows only in the cold", () => {
    for (let d = 0; d < 800; d++) { const h = at(2005, 1, 1) + d * 24; if (sky("Frankfurt", h) === "snow") expect(temperature("Frankfurt", h)).toBeLessThanOrEqual(1); }
  });
});
