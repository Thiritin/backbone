import { describe, expect, it } from "vitest";
import { blocksContact } from "../src/sim/30-market/market";
import { salesTick } from "../src/sim/30-market/sales";
import { profileStats } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { readyGame } from "./fixtures";

const YEAR = 8760;

// Runs the lead flow for a while with every profile aware of the company and returns the requests that arrived.
function arrivals(s: GameState, hours = 2000) {
  s.marketing = { ...s.marketing, awareness: Object.fromEntries(Object.keys(s.marketing.awareness).map((p) => [p, 1])) as typeof s.marketing.awareness };
  for (let i = 0; i < hours; i++) { s.hour++; salesTick(s); }
  return s.sales.requests.filter((r) => r.kind === "order");
}
const lowReviews = (s: GameState) => {
  s.marketing = { ...s.marketing, reviews: Array.from({ length: 100 }, (_, i) => ({ hour: s.hour, customerId: `c${i}`, name: "x", stars: 1, reason: "service" as never })) };
};

describe("requests the company visibly cannot meet", () => {
  it("brings no premium requests in the first year and some after it", () => {
    const young = readyGame(3);
    young.hour = 100;
    expect(arrivals(young).filter((r) => r.sla === "premium")).toHaveLength(0);
    const old = readyGame(3);
    old.hour = YEAR;
    expect(arrivals(old).filter((r) => r.sla === "premium").length).toBeGreaterThan(0);
  });

  it("brings no high-budget requests below 3 stars and some at the prior score", () => {
    const low = readyGame(3);
    low.hour = YEAR;
    lowReviews(low);
    expect(arrivals(low).filter((r) => profileStats(r.profile).budget === "high")).toHaveLength(0);
    const fine = readyGame(3);
    fine.hour = YEAR;
    expect(arrivals(fine).filter((r) => profileStats(r.profile).budget === "high").length).toBeGreaterThan(0);
  });

  it("blocks on age and reviews only", () => {
    const s = readyGame(3);
    expect(blocksContact(s, { sla: "premium", profile: "private" })).toBe(true);
    expect(blocksContact(s, { sla: "basic", profile: "private" })).toBe(false);
    s.hour = YEAR;
    expect(blocksContact(s, { sla: "premium", profile: "private" })).toBe(false);
    lowReviews(s);
    expect(blocksContact(s, { sla: "basic", profile: "enterprise" })).toBe(true);
  });
});
