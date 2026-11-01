// The products the player sells (docs/design/plans/product-catalog.md): fixed packages edited in Books until a shop is chosen.
import { CYCLE_MONTHS, CYCLES, type Cycle } from "../10-catalog/cycles";
import { SLAS, type Sla, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { covers, monthlyOf } from "./portal";

export interface CatalogProduct {
  id: string;
  // Unique per line, compared case-insensitively.
  name: string;
  line: Product;
  spec: Spec;
  sla: Sla;
  // Total of one term; absent means the cycle is not offered.
  prices: Partial<Record<Cycle, number>>;
  setup: number;
  hidden: boolean;
}

export const PRODUCT_NAME_MAX = 24;

export const productsOf = (s: GameState, line: Product): CatalogProduct[] => s.catalog.filter((p) => p.line === line);
export const productNamed = (s: GameState, line: Product, name: string): CatalogProduct | undefined =>
  productsOf(s, line).find((p) => p.name.toLowerCase() === name.trim().toLowerCase());

// What email orders and leads choose from: the line's visible products with a price.
export const offeredProducts = (s: GameState, line: Product): CatalogProduct[] =>
  productsOf(s, line).filter((p) => !p.hidden && Object.keys(p.prices).length > 0);

export const productCyclesOf = (p: CatalogProduct): Cycle[] => CYCLES.filter((c) => p.prices[c] !== undefined);

// The cheapest offered product that covers the spec, meets the SLA and costs at most limit a month.
export function fittingProduct(s: GameState, line: Product, spec: Spec, sla: Sla, limit: number): CatalogProduct | undefined {
  return offeredProducts(s, line)
    .filter((p) => covers(p.spec, spec, line) && SLAS[p.sla].uptime >= SLAS[sla].uptime && monthlyOf(p) <= limit)
    .sort((a, b) => monthlyOf(a) - monthlyOf(b))[0];
}

// The product an email order names while it is still offered.
export const orderProduct = (s: GameState, r: { product: Product; productId?: string; shop?: boolean }): CatalogProduct | undefined =>
  r.productId && !r.shop ? offeredProducts(s, r.product).find((p) => p.id === r.productId) : undefined;

// A month of the product on the cycle, rounded to the cent; the cheapest cycle's month where the product lacks it.
export const productMonthly = (p: CatalogProduct, cycle: Cycle = "monthly"): number =>
  Math.round((p.prices[cycle] !== undefined ? p.prices[cycle]! / CYCLE_MONTHS[cycle] : monthlyOf(p)) * 100) / 100;
