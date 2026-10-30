// The shop system: which variant takes orders, its modules and the stock per product line (docs/design/shop.md).
import { yearOf } from "../00-core/time";
import { PRODUCTS } from "../10-catalog/products";
import { includes, shopById, WHM_PER_THOUSAND, WHM_TIERS, type ShopId } from "../10-catalog/shops";
import { modelById } from "../10-catalog/hardware";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { targetFor } from "../30-market/sales";
import type { SalesRequest } from "../30-market/market";

export type Stock = number | "auto" | "off";
export interface ShopState {
  variant: ShopId | null;
  // Owned licence instead of the lease, for variants that sell one.
  owned: boolean;
  since: number;
  readyAt: number;
  // Bought modules (custom scripts for the hand-rolled form) and the hour each starts working.
  modules: Record<string, number>;
  stock: Partial<Record<Product, Stock>>;
  // Visitors this month who found the line sold out.
  soldOut: Partial<Record<Product, number>>;
}

export const newShop = (): ShopState => ({ variant: null, owned: false, since: 0, readyAt: 0, modules: {}, stock: {}, soldOut: {} });

export const shopActive = (s: GameState): boolean => s.shop.variant !== null && s.hour >= s.shop.readyAt;

// A manual-stock shop starts each line at this many units.
export const START_STOCK = 10;
export const stockOf = (s: GameState, p: Product): Stock =>
  s.shop.stock[p] ?? (s.shop.variant && shopById(s.shop.variant).autoStock ? "auto" : START_STOCK);

export function hasModule(s: GameState, module: string): boolean {
  const v = s.shop.variant && shopById(s.shop.variant);
  return (!!v && includes(v, module, yearOf(s.hour))) || (s.shop.modules[module] ?? Infinity) <= s.hour;
}

// The module a service on this target needs: the software it runs on, or the hardware side.
export function moduleFor(s: GameState, product: Product, clusterId: string | null): string {
  const c = clusterId ? s.clusters.find((x) => x.id === clusterId) : null;
  if (c) return c.panel ?? c.platform ?? "";
  const on = PRODUCTS[product].runsOn;
  return on === "server" ? "dedicated" : on === "rack" ? "colo" : product === "ssl" ? "ssl" : "registrar";
}

// Whether the shop can sell this order now: the line is on, stock is left and a target has room.
export function inStock(s: GameState, r: Pick<SalesRequest, "city" | "product" | "spec">): boolean {
  const n = stockOf(s, r.product);
  return n !== "off" && n !== 0 && !!targetFor(s, r);
}

export function takeStock(s: GameState, p: Product): void {
  const n = stockOf(s, p);
  if (typeof n === "number") s.shop = { ...s.shop, stock: { ...s.shop.stock, [p]: Math.max(0, n - 1) } };
}

export function soldOutVisit(s: GameState, p: Product): void {
  s.shop = { ...s.shop, soldOut: { ...s.shop.soldOut, [p]: (s.shop.soldOut[p] ?? 0) + 1 } };
}

const whmLease = (customers: number): number => {
  const tier = WHM_TIERS.find(([n]) => customers <= n);
  return tier ? tier[1] : WHM_TIERS[WHM_TIERS.length - 1][1] + Math.ceil((customers - WHM_TIERS[WHM_TIERS.length - 1][0]) / 1000) * WHM_PER_THOUSAND;
};

// The month's shop bills: lease or update fees, per-server fees and the revenue cut.
export function shopBills(s: GameState): { key: string; params: Record<string, string | number>; amount: number }[] {
  if (!s.shop.variant) return [];
  const v = shopById(s.shop.variant), name = v.name, out: ReturnType<typeof shopBills> = [];
  const anniversary = Math.round((s.hour - s.shop.since) / 730) % 12 === 0 && s.hour > s.shop.since;
  if (s.shop.owned && v.own) {
    if (anniversary) out.push({ key: "ledger.shopUpdates", params: { name }, amount: v.own.yearly });
  } else {
    let monthly = v.monthly;
    if (v.id === "whmCache" && yearOf(s.hour) >= 2020) monthly = whmLease(s.customers.filter((c) => c.churnedAt === null).length);
    if (v.perServer) monthly = Math.max(monthly, v.perServer * s.devices.filter((d) => d.rackId && modelById(d.model).server).length);
    if (monthly > 0) out.push({ key: "ledger.shopLicence", params: { name }, amount: monthly });
    if (v.yearly > 0 && anniversary) out.push({ key: "ledger.shopUpdates", params: { name }, amount: v.yearly });
  }
  if (v.cut) {
    const revenue = s.services.filter((x) => x.viaShop && x.endedAt === null).reduce((n, x) => n + x.price * 730, 0);
    const cut = Math.round(revenue * v.cut * 100) / 100;
    if (cut > 0) out.push({ key: "ledger.shopCut", params: { name }, amount: cut });
  }
  return out;
}
