// A rival's price list for its website: one row per size of each hosting product it sells, at this year's market price.
import { yearOf } from "../00-core/time";
import { marketPrice, SIZES, sizeSpec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { openRivals } from "./market";
import { specText } from "./spec";

export interface OfferRow { product: Product; spec: string; price: number }

// Prices are monthly; colocation is rented at the data centers and left out. A closed or unknown rival has no rows.
export function rivalOffer(s: GameState, rivalId: string): OfferRow[] {
  const r = openRivals(s).find((x) => x.id === rivalId), year = yearOf(s.hour);
  if (!r) return [];
  return r.sells.filter((p) => p !== "colocation").flatMap((product) =>
    SIZES[product].map((_, i) => {
      const spec = sizeSpec(product, i, year);
      return { product, spec: specText(product, spec), price: marketPrice(product, spec, year) * r.priceFactor };
    }));
}
