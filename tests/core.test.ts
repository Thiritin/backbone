import { describe, expect, it } from "vitest";
import { binomial, createRng, rand } from "../src/sim/00-core/rng";
import { dateOf, formatClock, hourOf, isMonthStart } from "../src/sim/00-core/time";

describe("rng", () => {
  it("repeats for the same seed", () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 5 }, () => rand(a))).toEqual(Array.from({ length: 5 }, () => rand(b)));
  });
  it("stays in [0, 1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rand(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("draws binomials near their mean", () => {
    const r = createRng(7);
    const draws = Array.from({ length: 200 }, () => binomial(r, 1000, 0.2));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(190);
    expect(mean).toBeLessThan(210);
  });
});

describe("time", () => {
  it("starts on 1 Jan 2005", () => {
    expect(formatClock(0)).toBe("Sat 1 Jan 2005 · 00:00");
    expect(isMonthStart(0)).toBe(true);
  });
  it("round-trips hours and dates", () => {
    const h = hourOf(new Date(Date.UTC(2006, 8, 14, 14)));
    expect(formatClock(h)).toBe("Thu 14 Sep 2006 · 14:00");
    expect(formatClock(h, 5)).toBe("Thu 14 Sep 2006 · 14:05");
    expect(dateOf(h).getUTCHours()).toBe(14);
  });
});
