// Product groups, products and cycle discounts of the shop portal (docs/design/shop.md).
import { yearOf } from "../00-core/time";
import { CYCLES, type Cycle } from "../10-catalog/cycles";
import { marketPrice, marketSetup, sizeSpec } from "../10-catalog/products";
import { shopById } from "../10-catalog/shops";
import type { Product } from "../30-customers/customers";
import { termPrice } from "../30-market/cycles";
import type { GameState } from "../50-state";
import { SITE_LINES } from "../80-business/website";
import { groupKind, groupProvisions, type ProductGroup, type ShopProduct } from "../80-business/shop";
import { SERVES } from "../10-catalog/platforms";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const NAME_MAX = 40;
const cleanName = (name: string): string => name.trim().slice(0, NAME_MAX);

// Every portal action needs an active shop variant.
const variantOf = (s: GameState) => (s.shop.variant ? shopById(s.shop.variant) : null);
const setGroups = (s: GameState, productGroups: ProductGroup[]) => void (s.shop = { ...s.shop, productGroups });
const setProducts = (s: GameState, products: ShopProduct[]) => void (s.shop = { ...s.shop, products });

// Offered cycles of an autoCycles product priced from its monthly price; without one the product falls back to manual.
function repriced(s: GameState, p: ShopProduct): ShopProduct {
  const monthly = p.prices.monthly;
  if (!p.autoCycles) return p;
  if (monthly === undefined) return { ...p, autoCycles: false };
  return { ...p, prices: Object.fromEntries(Object.keys(p.prices).map((c) => [c, c === "monthly" ? monthly : termPrice(s, monthly, c as Cycle)])) };
}

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

// A new product: the line's smallest size at the market's monthly price for every cycle the shop sells, the market's setup
// fee, and the first server group whose software serves the line.
export function createProduct(s: GameState, groupId: string, name: string, line: Product): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!s.shop.productGroups.some((g) => g.id === groupId)) return fail("error.unknownProductGroup");
  if (!SITE_LINES.includes(line)) return fail("error.unknownProduct");
  const n = cleanName(name);
  if (!n) return fail("error.badProductName");
  const year = yearOf(s.hour), spec = sizeSpec(line, 0, year), monthly = marketPrice(line, spec, year);
  const cycles = line === "ssl" ? (["monthly"] as Cycle[]) : v.cycles;
  const prices = Object.fromEntries(cycles.map((c) => [c, termPrice(s, monthly, c)]));
  const id = `prod${s.nextId++}`, serverGroupId = s.shop.groups.find((g) => { const k = groupKind(s, g); return !!k && SERVES[k].includes(line) && groupProvisions(s, g); })?.id ?? null;
  setProducts(s, [...s.shop.products, { id, groupId, name: n, line, serverGroupId, packageName: null, spec, prices, autoCycles: true, setup: marketSetup(line, year), stock: v.autoStock ? "auto" : 10, hidden: false, setupMode: "payment" }]);
  return { ok: true, id };
}

export type ProductPatch = Partial<Pick<ShopProduct, "name" | "groupId" | "serverGroupId" | "packageName" | "spec" | "setup" | "stock" | "hidden" | "setupMode" | "title" | "slots" | "autoCycles">>;

export function updateProduct(s: GameState, id: string, patch: ProductPatch): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!s.shop.products.some((p) => p.id === id)) return fail("error.unknownProduct");
  const next: ProductPatch = { ...patch };
  if (patch.name !== undefined && !(next.name = cleanName(patch.name))) return fail("error.badProductName");
  if (patch.groupId !== undefined && !s.shop.productGroups.some((g) => g.id === patch.groupId)) return fail("error.unknownProductGroup");
  const group = patch.serverGroupId ? s.shop.groups.find((g) => g.id === patch.serverGroupId) : undefined;
  if (patch.serverGroupId && !group) return fail("error.unknownServerGroup");
  if (group && !groupProvisions(s, group)) return fail("error.noShopModule");
  if (patch.setup !== undefined && !(Number.isFinite(patch.setup) && patch.setup >= 0 && patch.setup <= 100000)) return fail("error.badProductPrice");
  if (patch.stock !== undefined) {
    if (patch.stock === "auto" && !v.autoStock) return fail("error.noAutoStock");
    if (typeof patch.stock === "number" && !(Number.isInteger(patch.stock) && patch.stock >= 0)) return fail("error.badStock");
  }
  if (patch.autoCycles && s.shop.products.find((p) => p.id === id)!.prices.monthly === undefined) return fail("error.needsMonthlyPrice");
  if (patch.packageName !== undefined && patch.packageName !== null) next.packageName = patch.packageName.trim() || null;
  setProducts(s, s.shop.products.map((p) => (p.id === id ? repriced(s, { ...p, ...next }) : p)));
  return { ok: true };
}

// The total price of one term; null stops offering the cycle. An autoCycles product prices any cycle but the monthly one itself.
export function setProductPrice(s: GameState, id: string, cycle: Cycle, price: number | null): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  const p = s.shop.products.find((x) => x.id === id);
  if (!p) return fail("error.unknownProduct");
  if (!CYCLES.includes(cycle) || !v.cycles.includes(cycle)) return fail("error.cycleNotSupported");
  if (price !== null && !(Number.isFinite(price) && price >= 0 && price <= 100000)) return fail("error.badProductPrice");
  const { [cycle]: _, ...rest } = p.prices;
  setProducts(s, s.shop.products.map((x) => (x.id === id ? repriced(s, { ...x, prices: price === null ? rest : { ...rest, [cycle]: Math.round(price * 100) / 100 } }) : x)));
  return { ok: true };
}

export function deleteProduct(s: GameState, id: string): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  if (!s.shop.products.some((p) => p.id === id)) return fail("error.unknownProduct");
  setProducts(s, s.shop.products.filter((p) => p.id !== id));
  return { ok: true };
}

// The discount off N times the monthly price for a cycle; it reprices every autoCycles product. null returns to none.
export function setOptionDiscount(s: GameState, cycle: Cycle, discount: number | null): ActionResult {
  const v = variantOf(s);
  if (!v) return fail("error.needsShop");
  if (!v.cycles.includes(cycle)) return fail("error.cycleNotSupported");
  if (discount !== null && !(Number.isFinite(discount) && discount >= 0 && discount <= 0.5)) return fail("error.badDiscount");
  const { [cycle]: _, ...rest } = s.shop.optionDiscount;
  s.shop = { ...s.shop, optionDiscount: discount === null ? rest : { ...rest, [cycle]: Math.round(discount * 1000) / 1000 } };
  setProducts(s, s.shop.products.map((p) => repriced(s, p)));
  return { ok: true };
}

// Finishing or closing the setup wizard keeps what it set; the shop's settings open it again.
export function finishShopSetup(s: GameState): ActionResult {
  if (!variantOf(s)) return fail("error.needsShop");
  s.shop = { ...s.shop, setupDone: true };
  return { ok: true };
}
