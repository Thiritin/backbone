import { t } from "../../i18n/en";
// Values from docs/design/economy.md, "Marketing and reviews"; numbers marked as decisions are recorded there.
import { hashRng, rand, type Rng } from "../00-core/rng";
import { isMonthStart, monthIndexOf, yearOf } from "../00-core/time";
import { priceAt, SEARCH_AD_COST } from "../10-catalog/economy";
import { BADGE_TRUST, TIERS, TRUST_CAP } from "../10-catalog/hosttoast";
import type { Product, Profile } from "../30-customers/customers";
import { profileStats } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import type { CatalogProduct } from "./catalog";
import type { SimEvent } from "../88-tick/tick";
import { campaignBoost, hasMarketingManager, reviewBoost } from "../47-staff/staff";

export const SITE_LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation", "gpu", "ssl"];
import { communityBatches } from "./community";
import { fairBatches, fairGain } from "./fairs";
import { shopBills, shopTick } from "./shop";
import { siteBuiltEvent, siteDownEvent, siteFactor, siteHostingCost, siteStatus } from "./website";

export const PROFILE_IDS: Profile[] = ["private", "gamer", "hobbyDev", "soleProp", "smallBiz", "agency", "office", "onlineShop", "enterprise"];

export type OwnedChannel = "website" | "searchAds" | "aiAds";
// Setup and monthly upkeep in euros; email is always on and free.
export const OWNED: Record<OwnedChannel, { setup: number; upkeep: number; needs: OwnedChannel | null; fromYear: number }> = {
  website: { setup: 400, upkeep: 15, needs: null, fromYear: 2005 },
  searchAds: { setup: 50, upkeep: 0, needs: "website", fromYear: 2005 },
  aiAds: { setup: 1500, upkeep: 0, needs: "website", fromYear: 2023 },
};

export type CampaignChannel = "search" | "ai" | "gaming" | "coldCall" | "agency";
// cost: 2026 euros per lead by profile, scaled back with m = 0.6. conversion multiplies the lead's chance to buy.
export const CAMPAIGNS: Record<CampaignChannel, { cost: Partial<Record<Profile, number>>; conversion: number; needs: OwnedChannel | null; discount: boolean }> = {
  search: { cost: byBudget(1), conversion: 1, needs: "searchAds", discount: false },
  ai: { cost: byBudget(1.5), conversion: 1.3, needs: "aiAds", discount: false },
  gaming: { cost: { gamer: 8 }, conversion: 1, needs: null, discount: false },
  coldCall: { cost: { soleProp: 8, smallBiz: 12, office: 20 }, conversion: 0.35, needs: null, discount: false },
  agency: { cost: { agency: 30 }, conversion: 1, needs: null, discount: true },
};

function byBudget(factor: number): Record<Profile, number> {
  return Object.fromEntries(PROFILE_IDS.map((p) => [p, SEARCH_AD_COST[profileStats(p).budget] * factor])) as Record<Profile, number>;
}

export const BUDGETS = [100, 250, 500, 1000, 2500, 5000];
export const DISCOUNTS = [0, 0.1, 0.2, 0.3];
// Spending more in one channel and city gets dearer: cost per lead × (1 + monthly spend ÷ €5,000).
export const SATURATION = 5000;
// Website requests per month and location city, split by the profile mix.
export const WEBSITE_LEADS = 4;

export type PlatformId = "free" | "provenExpat" | "trustPylon";
// fee: euros per month; invite: share of customers with happiness 60 or more asked for a review each month; trust: bonus T.
// The free listing's T moved to the HOSTtoast listing (competitors.md, HOSTtoast).
export const PLATFORMS: Record<PlatformId, { name: string; fee: number; invite: number; trust: number }> = {
  free: { get name() { return t("sim.platform.free.name"); }, fee: 0, invite: 0, trust: 0 },
  provenExpat: { name: "ProvenExpat", fee: 49, invite: 0.01, trust: 4 },
  trustPylon: { name: "TrustPylon", fee: 199, invite: 0.02, trust: 6 },
};

