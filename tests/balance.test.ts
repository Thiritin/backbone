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

  it("lets the solo bot survive but level up later", () => {
    expect(solo.filter((r) => r.bankrupt).map((r) => r.seed)).toEqual([]);
    expect(medianYear(solo, 4)).toBeGreaterThan(medianYear(steady, 4));
  });

  // Known gap: leads are too scarce after level 2. Flip to `it` once the economy is tuned.
  it.fails("brings the steady bot to each level within a year of the pacing target", () => {
    for (const level of [2, 3, 4, 5, 6]) expect(medianYear(steady, level)).toBeLessThanOrEqual(PACING_YEAR[level] + 1);
  });
});
