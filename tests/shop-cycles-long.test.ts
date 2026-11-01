import { describe, expect, it } from "vitest";
import { CYCLE_MONTHS, CYCLE_SHARE, CYCLES, MARKET_DISCOUNT } from "../src/sim/10-catalog/cycles";
import { shopById } from "../src/sim/10-catalog/shops";

describe("semi-annual and triennial cycles", () => {
  it("run six and thirty-six months at their own discounts", () => {
    expect(CYCLE_MONTHS.semiannual).toBe(6);
    expect(CYCLE_MONTHS.triennial).toBe(36);
    expect(MARKET_DISCOUNT.semiannual).toBeGreaterThan(MARKET_DISCOUNT.quarterly);
    expect(MARKET_DISCOUNT.triennial).toBeGreaterThan(MARKET_DISCOUNT.biennial);
  });
  it("give every profile a share per cycle", () => {
    for (const p of Object.keys(CYCLE_SHARE) as (keyof typeof CYCLE_SHARE)[]) expect(CYCLE_SHARE[p]).toHaveLength(CYCLES.length);
  });
  it("are sold by the full-featured systems only", () => {
    expect(shopById("whmCache").cycles).toContain("triennial");
    expect(shopById("handRolled").cycles).not.toContain("semiannual");
  });
});