export type ReviewReason = "ticket" | "cancellation" | "invite" | "outage" | "dataLoss" | "sponsor" | "fast" | "smooth";
export interface Review { hour: number; customerId: string; name: string; stars: number; reason: ReviewReason }
export interface Campaign { channel: CampaignChannel; profiles: Profile[]; budget: number; discount: number }
export interface Marketing {
  owned: OwnedChannel[];
  campaigns: Campaign[];
  awareness: Record<Profile, number>;
  reviews: Review[];
  platform: PlatformId | null;
  // Profiles revealed by a market study.
  studies: Profile[];
  // Product lines listed on the company website.
  lines: Product[];
  // Listed lines that also take requests for packages outside the shop plans.
  custom: Product[];
  // Whether orders still arrive by email.
  emailOrders: boolean;
  // Whether leads write in about products you do not sell yet.
  customRequests: boolean;
  // The hour the hand-written first site is ready, null before the player starts it, and whether it is online.
  siteReady: number | null;
  launched: boolean;
  // Where the company site runs, the generation of its design and whether the current outage has been announced.
  siteHost: SiteHost;
  designYear: number;
  siteOutage: boolean;
  // Leads per line lost because no catalog product fitted, this month and last month.
  unmet: { month: Partial<Record<Product, number>>; last: Partial<Record<Product, number>> };
  // The catalog as last published to the website; leads decide on it. Null until the first publish.
  published: CatalogProduct[] | null;
}
export type SiteHost = { kind: "rented" } | { kind: "own"; clusterId: string };

const AWARENESS_FLOOR = 0.02;
const AWARENESS_DECAY = 0.02;
export const REVIEW_HOURS = 2 * 8760;

// Won orders per line among the leads that arrived this month (ago 0) or last month (ago 1).
export function wonLeads(s: GameState, ago: 0 | 1): Partial<Record<Product, number>> {
  const month = monthIndexOf(s.hour) - ago, won: Partial<Record<Product, number>> = {};
  for (const r of s.sales.requests) if (r.kind === "order" && r.status === "won" && monthIndexOf(r.createdAt) === month) won[r.product] = (won[r.product] ?? 0) + 1;
  return won;
}

export const newMarketing = (): Marketing => ({
  owned: [], campaigns: [], reviews: [], platform: null, studies: [], lines: [], custom: [...SITE_LINES], emailOrders: true, customRequests: true, siteReady: null, launched: false, siteHost: { kind: "rented" }, designYear: 2005, siteOutage: false, unmet: { month: {}, last: {} }, published: null,
  awareness: Object.fromEntries(PROFILE_IDS.map((p) => [p, p === "private" || p === "gamer" ? 0.05 : AWARENESS_FLOOR])) as Record<Profile, number>,
});

export const owns = (s: GameState, c: OwnedChannel): boolean => s.marketing.owned.includes(c);
export const costPerLead = (channel: CampaignChannel, p: Profile, year: number): number => priceAt(CAMPAIGNS[channel].cost[p] ?? 0, 0.6, year);
export const reach = (channel: CampaignChannel): Profile[] => PROFILE_IDS.filter((p) => CAMPAIGNS[channel].cost[p]);
export const awareness = (s: GameState, p: Profile): number => s.marketing.awareness[p];
const marketCities = (s: GameState): string[] => [...new Set(s.locations.map((l) => l.city))];

export interface LeadBatch { profile: Profile; city: string; source: CampaignChannel | "website" | "fair" | "community"; count: number; conversion: number }

// Expected leads this month from the website and running campaigns; organic leads and referrals belong to the market.
export function leadsThisMonth(s: GameState): LeadBatch[] {
  const year = yearOf(s.hour), cities = marketCities(s), out: LeadBatch[] = [];
  if (owns(s, "website")) {
    for (const city of cities) for (const profile of PROFILE_IDS) {
      out.push({ profile, city, source: "website", count: WEBSITE_LEADS * profileStats(profile).mix * siteFactor(s), conversion: 1 });
    }
  }
  const boost = campaignBoost(s);
  for (const c of s.marketing.campaigns) {
    const perCity = c.budget / cities.length, dearer = 1 + perCity / SATURATION;
    for (const city of cities) for (const profile of c.profiles) {
      const count = (boost * perCity) / c.profiles.length / (costPerLead(c.channel, profile, year) * dearer);
      out.push({ profile, city, source: c.channel, count, conversion: CAMPAIGNS[c.channel].conversion });
    }
  }
  out.push(...fairBatches(s, cities), ...communityBatches(s, cities));
  return out;
}

