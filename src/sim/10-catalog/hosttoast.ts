// HOSTtoast, the hosting portal (competitors.md, HOSTtoast).
import type { Template } from "./economy";

export const HOSTTOAST = "HOSTtoast", HOSTTOAST_HOST = "hosttoast.de";

export type TierId = "registered" | "verified" | "premium" | "diamond";
export const TIER_IDS: TierId[] = ["registered", "verified", "premium", "diamond"];
// fee: euros a month; months: company age; uptime: 90-day minimum; answer: hours to answer the test ticket;
// trust: bonus T; awareness: added each month; rivalR: the R a rival needs to answer the test ticket in time.
export const TIERS: Record<TierId, { fee: number; months: number; uptime: number; answer: number | null; trust: number; awareness: number; rivalR: number }> = {
  registered: { fee: 0, months: 0, uptime: 0, answer: null, trust: 2, awareness: 0.001, rivalR: 0 },
  verified: { fee: 29, months: 6, uptime: 0.99, answer: null, trust: 3, awareness: 0.002, rivalR: 0 },
  premium: { fee: 99, months: 12, uptime: 0.99, answer: 48, trust: 5, awareness: 0.004, rivalR: 60 },
  diamond: { fee: 299, months: 24, uptime: 0.995, answer: 24, trust: 7, awareness: 0.007, rivalR: 85 },
};
// HOSTtoast and the paid review platforms together; a badge adds BADGE_TRUST for the following year.
export const TRUST_CAP = 10, BADGE_TRUST = 1, AWARD_REVIEWS = 30;
// A rival buys a tier when its yearly revenue estimate is over REVENUE_TIMES its yearly fee.
export const REVENUE_TIMES = 50;
export const AWARD_PRODUCTS = ["webHosting", "vps", "gameServer"] as const;
export type AwardProduct = (typeof AWARD_PRODUCTS)[number];
// "you" is the player.
export interface Award { year: number; kind: "host" | "uptime"; product: AwardProduct | null; id: string }

// The player's listing: tier (null before signing up), uptime of the last 12 months, the open test ticket and every award.
export interface HostToast { tier: TierId | null; uptime: number[]; audit: string | null; awards: Award[] }
export const newHostToast = (): HostToast => ({ tier: null, uptime: [], audit: null, awards: [] });

export const lower = (tier: TierId): TierId => TIER_IDS[Math.max(0, TIER_IDS.indexOf(tier) - 1)];
// The majors' 2005 scores were set with their 2005 listing (Diamond for Rackspice, Premium for the rest) and their 2004
// uptime seal, so a rival's T counts from its template's 2005 listing.
export const rivalTrust = (r: { template: Template; tier?: TierId; badges?: number }): number => {
  if (!r.tier) return 0;
  const from = TIERS[r.template === "premium" ? "diamond" : "premium"].trust + BADGE_TRUST;
  return TIERS[r.tier].trust + (r.badges ?? 0) * BADGE_TRUST - from;
};
