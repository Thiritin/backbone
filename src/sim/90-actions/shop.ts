// Choosing a shop system, buying its modules and setting stock (docs/design/shop.md).
import { yearOf } from "../00-core/time";
import { CUSTOM_SCRIPT, MODULE_IDS, SHOP_SETUP_HOURS, shopById, SHOPS, type ShopId } from "../10-catalog/shops";
import { PRODUCTS } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { owns } from "../80-business/marketing";
import { hasModule, newShop, type Stock } from "../80-business/shop";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function pay(s: GameState, amount: number, key: string, params: Record<string, string | number>): void {
  if (amount <= 0) return;
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key, params, amount: -amount }];
}

// Replaces the hand-rolled form or the current shop; the new one takes orders after its setup days.
export function chooseShop(s: GameState, id: ShopId, own = false): ActionResult {
  const v = SHOPS.find((x) => x.id === id), year = yearOf(s.hour);
  if (!v) return fail("error.unknownShop");
  if (!s.unlocks.includes("shops")) return fail("error.needsShopSkill");
  if (!owns(s, "website")) return fail("error.needsWebsite");
  if (s.shop.variant === id) return fail("error.shopInUse");
  if (year < v.from || (v.until !== undefined && year > v.until)) return fail("error.shopNotSold");
  if (own && !v.own) return fail("error.shopNoOwn");
  const price = own && v.own ? v.own.price : v.setup;
  if (s.cash < price) return fail("error.noCash");
  pay(s, price, "ledger.shopSetup", { name: v.name });
  s.marketing = { ...s.marketing, owned: s.marketing.owned.filter((c) => c !== "orderForm") };
  s.shop = { ...newShop(), variant: id, owned: own, since: s.hour, readyAt: s.hour + SHOP_SETUP_HOURS };
  return { ok: true, id };
}

// A module for the shop, or a custom script for the hand-rolled form.
export function buyModule(s: GameState, module: string): ActionResult {
  if (!MODULE_IDS.includes(module)) return fail("error.unknownModule");
  if (hasModule(s, module) || s.shop.modules[module] !== undefined) return fail("error.moduleOwned");
  const v = s.shop.variant && shopById(s.shop.variant);
  if (!v && !owns(s, "orderForm")) return fail("error.needsOrderForm");
  if (v && v.extra === null) return fail("error.moduleNotSold");
  const price = v ? v.extra! : CUSTOM_SCRIPT;
  if (s.cash < price) return fail("error.noCash");
  pay(s, price, "ledger.shopModule", { module });
  s.shop = { ...s.shop, modules: { ...s.shop.modules, [module]: s.hour + (v?.extraHours ?? 0) } };
  return { ok: true, id: module };
}

export function setStock(s: GameState, product: Product, stock: Stock): ActionResult {
  const v = s.shop.variant && shopById(s.shop.variant);
  if (!v) return fail("error.needsShop");
  if (!PRODUCTS[product]) return fail("error.unknownProduct");
  if (stock === "auto" && !v.autoStock) return fail("error.noAutoStock");
  if (typeof stock === "number" && !(Number.isInteger(stock) && stock >= 0)) return fail("error.badStock");
  s.shop = { ...s.shop, stock: { ...s.shop.stock, [product]: stock } };
  return { ok: true };
}
