import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { monthlySalary } from "../src/sim/10-catalog/economy";
import { campaignBoost, hasMarketingManager, reviewBoost, TASKS, visibleCandidates } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { leadsThisMonth } from "../src/sim/80-business/marketing";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { setCampaign, setReviewPlatform } from "../src/sim/90-actions/marketing";
import { assign, fire, hire } from "../src/sim/90-actions/staff";

const FEB_1 = 744;

function withManager(seed: number, skill = 50): { s: GameState; id: string } {
  const s = newGame(seed);
  const r = hire(s, visibleCandidates(s).find((c) => c.role === "marketing")!.id);
  if (!r.ok) throw new Error(r.error);
  Object.assign(s.staff[0], { skill, talent: 100 });
  return { s, id: r.id! };
}
const campaignLeads = (s: GameState) => leadsThisMonth(s).filter((b) => b.source === "gaming").reduce((n, b) => n + b.count, 0);

describe("marketing manager", () => {
  it("is on the job market at the marketing manager salary and trains on marketing tasks", () => {
    const s = newGame(1);
    const c = visibleCandidates(s).filter((x) => x.role === "marketing");
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].salary).toBe(Math.round(monthlySalary("marketing", c[0].skill, 2005)));
    expect(TASKS.marketing).toEqual(["campaigns", "reviews", "fairs"]);
  });

  it("is required for paid review platforms", () => {
    const s = newGame(2);
    expect(setReviewPlatform(s, "free")).toEqual({ ok: true });
    expect(setReviewPlatform(s, "provenExpat")).toEqual({ ok: false, error: "error.needsMarketingManager" });
    expect(setReviewPlatform(s, "trustPylon")).toEqual({ ok: false, error: "error.needsMarketingManager" });
    const { s: t } = withManager(3);
    expect(hasMarketingManager(t)).toBe(true);
    expect(setReviewPlatform(t, "trustPylon")).toEqual({ ok: true });
  });

  it("moves the company back to the free listing at the month start once the manager is gone", () => {
    const { s, id } = withManager(4);
    setReviewPlatform(s, "trustPylon");
    fire(s, id);
    const events: SimEvent[] = [];
    while (s.hour < FEB_1 + 1) events.push(...tick(s));
    expect(s.marketing.platform).toBe("free");
    expect(events.some((e) => e.key === "event.platformDropped")).toBe(true);
    expect(s.ledger.some((l) => l.key === "ledger.reviewPlatform")).toBe(false);
  });

  it("makes campaigns a bit more efficient once trained, and review invites more frequent", () => {
    const { s, id } = withManager(5, 50);
    s.cash = 10_000;
    setCampaign(s, "gaming", ["gamer"], 1000);
    const base = campaignLeads(s);
    expect(campaignBoost(s)).toBe(1);
    s.staff[0].trained = ["campaigns", "reviews"];
    expect(campaignBoost(s)).toBeCloseTo(1.1, 6);
    expect(campaignLeads(s)).toBeCloseTo(base * 1.1, 6);
    expect(reviewBoost(s)).toBe(1.5);
    assign(s, id, "forum");
    expect(campaignBoost(s)).toBe(1);
    expect(reviewBoost(s)).toBe(1);
  });
});
