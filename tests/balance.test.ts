import { describe, expect, it } from "vitest";
import { run, SOLO, STEADY, type RunResult } from "../src/sim/balance/model";
import { PACING_YEAR } from "../src/sim/10-catalog/economy";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const steady = SEEDS.map((s) => run(STEADY, s));
const solo = SEEDS.map((s) => run(SOLO, s));
const medianYear = (runs: RunResult[], level: number) => median(runs.map((r) => r.levelYear[level] ?? Infinity));

describe("balance run (docs/design/economy.md, Balancing)", () => {
  it("is deterministic per seed", () => {
    expect(run(STEADY, 3)).toEqual(run(STEADY, 3));
  });

  it("never bankrupts the steady bot", () => {
    expect(steady.filter((r) => r.bankrupt).map((r) => r.seed)).toEqual([]);
  });

  it("lets the solo bot survive and reach level 5 but level 6 later", () => {
    expect(solo.filter((r) => r.bankrupt).map((r) => r.seed)).toEqual([]);
    expect(medianYear(solo, 5)).toBeLessThanOrEqual(PACING_YEAR[5] + 1);
    expect(medianYear(solo, 6)).toBeGreaterThan(medianYear(steady, 6));
  });

  it("brings the steady bot to levels 2 to 5 within a year of the pacing target", () => {
    // Paid internet, the business line and its addresses put level 2 up to a quarter later (economy.md, Addresses and internet);
    // the registrar and company email take another quarter at most (economy.md, Sales and quotes, Company email).
    for (const level of [2, 3, 4, 5]) expect(medianYear(steady, level)).toBeLessThanOrEqual(PACING_YEAR[level] + 1 + (level === 2 ? 0.5 : 0));
  });

  it("keeps year 1 near its targets", () => {
    const dec2005 = median(steady.map((r) => r.rows[0].customers));
    expect(dec2005).toBeGreaterThan(25);
    expect(dec2005).toBeLessThan(60);
  });

  it("brings the steady bot to level 6 within a year of the pacing target", () => {
    expect(medianYear(steady, 6)).toBeLessThanOrEqual(PACING_YEAR[6] + 1);
  });
});
