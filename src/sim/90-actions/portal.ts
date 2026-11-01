// Product groups, products and cycle discounts of the shop portal (docs/design/shop.md).
import { yearOf } from "../00-core/time";
import { CYCLE_MONTHS, CYCLES, MARKET_DISCOUNT, type Cycle } from "../10-catalog/cycles";
import { marketPrice, marketSetup, sizeSpec } from "../10-catalog/products";
import { shopById } from "../10-catalog/shops";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { SITE_LINES } from "../80-business/website";
import type { ProductGroup, ShopProduct } from "../80-business/shop";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const NAME_MAX = 40;
const cleanName = (name: string): string => name.trim().slice(0, NAME_MAX);

// Every portal action needs an active shop variant.
const variantOf = (s: GameState) => (s.shop.variant ? shopById(s.shop.variant) : null);
const setGroups = (s: GameState, productGroups: ProductGroup[]) => void (s.shop = { ...s.shop, productGroups });
const setProducts = (s: GameState, products: ShopProduct[]) => void (s.shop = { ...s.shop, products });

export function createProductGroup(s: GameState, name: string): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  const n = cleanName(name);
  if (!n) return fail("error.badProductName");
  const id = `pg${s.nextId++}`;
  setGroups(s, [...s.shop.productGroups, { id, name: n, hidden: false }]);
  return { ok: true, id };
}

export function renameProductGroup(s: GameState, id: string, name: string): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  if (!s.shop.productGroups.some((g) => g.id === id)) return fail("error.unknownProductGroup");
  const n = cleanName(name);
  if (!n) return fail("error.badProductName");
  setGroups(s, s.shop.productGroups.map((g) => (g.id === id ? { ...g, name: n } : g)));
  return { ok: true };
}

export function setProductGroupHidden(s: GameState, id: string, hidden: boolean): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  if (!s.shop.productGroups.some((g) => g.id === id)) return fail("error.unknownProductGroup");
  setGroups(s, s.shop.productGroups.map((g) => (g.id === id ? { ...g, hidden } : g)));
  return { ok: true };
}

export function deleteProductGroup(s: GameState, id: string): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  if (!s.shop.productGroups.some((g) => g.id === id)) return fail("error.unknownProductGroup");
  if (s.shop.products.some((p) => p.groupId === id)) return fail("error.groupHasProducts");
  setGroups(s, s.shop.productGroups.filter((g) => g.id !== id));
  return { ok: true };
}

// A new product: the line's smallest size at market prices for every cycle the shop sells, and the market's setup fee.
export function createProduct(s: GameState, groupId: string, name: string, line: Product): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!s.shop.productGroups.some((g) => g.id === groupId)) return fail("error.unknownProductGroup");
  if (!SITE_LINES.includes(line)) return fail("error.unknownProduct");
  const n = cleanName(name);
  if (!n) return fail("error.badProductName");
  const year = yearOf(s.hour), spec = sizeSpec(line, 0, year), monthly = marketPrice(line, spec, year);
  const cycles = line === "ssl" ? (["monthly"] as Cycle[]) : v.cycles;
  const prices = Object.fromEntries(cycles.map((c) => [c, Math.round(monthly * CYCLE_MONTHS[c] * (1 - MARKET_DISCOUNT[c]) * 100) / 100]));
  const id = `prod${s.nextId++}`;
  setProducts(s, [...s.shop.products, { id, groupId, name: n, line, serverGroupId: null, packageName: null, spec, prices, setup: marketSetup(line, year), stock: v.autoStock ? "auto" : 10, hidden: false, setupMode: "payment" }]);
  return { ok: true, id };
}

export type ProductPatch = Partial<Pick<ShopProduct, "name" | "groupId" | "serverGroupId" | "packageName" | "spec" | "setup" | "stock" | "hidden" | "setupMode" | "title" | "slots">>;

export function updateProduct(s: GameState, id: string, patch: ProductPatch): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!s.shop.products.some((p) => p.id === id)) return fail("error.unknownProduct");
  const next: ProductPatch = { ...patch };
  if (patch.name !== undefined && !(next.name = cleanName(patch.name))) return fail("error.badProductName");
  if (patch.groupId !== undefined && !s.shop.productGroups.some((g) => g.id === patch.groupId)) return fail("error.unknownProductGroup");
  if (patch.serverGroupId && !s.shop.groups.some((g) => g.id === patch.serverGroupId)) return fail("error.unknownServerGroup");
  if (patch.setup !== undefined && !(Number.isFinite(patch.setup) && patch.setup >= 0 && patch.setup <= 100000)) return fail("error.badProductPrice");
  if (patch.stock !== undefined) {
    if (patch.stock === "auto" && !v.autoStock) return fail("error.noAutoStock");
    if (typeof patch.stock === "number" && !(Number.isInteger(patch.stock) && patch.stock >= 0)) return fail("error.badStock");
  }
  if (patch.packageName !== undefined && patch.packageName !== null) next.packageName = patch.packageName.trim() || null;
  setProducts(s, s.shop.products.map((p) => (p.id === id ? { ...p, ...next } : p)));
  return { ok: true };
}

// The total price of one term; null stops offering the cycle.
export function setProductPrice(s: GameState, id: string, cycle: Cycle, price: number | null): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  const p = s.shop.products.find((x) => x.id === id);
  if (!p) return fail("error.unknownProduct");
  if (!CYCLES.includes(cycle) || !v.cycles.includes(cycle)) return fail("error.cycleNotSupported");
  if (price !== null && !(Number.isFinite(price) && price >= 0 && price <= 100000)) return fail("error.badProductPrice");
  const { [cycle]: _, ...rest } = p.prices;
  setProducts(s, s.shop.products.map((x) => (x.id === id ? { ...x, prices: price === null ? rest : { ...rest, [cycle]: Math.round(price * 100) / 100 } } : x)));
  return { ok: true };
}

export function deleteProduct(s: GameState, id: string): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  if (!s.shop.products.some((p) => p.id === id)) return fail("error.unknownProduct");
  setProducts(s, s.shop.products.filter((p) => p.id !== id));
  return { ok: true };
}

// The discount off N times the monthly price for a cycle of lines sold through configurable options; null returns to the market's.
export function setOptionDiscount(s: GameState, cycle: Cycle, discount: number | null): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!v.cycles.includes(cycle)) return fail("error.cycleNotSupported");
  if (discount !== null && !(Number.isFinite(discount) && discount >= 0 && discount <= 0.5)) return fail("error.badDiscount");
  const { [cycle]: _, ...rest } = s.shop.optionDiscount;
  s.shop = { ...s.shop, optionDiscount: discount === null ? rest : { ...rest, [cycle]: Math.round(discount * 1000) / 1000 } };
  return { ok: true };
}
