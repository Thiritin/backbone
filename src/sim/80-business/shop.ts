// The shop system: which variant takes orders, its modules and the stock per product line (docs/design/shop.md).
import { hourOf, isMonthStart, yearOf } from "../00-core/time";
import { hashRng, rand } from "../00-core/rng";
import type { SimEvent } from "../88-tick/tick";
import { bump } from "../40-support/tickets";
import { PRODUCTS } from "../10-catalog/products";
import type { Cycle } from "../10-catalog/cycles";
import { includes, shopById, WHM_PER_THOUSAND, WHM_TIERS, type ShopId } from "../10-catalog/shops";
import { modelById } from "../10-catalog/hardware";
import type { Product } from "../30-customers/customers";
import type { SoftwareKind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { targetFor } from "../30-market/sales";
import type { SalesRequest } from "../30-market/market";

export type Stock = number | "auto" | "off";
// A server group: software installations of one kind (a panel host, a hypervisor cluster) the shop sells from.
export interface ServerGroup { id: string; name: string; kind: SoftwareKind; members: string[]; sale: Product[]; deploy: boolean }
export interface ShopState {
  variant: ShopId | null;
  // Owned licence instead of the lease, for variants that sell one.
  owned: boolean;
  since: number;
  readyAt: number;
  // Bought modules and the hour each starts working.
  modules: Record<string, number>;
  stock: Partial<Record<Product, Stock>>;
  // Visitors this month who found the line sold out.
  soldOut: Partial<Record<Product, number>>;
  groups: ServerGroup[];
  // Discount off N times the monthly price per cycle for lines sold through configurable options; the market's where unset.
  optionDiscount: Partial<Record<Cycle, number>>;
}

export const newShop = (): ShopState => ({ variant: null, owned: false, since: 0, readyAt: 0, modules: {}, stock: {}, soldOut: {}, groups: [], optionDiscount: {} });

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
  return n !== "off" && n !== 0 && !!targetFor(s, { ...r, shop: true });
}

export const groupOf = (s: GameState, clusterId: string): ServerGroup | undefined => s.shop.groups.find((g) => g.members.includes(clusterId));
// Installations in a group that sells the line.
export const forSale = (s: GameState, p: Product): Set<string> => new Set(s.shop.groups.filter((g) => g.sale.includes(p)).flatMap((g) => g.members));
// Whether automatic provisioning may use this target: hardware targets always, software only in a deploy group.
export const deployable = (s: GameState, clusterId: string | null): boolean => !clusterId || !s.shop.variant || !!groupOf(s, clusterId)?.deploy;

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

// A leak of the shop's customer data: WHMCache's in May 2012, and a monthly risk for a shop past its last update.
export const SHOP_BREACH = { happiness: -15, monthly: 0.02 };
export const WHM_BREACH_AT = hourOf(new Date(Date.UTC(2012, 4, 21)));
const unpatched = (id: ShopId, year: number): boolean => (id === "modemBill" && year >= 2011) || (id === "boxBillin" && year >= 2015 && year < 2022);

export function shopTick(s: GameState, events: SimEvent[]): void {
  const id = s.shop.variant;
  if (!id || !shopActive(s)) return;
  const hit = (id === "whmCache" && s.hour === WHM_BREACH_AT) || (isMonthStart(s.hour) && unpatched(id, yearOf(s.hour)) && rand(hashRng(s.seed, s.hour, 271)) < SHOP_BREACH.monthly);
  if (!hit) return;
  s.customers = s.customers.map((c) => {
    if (c.churnedAt !== null) return c;
    const copy = { ...c };
    bump(copy, SHOP_BREACH.happiness);
    return copy;
  });
  events.push({ app: "Security", key: "event.shopBreach", params: { name: shopById(id).name } });
}
