// The products the player sells (docs/design/plans/product-catalog.md): fixed packages edited in Books until a shop is chosen.
import type { Cycle } from "../10-catalog/cycles";
import type { Sla, Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";

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
