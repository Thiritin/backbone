import { describe, expect, it } from "vitest";
import { gridTick } from "../src/sim/60-infra/incidents";
import { HOURS_PER_YEAR } from "../src/sim/60-infra/status";
import { readyGame } from "./fixtures";

const YEARS = 10, SEEDS = 20;
const SITES = { basement: null, "rented, UPS": "spree-colo", "rented, UPS and generator": "equinox-fr5" } as const;

// Grid interruptions and customer-visible dark spells of one location over YEARS game years, per seed.
function measure(dc: string | null, seed: number) {
  const s = readyGame(seed);
  s.locations[0].dc = dc;
  let outages = 0;
  const dark: number[] = [];
  for (let h = 0; h < YEARS * HOURS_PER_YEAR; h++) {
    s.hour = h + 1;
    for (const e of gridTick(s)) {
      if (e.key === "event.gridDark") { outages++; dark.push(Number(e.params?.minutes)); }
      else if (e.key === "event.gridCarried") outages++;
    }
  }
  return { outages, dark };
}

export function table() {
  return Object.entries(SITES).map(([kind, dc]) => {
    const runs = Array.from({ length: SEEDS }, (_, i) => measure(dc, i + 1));
    const dark = runs.flatMap((r) => r.dark).sort((a, b) => a - b);
    const n = SEEDS * YEARS;
    return { kind, perYear: runs.reduce((a, r) => a + r.outages, 0) / n, visiblePerYear: dark.length / n, minutesPerYear: dark.reduce((a, b) => a + b, 0) / n, median: dark[dark.length >> 1] ?? 0, p95: dark[Math.floor(dark.length * 0.95)] ?? 0 };
  });
}

describe("grid outage rates", () => {
  it("match German grid statistics", () => {
    const t = Object.fromEntries(table().map((r) => [r.kind, r]));
    if (process.env.GRID_TABLE) console.log(JSON.stringify(Object.values(t), null, 1));
    // Grid interruptions a year, storms included (about 0.1 a year, at every site at once).
    const within = (v: number, lo: number, hi: number) => { expect(v).toBeGreaterThan(lo); expect(v).toBeLessThan(hi); };
    within(t.basement.perYear, 0.25, 0.5);
    within(t["rented, UPS"].perYear, 0.1, 0.3);
    within(t["rented, UPS and generator"].perYear, 0.1, 0.3);
    within(t.basement.minutesPerYear, 10, 60);
    within(t["rented, UPS"].minutesPerYear, 5, 40);
    expect(t["rented, UPS and generator"].visiblePerYear).toBeLessThan(0.05);
  }, 120000);

  it("is deterministic per seed", () => {
    expect(measure(null, 3)).toEqual(measure(null, 3));
  }, 60000);
});
