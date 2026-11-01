// Billing cycles a shop sells (docs/design/economy.md, Billing cycles).
import type { Profile } from "../30-customers/customers";

export type Cycle = "monthly" | "quarterly" | "semiannual" | "annual" | "biennial" | "triennial";
export const CYCLES: Cycle[] = ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"];
export const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, biennial: 24, triennial: 36 };
// Market discount off N times the monthly price. A cycle priced at these discounts is "near the market".
export const MARKET_DISCOUNT: Record<Cycle, number> = { monthly: 0, quarterly: 0.03, semiannual: 0.06, annual: 0.1, biennial: 0.15, triennial: 0.2 };
// How strongly a discount away from the market's moves a cycle's share: weight x exp(STEEPNESS * (discount - market)).
export const CYCLE_STEEPNESS = 8;

// Four-cycle shares by profile at the market discount: monthly, quarterly, annual, biennial.
const BASE_SHARE: Record<Profile, [number, number, number, number]> = {
  private: [0.78, 0.1, 0.11, 0.01],
  gamer: [0.9, 0.07, 0.03, 0],
  hobbyDev: [0.7, 0.12, 0.17, 0.01],
  soleProp: [0.55, 0.15, 0.28, 0.02],
  smallBiz: [0.42, 0.15, 0.38, 0.05],
  agency: [0.3, 0.15, 0.47, 0.08],
  office: [0.25, 0.12, 0.5, 0.13],
  onlineShop: [0.38, 0.15, 0.42, 0.05],
  enterprise: [0.2, 0.1, 0.5, 0.2],
};

// Shares in CYCLES order. Semi-annual and triennial add a quarter of the annual and a fifth of the biennial share on top;
// weights are normalised over the cycles a shop offers.
export const CYCLE_SHARE = Object.fromEntries(
  Object.entries(BASE_SHARE).map(([k, [m, q, a, b]]) => [k, [m, q, a * 0.25, a, b, b * 0.2]]),
) as Record<Profile, [number, number, number, number, number, number]>;
