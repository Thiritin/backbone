import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { createTicket } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import {
  addAwareness, addReview, announceReview, awareness, discountFor, leadsThisMonth, monthlyMarketingCost, reviewMultiplier, reviewScore, trustBonus,
} from "../src/sim/80-business/marketing";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setCampaign, setReviewPlatform, setUpChannel, stopCampaign } from "../src/sim/90-actions/marketing";
import { hire } from "../src/sim/90-actions/staff";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withCompany } from "./fixtures";

const FEB_1 = 744;
// Paid review platforms need a marketing manager on staff.
const hireManager = (s: GameState) => hire(s, visibleCandidates(s).find((c) => c.role === "marketing")!.id);
const until = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const months = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { tick(s); while (!isMonthStart(s.hour)) tick(s); } };

describe("owned channels", () => {
  it("sets up the website, then the order form and ads that need it", () => {
    const s = withCompany({ ...newGame(1), cash: 1000 });
    expect(setUpChannel(s, "orderForm")).toEqual({ ok: false, error: "error.needsWebsite" });
    expect(setUpChannel(s, "website").ok).toBe(true);
    expect(s.cash).toBe(600);
    expect(s.ledger.at(-1)).toMatchObject({ category: "marketing", key: "ledger.marketingSetup", amount: -400 });
    expect(setUpChannel(s, "website")).toEqual({ ok: false, error: "error.channelOwned" });
    expect(setUpChannel(s, "searchAds").ok).toBe(true);
    expect(setUpChannel(s, "aiAds")).toEqual({ ok: false, error: "error.channelLater" });
    expect(setUpChannel(s, "orderForm")).toEqual({ ok: false, error: "error.noCash" });
  });
});

describe("campaigns", () => {
  it("validates the channel, audiences, budget and discount", () => {
    const s = newGame(2);
    expect(setCampaign(s, "search", ["gamer"], 250)).toEqual({ ok: false, error: "error.channelMissing" });
    expect(setCampaign(s, "gaming", ["enterprise"], 250)).toEqual({ ok: false, error: "error.campaignTargets" });
    expect(setCampaign(s, "gaming", ["gamer"], 333)).toEqual({ ok: false, error: "error.campaignBudget" });
    expect(setCampaign(s, "gaming", ["gamer"], 250, 0.1)).toEqual({ ok: false, error: "error.campaignDiscount" });
    expect(setCampaign(s, "agency", ["agency"], 250, 0.2).ok).toBe(true);
    expect(discountFor(s, "agency")).toBe(0.2);
    expect(discountFor(s, "gamer")).toBe(0);
    expect(stopCampaign(s, "agency").ok).toBe(true);
    expect(discountFor(s, "agency")).toBe(0);
  });

  it("turns budget into leads, dearer the more one city gets", () => {
    const s = newGame(3);
    setCampaign(s, "gaming", ["gamer"], 250);
    const [lead] = leadsThisMonth(s);
    // €8 in 2026 × 0.6 in 2005 = €4.80 per lead, × (1 + 250 / 5,000).
    expect(lead).toMatchObject({ profile: "gamer", city: "Frankfurt", source: "gaming", conversion: 1 });
    expect(lead.count).toBeCloseTo(250 / (4.8 * 1.05), 6);
    setCampaign(s, "gaming", ["gamer"], 5000);
    expect(leadsThisMonth(s)[0].count / 5000).toBeLessThan(lead.count / 250);
    setCampaign(s, "coldCall", ["soleProp", "office"], 500);
    const calls = leadsThisMonth(s).filter((b) => b.source === "coldCall");
    expect(calls.map((b) => b.conversion)).toEqual([0.35, 0.35]);
    expect(calls[0].count).toBeGreaterThan(calls[1].count);
  });

  it("bills campaigns, upkeep and the platform at the month start", () => {
    const s = withCompany(newGame(4));
    s.cash = 5000;
    setUpChannel(s, "website");
    setCampaign(s, "gaming", ["gamer"], 250);
    hireManager(s);
    setReviewPlatform(s, "provenExpat");
    expect(monthlyMarketingCost(s)).toBeCloseTo(15 + 250 + 49 + 9.9, 9);
    const before = s.cash;
    until(s, FEB_1);
    const lines = s.ledger.filter((l) => l.category === "marketing" && l.hour === FEB_1);
    expect(lines.map((l) => l.key).sort()).toEqual(["ledger.marketingCampaign", "ledger.marketingUpkeep", "ledger.reviewPlatform", "ledger.siteHosting"]);
    expect(lines.reduce((n, l) => n + l.amount, 0)).toBeCloseTo(-323.9, 9);
    expect(s.cash).toBeLessThanOrEqual(before - 323.9);
  });
});

