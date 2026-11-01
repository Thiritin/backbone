// Products and groups of the shop portal: which plan an order form visit buys (docs/design/shop.md).
import { CYCLE_MONTHS, CYCLES, type Cycle } from "../10-catalog/cycles";
import { shopById } from "../10-catalog/shops";
import type { Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { targetFor } from "../30-market/sales";
import type { GameState } from "../50-state";
import { packageNamed } from "./packages";
import { shopActive, type ShopProduct } from "./shop";

// A line that has no plan, or whose largest plan is dearer than this multiple of what the visitor expected, loses the visit.
export const CAP_RATIO = 1.35;

export const productsOf = (s: GameState, line: Product): ShopProduct[] => s.shop.products.filter((p) => p.line === line);
export const lineHasProducts = (s: GameState, line: Product): boolean => productsOf(s, line).length > 0;

// Cycles the active variant sells that the product has a price for.
export const productCycles = (s: GameState, p: ShopProduct): Cycle[] => {
  const v = s.shop.variant && shopById(s.shop.variant);
  return v ? CYCLES.filter((c) => v.cycles.includes(c) && p.prices[c] !== undefined) : [];
};

// The spec an order for the product books: the bound package's on the first member that has it, else the snapshot.
export function packageSpec(s: GameState, p: ShopProduct): Spec {
  const g = s.shop.groups.find((x) => x.id === p.serverGroupId);
  for (const id of g?.members ?? []) {
    const c = s.clusters.find((x) => x.id === id), pkg = c && p.packageName ? packageNamed(c, p.packageName) : undefined;
    if (pkg) return pkg.spec;
  }
  return p.spec;
}

export const monthlyOf = (p: ShopProduct): number => {
  const m = p.prices.monthly ?? Math.min(...CYCLES.filter((c) => p.prices[c] !== undefined).map((c) => p.prices[c]! / CYCLE_MONTHS[c]));
  return Number.isFinite(m) ? m : 0;
};

const covers = (a: Spec, b: Spec, line: Product): boolean =>
  a.vcpu >= b.vcpu && a.ramGb >= b.ramGb && a.diskGb >= b.diskGb && (line !== "webHosting" || (a.trafficGb >= b.trafficGb && a.mailboxes >= b.mailboxes));

// Whether the product can take an order now: on sale, in stock and a server of its group has room.
export function productSellable(s: GameState, p: ShopProduct, city: string): boolean {
  if (p.hidden || p.stock === "off" || p.stock === 0 || !productCycles(s, p).length) return false;
  return !!targetFor(s, { city, product: p.line, spec: packageSpec(s, p), shop: true, productId: p.id });
}

// The plan a visit buys: the smallest that covers the wanted spec, the largest when the price is near the market, else the
// string "soldOut". null means the line has no plans and sells through its configurable options.
export function chooseProduct(s: GameState, r: { city: string; product: Product; spec: Spec; reference: number }): ShopProduct | "soldOut" | null {
  if (!shopActive(s) || !lineHasProducts(s, r.product)) return null;
  const open = productsOf(s, r.product).filter((p) => productSellable(s, p, r.city)).sort((a, b) => monthlyOf(a) - monthlyOf(b));
  const fit = open.find((p) => covers(packageSpec(s, p), r.spec, r.product));
  if (fit) return fit;
  const top = open[open.length - 1];
  return top && monthlyOf(top) <= r.reference * CAP_RATIO ? top : "soldOut";
}

export function takeProductStock(s: GameState, id: string): void {
  s.shop = { ...s.shop, products: s.shop.products.map((p) => (p.id === id && typeof p.stock === "number" ? { ...p, stock: Math.max(0, p.stock - 1) } : p)) };
}
