import { describe, expect, it } from "vitest";
import { run, SOLO, STEADY, type RunResult } from "../src/sim/balance/model";
import { PACING_YEAR } from "../src/sim/10-catalog/economy";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const steady = SEEDS.map((s) => run(STEADY, s));
const solo = SEEDS.map((s) => run(SOLO, s));
const medianYear = (runs: RunResult[], level: number) => median(runs.map((r) => r.levelYear[level] ?? Infinity));

describe("balance run (docs/design/economy/balancing.md, Balancing)", () => {
  it("is deterministic per seed", () => {
    expect(run(STEADY, 3, 2)).toEqual(run(STEADY, 3, 2));
  });

  it("never bankrupts the steady bot", () => {
    expect(steady.filter((r) => r.bankrupt).map((r) => r.seed)).toEqual([]);
  });

  // Without staff, only a hosted desk's AI agent from 2023 takes routine tickets off the founder, after the run ends.
  it("lets the solo bot survive and reach level 4 but stall there", () => {
    expect(solo.filter((r) => r.bankrupt).map((r) => r.seed)).toEqual([]);
    expect(medianYear(solo, 4)).toBeLessThanOrEqual(PACING_YEAR[4] + 1);
    expect(medianYear(solo, 5)).toBe(Infinity);
  });

  it("brings the steady bot to levels 2 to 5 within a year of the pacing target", () => {
    // Paid internet, the business line and its addresses put level 2 up to a quarter later (economy/addresses-and-internet.md, Addresses and internet);
    // the registrar and company email take another quarter at most (economy/sales-and-quotes.md, Sales and quotes, Company email).
    for (const level of [2, 3, 4, 5]) expect(medianYear(steady, level)).toBeLessThanOrEqual(PACING_YEAR[level] + 1 + (level === 2 ? 0.5 : 0));
  });

  it("keeps year 1 near its targets", () => {
    const dec2005 = median(steady.map((r) => r.rows[0].customers));
    expect(dec2005).toBeGreaterThan(25);
    expect(dec2005).toBeLessThan(60);
  });

  // Rivals that open and grow (competitors.md) slow level 6 by up to about half a year.
  it("brings the steady bot to level 6 within a year and a half of the pacing target", () => {
    expect(medianYear(steady, 6)).toBeLessThanOrEqual(PACING_YEAR[6] + 1.5);
  });
});