describe("awareness", () => {
  it("grows slowly with a campaign and decays back without one", () => {
    const s = newGame(5);
    s.cash = 1e6;
    setCampaign(s, "gaming", ["gamer"], 1000);
    const start = awareness(s, "gamer");
    months(s, 1);
    const first = awareness(s, "gamer");
    expect(first).toBeGreaterThan(start);
    expect(first - start).toBeLessThan(0.1);
    months(s, 23);
    const peak = awareness(s, "gamer");
    expect(peak).toBeGreaterThan(0.4);
    expect(awareness(s, "enterprise")).toBeCloseTo(0.02, 6);
    stopCampaign(s, "gaming");
    months(s, 12);
    expect(awareness(s, "gamer")).toBeLessThan(peak);
    addAwareness(s, "hobbyDev", 0.5);
    expect(awareness(s, "hobbyDev")).toBeCloseTo(0.02 + 0.98 * 0.5, 6);
  });
});

describe("reviews", () => {
  it("counts every review but notifies only once the Reviews section is unlocked", () => {
    const s = newGame(6);
    const id = addCustomer(s, "Jonas Weber", "private");
    const events: SimEvent[] = [];
    announceReview(s, addReview(s, id, 1), events);
    expect(s.marketing.reviews).toHaveLength(1);
    expect(events).toHaveLength(0);
    s.unlocks = ["marketingBasics"];
    announceReview(s, addReview(s, id, 5), events);
    expect(events).toMatchObject([{ app: "Marketing", key: "event.review", params: { stars: 5 } }]);
  });

  it("scores from a prior of 3.5 stars worth 20 reviews", () => {
    const s = newGame(6);
    const id = addCustomer(s, "Jonas Weber", "private");
    expect(reviewScore(s)).toBe(3.5);
    for (let i = 0; i < 20; i++) addReview(s, id, 5);
    expect(reviewScore(s)).toBeCloseTo(4.25, 6);
    expect(reviewMultiplier(s)).toBeCloseTo(0.4 + 0.25 * 3.25, 6);
    expect(trustBonus(s)).toBe(0);
    hireManager(s);
    setReviewPlatform(s, "trustPylon");
    expect(trustBonus(s)).toBe(6);
  });

  it("customers review some closed tickets and cancellations, angrier when unhappy", () => {
    const s = newGame(7);
    const ids = Array.from({ length: 200 }, (_, i) => addCustomer(s, `Customer ${i}`, "gamer"));
    tick(s);
    for (const [i, id] of ids.entries()) {
      const c = s.customers.find((x) => x.id === id)!;
      c.happiness = i < 100 ? 20 : 90;
      const t = createTicket(s, c, "howTo");
      Object.assign(t, { status: "closed", updatedAt: s.hour });
    }
    tick(s);
    const reviews = s.marketing.reviews;
    const sad = reviews.filter((r) => ids.indexOf(r.customerId) < 100), glad = reviews.filter((r) => ids.indexOf(r.customerId) >= 100);
    expect(sad.length).toBeGreaterThan(glad.length);
    expect(sad.every((r) => r.stars <= 2)).toBe(true);
    expect(glad.every((r) => r.stars >= 4)).toBe(true);
    const count = reviews.length;
    tick(s);
    expect(s.marketing.reviews.length).toBe(count);
  });

  it("platform invites bring reviews from happy customers", () => {
    const s = newGame(8);
    for (let i = 0; i < 400; i++) addCustomer(s, `Customer ${i}`, "private");
    for (const c of s.customers) c.happiness = 85;
    hireManager(s);
    setReviewPlatform(s, "trustPylon");
    until(s, FEB_1);
    const invited = s.marketing.reviews.filter((r) => r.reason === "invite");
    expect(invited.length).toBeGreaterThan(0);
    expect(invited.every((r) => r.stars >= 4)).toBe(true);
  });
});

describe("saves", () => {
  it("loads a save without marketing with defaults", () => {
    const s = withCompany(newGame(9));
    until(s, 100);
    const raw = JSON.parse(serialize(s));
    delete raw.marketing;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.marketing).toMatchObject({ owned: [], campaigns: [], reviews: [], platform: null });
    expect(awareness(loaded, "gamer")).toBe(0.05);
    setUpChannel(s, "website");
    expect(deserialize(serialize(s)).marketing.owned).toEqual(["website"]);
  });
});
