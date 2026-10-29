// The player's price per resource unit of a line (Products app). The order form charges a spec at these rates; services
// already sold keep their price (gdd.md, Per-resource pricing).
import { UNITS, type Unit } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// Sets one rate in euros per unit, or back to the market rate with null.
export function setRate(s: GameState, product: Product, unit: Unit, rate: number | null): ActionResult {
  if (!UNITS[product]?.includes(unit)) return { ok: false, error: "error.unknownLineRate" };
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100000)) return { ok: false, error: "error.badRate" };
  const { [unit]: _, ...rest } = s.rates[product] ?? {};
  s.rates = { ...s.rates, [product]: rate === null ? rest : { ...rest, [unit]: Math.round(rate * 10000) / 10000 } };
  return { ok: true };
}

// Every rate of a line back to the market's.
export function resetRates(s: GameState, product: Product): ActionResult {
  const { [product]: _, ...rest } = s.rates;
  s.rates = rest;
  return { ok: true };
}
