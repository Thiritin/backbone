// Billing cycles of form orders: which cycle a customer picks, what it costs and how it moves lead conversion.
import { CYCLE_MONTHS, CYCLE_SHARE, CYCLE_STEEPNESS, CYCLES, MARKET_DISCOUNT, type Cycle } from "../10-catalog/cycles";
import { yearOf } from "../00-core/time";
import { marketPrice, PRODUCTS, SIZES, sizeSpec } from "../10-catalog/products";
import { shopById } from "../10-catalog/shops";
import type { Product, Profile, Service } from "../30-customers/customers";
import type { InvoiceLine } from "../45-billing/billing";
import type { SalesRequest } from "./market";
import type { GameState } from "../50-state";
import { offerPrice } from "./spec";

export const HOURS_PER_MONTH = 730;

// The player's discount for a cycle off N times the monthly price.
export const discountOf = (s: GameState, c: Cycle): number => s.shop.optionDiscount?.[c] ?? MARKET_DISCOUNT[c];

// Cycles the active shop sells for the line; domains and certificates are always annual.
export const cyclesFor = (s: GameState, product: Product): Cycle[] =>
  PRODUCTS[product].period === "year" || !s.shop.variant ? ["monthly"] : shopById(s.shop.variant).cycles;

// Draw weights over the offered cycles: the base share, moved by how far the discount sits from the market's.
export function cycleWeights(s: GameState, profile: Profile, offered: Cycle[]): [Cycle, number][] {
  const raw = offered.map((c): [Cycle, number] => [c, CYCLE_SHARE[profile][CYCLES.indexOf(c)] * (c === "monthly" ? 1 : Math.exp(CYCLE_STEEPNESS * (discountOf(s, c) - MARKET_DISCOUNT[c])))]);
  const sum = raw.reduce((n, [, w]) => n + w, 0);
  return sum > 0 ? raw.map(([c, w]) => [c, w / sum]) : [["monthly", 1]];
}

export function drawCycle(s: GameState, profile: Profile, product: Product, roll: number, offered = cyclesFor(s, product)): Cycle {
  let left = roll;
  const weights = cycleWeights(s, profile, offered);
  for (const [c, w] of weights) if ((left -= w) < 0) return c;
  return weights[weights.length - 1][0];
}

// Total price of one term of a monthly price.
export const termPrice = (s: GameState, monthly: number, c: Cycle): number => Math.round(monthly * CYCLE_MONTHS[c] * (1 - discountOf(s, c)) * 100) / 100;

// The advertised price level of a line against the market, replacing the sold-services index in lead conversion: the
// line's rate against the market for its middle size, moved by the discount the offered cycles give relative to the market's.
export function shopPriceLevel(s: GameState, profile: Profile, product: Product): number {
  const year = yearOf(s.hour), spec = sizeSpec(product, Math.floor((SIZES[product].length - 1) / 2), year), market = marketPrice(product, spec, year);
  const rate = market > 0 ? offerPrice(s, product, spec) / market : 1;
  const w = cycleWeights(s, profile, cyclesFor(s, product));
  const mine = w.reduce((n, [c, x]) => n + x * (1 - discountOf(s, c)), 0), ref = w.reduce((n, [c, x]) => n + x * (1 - MARKET_DISCOUNT[c]), 0);
  return rate * (mine / ref);
}

// The invoice line for a form order's first term: the first month, or the whole prepaid term of a longer cycle.
export function termLine(r: Pick<SalesRequest, "cycle" | "quote">, label: string): InvoiceLine {
  if (!r.cycle) return { serviceId: null, key: "invoice.line.firstMonth", params: { label }, amount: r.quote! };
  const months = CYCLE_MONTHS[r.cycle];
  return { serviceId: null, key: "invoice.line.firstTerm", params: { label, months }, amount: Math.round(r.quote! * months * 100) / 100 };
}

// A new service paid up front: the first month runs through the monthly arrears skip, a longer cycle also commits the customer.
export function startTerm(s: GameState, v: Service, cycle?: Cycle): Service {
  const months = cycle ? CYCLE_MONTHS[cycle] : 1, end = s.hour + HOURS_PER_MONTH * months;
  return { ...v, prepaidUntil: end, ...(cycle && { cycle, termEnd: end, commitMonths: months }) };
}
