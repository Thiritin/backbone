// Choosing a shop system, buying its modules and setting stock (docs/design/shop.md).
import { yearOf } from "../00-core/time";
import { MODULE_IDS, SHOP_SETUP_HOURS, shopById, SHOPS, type ShopId } from "../10-catalog/shops";
import { PRODUCTS } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { owns } from "../80-business/marketing";
import { groupOf, hasModule, newShop, type ServerGroup, type Stock } from "../80-business/shop";
import { SERVES, type SoftwareKind } from "../10-catalog/platforms";
import { t } from "../../i18n/en";
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
  if (id !== "handRolled" && !s.unlocks.includes("shops")) return fail("error.needsShopSkill");
  if (!owns(s, "website")) return fail("error.needsWebsite");
  if (s.shop.variant === id) return fail("error.shopInUse");
  if (year < v.from || (v.until !== undefined && year > v.until)) return fail("error.shopNotSold");
  if (own && !v.own) return fail("error.shopNoOwn");
  const price = own && v.own ? v.own.price : v.setup;
  if (s.cash < price) return fail("error.noCash");
  pay(s, price, "ledger.shopSetup", { name: v.name });
  const first = s.shop.variant === null;
  const base = first && id === "handRolled" ? s.shop : newShop();
  s.shop = { ...base, variant: id, owned: own, since: s.hour, readyAt: first && id === "handRolled" ? s.hour : s.hour + SHOP_SETUP_HOURS, groups: s.shop.groups.length || id === "handRolled" ? s.shop.groups : firstGroups(s), products: s.shop.products, productGroups: s.shop.productGroups };
  return { ok: true, id };
}

// A module for the shop, or a custom script for the hand-rolled form.
export function buyModule(s: GameState, module: string): ActionResult {
  if (!MODULE_IDS.includes(module)) return fail("error.unknownModule");
  if (hasModule(s, module) || s.shop.modules[module] !== undefined) return fail("error.moduleOwned");
  const v = s.shop.variant && shopById(s.shop.variant);
  if (!v) return fail("error.needsOrderForm");
  if (v.extra === null) return fail("error.moduleNotSold");
  const price = v.extra;
  if (s.cash < price) return fail("error.noCash");
  pay(s, price, "ledger.shopModule", { module });
  s.shop = { ...s.shop, modules: { ...s.shop.modules, [module]: s.hour + (v.extraHours ?? 0) } };
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

// A first shop gets one group per kind of software the company runs, selling everything it serves.
function firstGroups(s: GameState): ServerGroup[] {
  const kinds = [...new Set(s.clusters.map((c) => c.kind))].filter((k) => SERVES[k].length);
  return kinds.map((kind) => ({ id: `grp${s.nextId++}`, name: t(`group.${kind}`), kind, members: s.clusters.filter((c) => c.kind === kind).map((c) => c.id), sale: [...SERVES[kind]], deploy: true }));
}

const editGroup = (s: GameState, id: string, f: (g: ServerGroup) => Partial<ServerGroup>): ActionResult => {
  const g = s.shop.groups.find((x) => x.id === id);
  if (!g) return fail("error.unknownGroup");
  s.shop = { ...s.shop, groups: s.shop.groups.map((x) => (x.id === id ? { ...x, ...f(x) } : x)) };
  return { ok: true, id };
};

export function createGroup(s: GameState, kind: SoftwareKind, name: string): ActionResult {
  if (!s.shop.variant) return fail("error.needsShop");
  if (!SERVES[kind]?.length) return fail("error.groupKind");
  if (!name.trim()) return fail("error.groupName");
  const id = `grp${s.nextId++}`;
  s.shop = { ...s.shop, groups: [...s.shop.groups, { id, name: name.trim(), kind, members: [], sale: [], deploy: false }] };
  return { ok: true, id };
}

export function deleteGroup(s: GameState, id: string): ActionResult {
  if (!s.shop.groups.some((g) => g.id === id)) return fail("error.unknownGroup");
  s.shop = { ...s.shop, groups: s.shop.groups.filter((g) => g.id !== id) };
  return { ok: true };
}

// Adds a software installation (a panel host, a whole hypervisor cluster) of the group's kind.
export function addToGroup(s: GameState, id: string, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), g = s.shop.groups.find((x) => x.id === id);
  if (!c) return fail("error.unknownCluster");
  if (g && c.kind !== g.kind) return fail("error.groupKind");
  if (groupOf(s, clusterId)) return fail("error.inGroup");
  return editGroup(s, id, (x) => ({ members: [...x.members, clusterId] }));
}

export const removeFromGroup = (s: GameState, id: string, clusterId: string): ActionResult =>
  editGroup(s, id, (x) => ({ members: x.members.filter((m) => m !== clusterId) }));

export function setGroupSale(s: GameState, id: string, product: Product, on: boolean): ActionResult {
  const g = s.shop.groups.find((x) => x.id === id);
  if (g && !SERVES[g.kind].includes(product)) return fail("error.groupKind");
  return editGroup(s, id, (x) => ({ sale: on ? [...new Set([...x.sale, product])] : x.sale.filter((p) => p !== product) }));
}

export const setGroupDeploy = (s: GameState, id: string, on: boolean): ActionResult => editGroup(s, id, () => ({ deploy: on }));
