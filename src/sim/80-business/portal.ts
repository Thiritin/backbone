// Products and groups of the shop portal: which plan an order form visit buys (docs/design/shop.md).
import { CYCLE_MONTHS, CYCLES, type Cycle } from "../10-catalog/cycles";
import { shopById, type ShopId } from "../10-catalog/shops";
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

export type PortalArea = "store" | "configure" | "cart" | "client" | "admin";
export interface PortalIds { group?: string; product?: string }
export interface PortalRoute extends PortalIds { area: PortalArea; query: URLSearchParams }

// Addresses by shop system; <group> and <product> take the ids. A cart of null is the configure page (single page order).
const PATHS: Record<ShopId, Record<PortalArea, string | null>> = {
  whmCache: { store: "/cart.php?gid=<group>", configure: "/cart.php?a=add&pid=<product>", cart: "/cart.php?a=view", client: "/clientarea.php", admin: "/admin/" },
  blessta: { store: "/order/main/packages/<group>", configure: "/order/config/index/<group>?pricing_id=<product>", cart: "/order/cart", client: "/client/", admin: "/admin/" },
  hostBull: { store: "/cart/<group>/", configure: "/cart/<group>/<product>/", cart: "/cart/", client: "/clientarea/", admin: "/admin/" },
  boxBillin: { store: "/order", configure: "/order/<product>", cart: null, client: "/client", admin: "/bb-admin/" },
  clientExit: { store: "/order.php?gid=<group>", configure: "/order.php?pid=<product>", cart: "/order.php?step=cart", client: "/index.php?fuse=home", admin: "/admin/" },
  modemBill: { store: "/order.php?group=<group>", configure: "/order.php?pkg=<product>", cart: "/order.php?step=review", client: "/modernbill/", admin: "/admin/" },
  handRolled: { store: "/bestellen.php", configure: "/bestellen.php?plan=<product>", cart: null, client: null, admin: "/admin.php" },
  ubersmyth: { store: "/order/", configure: "/order/<product>", cart: "/order/cart", client: "/client/", admin: "/admin/" },
  orderBocks: { store: "/store/", configure: "/store/<product>", cart: "/store/cart", client: "/account/", admin: "/admin/" },
};

// Specific before general: a cart address is never read as a product.
const AREAS: PortalArea[] = ["admin", "client", "cart", "configure", "store"];
const trim = (p: string): string => p.replace(/\/+$/, "");
const slot = (v: string): string | null => /^<(\w+)>$/.exec(v)?.[1] ?? null;

// The ids a path carries when it fits the template (admin and client also match everything below their address), else null.
function fit(tpl: string, path: string, prefix: boolean): PortalIds | null {
  const [tp, tq = ""] = tpl.split("?"), [pp, pq = ""] = path.split("?");
  const ts = trim(tp).split("/"), ps = trim(pp).split("/"), ids: Record<string, string> = {};
  if (prefix ? ps.length < ts.length : ps.length !== ts.length) return null;
  for (let i = 0; i < ts.length; i++) {
    const k = slot(ts[i]);
    if (k) { if (!ps[i]) return null; ids[k] = decodeURIComponent(ps[i]); } else if (ts[i] !== ps[i]) return null;
  }
  const q = new URLSearchParams(pq);
  for (const [key, want] of new URLSearchParams(tq)) {
    const k = slot(want), got = q.get(key);
    if (k) { if (!got) return null; ids[k] = got; } else if (got !== want) return null;
  }
  return ids;
}

// The address of a page. screen names a screen inside the admin or client area; a record adds more parameters to it.
export function portalPath(variant: ShopId, area: PortalArea, ids: PortalIds = {}, screen?: string | Record<string, string>): string {
  const tpl = PATHS[variant][area] ?? (area === "cart" ? PATHS[variant].configure : "") ?? "";
  const path = tpl.replace("<group>", encodeURIComponent(ids.group ?? "")).replace("<product>", encodeURIComponent(ids.product ?? ""));
  const extra = new URLSearchParams(typeof screen === "string" ? { s: screen } : screen).toString();
  return extra ? `${path}${path.includes("?") ? "&" : "?"}${extra}` : path;
}

export function parsePortal(variant: ShopId, path: string): PortalRoute | null {
  const query = new URLSearchParams(path.split("?")[1] ?? "");
  for (const area of AREAS) {
    const tpl = PATHS[variant][area];
    if (!tpl) continue;
    const prefix = area === "admin" || area === "client";
    // The store address alone, without a group, shows the first group.
    const ids = fit(tpl, path, prefix) ?? (area === "store" && !path.includes("?") ? fit(tpl.split("?")[0], path, false) : null);
    if (ids) return { area, ...ids, query };
  }
  return null;
}

// /admin leads to the admin of every shop system.
export const isAdminAlias = (path: string): boolean => /^\/admin(\/|\?|$)/.test(path);
