// Books > Products: the catalog email orders and leads choose from (docs/design/plans/product-catalog.md, 3.2).
import { yearOf } from "../00-core/time";
import { CYCLES } from "../10-catalog/cycles";
import type { Product } from "../30-customers/customers";
import { offerPrice, setupFee } from "../30-market/spec";
import { PRODUCT_NAME_MAX, productNamed, type CatalogProduct } from "../80-business/catalog";
import { defaultSpecFor } from "../80-business/packages";
import type { GameState } from "../50-state";
import { t } from "../../i18n/en";
import type { ActionResult } from "./hardware";

export type ProductPatch = Partial<Pick<CatalogProduct, "name" | "spec" | "sla" | "prices" | "setup" | "hidden">>;

const fail = (error: string): ActionResult => ({ ok: false, error });

function invalid(s: GameState, p: CatalogProduct): string | null {
  const name = p.name.trim(), prices = Object.entries(p.prices);
  if (name.length < 1 || name.length > PRODUCT_NAME_MAX) return "error.productName";
  const other = productNamed(s, p.line, name);
  if (other && other.id !== p.id) return "error.productTaken";
  if (prices.length === 0 || prices.some(([c, v]) => !CYCLES.includes(c as never) || !Number.isFinite(v) || v! <= 0)) return "error.productPrice";
  if (!Number.isFinite(p.setup) || p.setup < 0) return "error.productPrice";
  return null;
}

// A product of the line at its middle size, the player's rate as the monthly price and the line's setup fee.
export function addProduct(s: GameState, line: Product): ActionResult {
  const label = t(`sim.line.${line}`);
  let n = 1;
  while (productNamed(s, line, `${label} ${n}`)) n++;
  const spec = defaultSpecFor(line, yearOf(s.hour));
  const p: CatalogProduct = {
    id: `prd${s.nextId++}`, name: `${label} ${n}`, line, spec, sla: "basic",
    prices: { monthly: offerPrice(s, line, spec) }, setup: setupFee(s, line), hidden: false,
  };
  s.catalog = [...s.catalog, p];
  return { ok: true, id: p.id };
}

export function updateProduct(s: GameState, id: string, patch: ProductPatch): ActionResult {
  const p = s.catalog.find((x) => x.id === id);
  if (!p) return fail("error.productMissing");
  const next = { ...p, ...patch, id: p.id, line: p.line };
  const error = invalid(s, next);
  if (error) return fail(error);
  Object.assign(p, next, { name: next.name.trim() });
  return { ok: true, id };
}

export function removeProduct(s: GameState, id: string): ActionResult {
  if (!s.catalog.some((x) => x.id === id)) return fail("error.productMissing");
  s.catalog = s.catalog.filter((x) => x.id !== id);
  return { ok: true, id };
}