// The discount an agency campaign offers, quoted back when a lead of that profile writes in.
export const discountFor = (s: GameState, p: Profile): number =>
  Math.max(0, ...s.marketing.campaigns.filter((c) => c.profiles.includes(p)).map((c) => c.discount));

// Last 2 years from a prior of 3.5 stars worth 20 reviews.
export function reviewScore(s: GameState): number {
  const recent = s.marketing.reviews.filter((r) => s.hour - r.hour < REVIEW_HOURS);
  return (3.5 * 20 + recent.reduce((n, r) => n + r.stars, 0)) / (20 + recent.length);
}
export const reviewMultiplier = (s: GameState): number => 0.4 + 0.25 * (reviewScore(s) - 1);
// Badges you won last year on HOSTtoast.
export const playerBadges = (s: GameState): number => s.hosttoast.awards.filter((a) => a.id === "you" && a.year === yearOf(s.hour) - 1).length;
export const hosttoastTrust = (s: GameState): number => (s.hosttoast.tier ? TIERS[s.hosttoast.tier].trust + BADGE_TRUST * playerBadges(s) : 0);
export const trustBonus = (s: GameState): number =>
  Math.min(TRUST_CAP, hosttoastTrust(s) + (s.marketing.platform ? PLATFORMS[s.marketing.platform].trust : 0));

export const starsFor = (happiness: number, r: Rng): number => Math.min(5, Math.max(1, Math.round(1 + (4 * happiness) / 100 + rand(r) - 0.5)));

export function addReview(s: GameState, customerId: string, stars: number, reason: ReviewReason = "ticket"): Review | null {
  const c = s.customers.find((x) => x.id === customerId);
  if (!c) return null;
  const review = { hour: s.hour, customerId, name: c.name, stars: Math.min(5, Math.max(1, Math.round(stars))), reason };
  s.marketing.reviews = [...s.marketing.reviews, review];
  return review;
}

// Raises a profile's awareness by a share of the gap to 1; forum posts and fairs call this.
export function addAwareness(s: GameState, p: Profile, amount: number): void {
  const a = s.marketing.awareness[p];
  s.marketing.awareness = { ...s.marketing.awareness, [p]: Math.min(1, a + (1 - a) * amount) };
}

export function monthlyMarketingCost(s: GameState): number {
  const upkeep = s.marketing.owned.reduce((n, c) => n + OWNED[c].upkeep, 0);
  const fee = s.marketing.platform ? PLATFORMS[s.marketing.platform].fee : 0;
  return upkeep + fee + siteHostingCost(s) + s.marketing.campaigns.reduce((n, c) => n + c.budget, 0);
}

// The review always counts; the notification waits for the skill that shows the Reviews section.
export function announceReview(s: GameState, r: Review | null, events: SimEvent[]): void {
  if (r && s.unlocks.includes("marketingBasics")) events.push({ app: "Marketing", key: "event.review", params: { customer: r.name, stars: r.stars } });
}

// 10% of customers write after a closed ticket or a cancellation, 20% below happiness 40.
function rollReviews(s: GameState, events: SimEvent[]): void {
  // The previous hour: the support tick and player actions close tickets after the last scan.
  const from = s.hour - 1, seen = new Set<string>();
  const hit = (id: string, reason: ReviewReason, hour: number) => {
    const i = s.customers.findIndex((c) => c.id === id);
    if (i < 0 || seen.has(id)) return;
    seen.add(id);
    const c = s.customers[i], r = hashRng(s.seed, hour, i, 77);
    if (c.sponsor) return;
    if (rand(r) >= (c.happiness < 40 ? 0.2 : 0.1)) return;
    announceReview(s, addReview(s, id, starsFor(c.happiness, r), reason), events);
  };
  for (const c of s.customers) if (c.churnedAt !== null && c.churnedAt >= from && c.churnedAt < s.hour) hit(c.id, "cancellation", c.churnedAt);
  for (const t of s.tickets) if (t.status === "closed" && t.updatedAt >= from && t.updatedAt < s.hour) hit(t.customerId, "ticket", t.updatedAt);
}

