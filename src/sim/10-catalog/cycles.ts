// Billing cycles a shop sells (docs/design/economy.md, Billing cycles).
import type { Profile } from "../30-customers/customers";

export type Cycle = "monthly" | "quarterly" | "annual" | "biennial";
export const CYCLES: Cycle[] = ["monthly", "quarterly", "annual", "biennial"];
export const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, annual: 12, biennial: 24 };
// Market discount off N times the monthly price. A cycle priced at these discounts is "near the market".
export const MARKET_DISCOUNT: Record<Cycle, number> = { monthly: 0, quarterly: 0.03, annual: 0.1, biennial: 0.15 };
// How strongly a discount away from the market's moves a cycle's share: weight x exp(STEEPNESS * (discount - market)).
export const CYCLE_STEEPNESS = 8;

// Base shares by profile at the market discount, monthly / quarterly / annual / biennial.
export const CYCLE_SHARE: Record<Profile, [number, number, number, number]> = {
  private: [0.78, 0.1, 0.11, 0.01],
  gamer: [0.9, 0.07, 0.03, 0],
  hobbyDev: [0.7, 0.12, 0.17, 0.01],
  soleProp: [0.55, 0.15, 0.28, 0.02],
  smallBiz: [0.42, 0.15, 0.38, 0.05],
  agency: [0.3, 0.15, 0.47, 0.08],
  office: [0.25, 0.12, 0.5, 0.13],
  onlineShop: [0.38, 0.15, 0.42, 0.05],
  enterprise: [0.2, 0.1, 0.5, 0.2],
  reseller: [0.3, 0.15, 0.47, 0.08],
};
