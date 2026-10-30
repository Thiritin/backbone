import { describe, expect, it } from "vitest";
import { dateOf } from "../src/sim/00-core/time";
import { arrivalWeight } from "../src/sim/10-catalog/attention";
import type { Profile } from "../src/sim/30-customers/customers";
import { tick } from "../src/sim/88-tick/tick";
import { readyGame } from "./fixtures";

const BUSINESS: Profile[] = ["smallBiz", "agency", "office", "onlineShop", "enterprise"];

describe("lead arrivals", () => {
  it("keep each profile's weekly volume while following its hours", () => {
    for (const p of ["private", "gamer", "smallBiz"] as Profile[]) {
      let sum = 0;
      for (let h = 0; h < 168; h++) sum += arrivalWeight(p, h);
      expect(sum / 168).toBeCloseTo(1, 6);
    }
    // Tuesday 4 Jan 2005: offices write at 11:00, not at 03:00; private customers write in the evening.
    const tue = 72;
    expect(arrivalWeight("smallBiz", tue + 11)).toBeGreaterThan(20 * arrivalWeight("smallBiz", tue + 3));
    expect(arrivalWeight("private", tue + 19)).toBeGreaterThan(arrivalWeight("private", tue + 8));
  });

  it("spread over the day instead of arriving in one morning batch", () => {
    const hours = new Set<number>(), business: number[] = [];
    for (const seed of [1, 2, 3]) {
      const s = readyGame(seed);
      for (let i = 0; i < 90 * 24; i++) tick(s);
      for (const r of s.sales.requests) {
        if (r.kind !== "order") continue;
        const h = dateOf(r.createdAt).getUTCHours();
        hours.add(h);
        if (BUSINESS.includes(r.profile)) business.push(h);
      }
    }
    expect(hours.size).toBeGreaterThan(8);
    expect(business.length).toBeGreaterThan(0);
    expect(business.filter((h) => h >= 7 && h < 20).length / business.length).toBeGreaterThanOrEqual(0.8);
  });
});