function updateAwareness(s: GameState): void {
  const paid = Object.fromEntries(PROFILE_IDS.map((p) => [p, 0])) as Record<Profile, number>;
  for (const b of leadsThisMonth(s)) if (b.source !== "website" && b.source !== "fair" && b.source !== "community") paid[b.profile] += b.count;
  const reviews = 0.006 * (reviewScore(s) - 3.5) + 0.001 * trustBonus(s);
  const site = (owns(s, "website") && siteStatus(s) !== "down" ? 0.004 : 0) + (s.hosttoast.tier ? TIERS[s.hosttoast.tier].awareness : 0);
  const next = { ...s.marketing.awareness };
  for (const p of PROFILE_IDS) {
    const happy = s.customers.filter((c) => c.profile === p && c.churnedAt === null && c.happiness >= 70).length;
    const gain = 0.05 * (1 - Math.exp(-paid[p] / 100)) + site + reviews + Math.min(0.01, 0.0005 * happy) + fairGain(s, p);
    const a = next[p];
    next[p] = Math.min(1, Math.max(AWARENESS_FLOOR, a + (1 - a) * gain - AWARENESS_DECAY * a));
  }
  s.marketing.awareness = next;
}

function bill(s: GameState): number {
  const entry = (key: string, params: LedgerEntry["params"], amount: number): LedgerEntry => ({ hour: s.hour, category: "marketing", key, params, amount: -amount });
  const bills: LedgerEntry[] = [
    ...s.marketing.owned.filter((c) => OWNED[c].upkeep > 0).map((c) => entry("ledger.marketingUpkeep", { channel: c }, OWNED[c].upkeep)),
    ...s.marketing.campaigns.map((c) => entry("ledger.marketingCampaign", { channel: c.channel }, c.budget)),
  ];
  const platform = s.marketing.platform && PLATFORMS[s.marketing.platform];
  if (platform && platform.fee > 0) bills.push(entry("ledger.reviewPlatform", { name: platform.name }, platform.fee));
  if (siteHostingCost(s) > 0) bills.push(entry("ledger.siteHosting", {}, siteHostingCost(s)));
  bills.push(...shopBills(s).map((b) => entry(b.key, b.params, b.amount)));
  const total = bills.reduce((n, b) => n - b.amount, 0);
  s.cash = Math.round((s.cash - total) * 100) / 100;
  s.ledger = [...s.ledger, ...bills];
  return total;
}

function invite(s: GameState, events: SimEvent[]): void {
  const rate = (s.marketing.platform ? PLATFORMS[s.marketing.platform].invite : 0) * reviewBoost(s);
  if (!rate) return;
  s.customers.forEach((c, i) => {
    if (c.churnedAt !== null || c.happiness < 60) return;
    const r = hashRng(s.seed, s.hour, i, 78);
    if (rand(r) >= rate) return;
    announceReview(s, addReview(s, c.id, starsFor(c.happiness, r), "invite"), events);
  });
}

export function marketingTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  rollReviews(s, events);
  siteBuiltEvent(s, events);
  siteDownEvent(s, events);
  shopTick(s, events);
  if (!isMonthStart(s.hour)) return events;
  if (s.marketing.platform && PLATFORMS[s.marketing.platform].fee > 0 && !hasMarketingManager(s)) {
    events.push({ app: "Marketing", key: "event.platformDropped", params: { name: PLATFORMS[s.marketing.platform].name } });
    s.marketing = { ...s.marketing, platform: "free" };
  }
  const total = bill(s);
  s.shop = { ...s.shop, soldOut: {} };
  s.marketing = { ...s.marketing, unmet: { month: {}, last: s.marketing.unmet.month } };
  if (total > 0) events.push({ app: "Marketing", key: "event.marketingBills", params: { total } });
  invite(s, events);
  updateAwareness(s);
  s.marketing.reviews = s.marketing.reviews.filter((r) => s.hour - r.hour < REVIEW_HOURS);
  return events;
}
