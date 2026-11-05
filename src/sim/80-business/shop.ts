// The shop system: which variant takes orders, its modules and the stock per product line (docs/design/shop.md).
import { hourOf, isMonthStart, yearOf } from "../00-core/time";
import { hashRng, rand } from "../00-core/rng";
import type { SimEvent } from "../88-tick/tick";
import { bump } from "../40-support/tickets";
import { PRODUCTS } from "../10-catalog/products";
import type { Cycle } from "../10-catalog/cycles";
import type { MethodId } from "../10-catalog/payments";
import { includes, shopById, type ShopId } from "../10-catalog/shops";
import { shopEra, shopLicence, shopOnSale } from "../10-catalog/shop-licences";
import { assignedKey, covers, isLicensed, SHOP_MACHINE } from "../60-infra/licence";
import { releasedAt, versionsOf, type SoftwareVersion } from "../10-catalog/software-versions";
import type { Licence } from "../50-state";
import { supportOn } from "../60-infra/lifecycle";
import { shopBroken } from "../60-infra/shop-files";
import { modelById } from "../10-catalog/hardware";
import type { Product } from "../30-customers/customers";
import type { Spec } from "../10-catalog/products";
import type { SoftwareKind } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { ShopOrder } from "./shop-orders";
import type { MailTemplate, ShopEmail } from "./shop-mail";

export type Stock = number | "auto" | "off";
// How a group places new orders: on its least full server, or on the first server in list order with room.
export type Fill = "spread" | "fill";
// A server group: software installations of one kind (a panel host, a hypervisor cluster) the shop sells from, in fill
// order. Its kind is its first member's; inactive members take no new shop orders.
export interface ServerGroup { id: string; name: string; members: string[]; inactive: string[]; fill: Fill }
// When a product's order is set up: on the first payment, after the admin accepts it, or by hand.
export type SetupMode = "payment" | "accept" | "off";
export interface ProductGroup { id: string; name: string; hidden: boolean }
// A sellable plan. prices hold the total of one term per cycle; an absent cycle is not offered. With autoCycles every
// offered cycle but the monthly one is priced from the monthly price and the shop's cycle discounts.
export interface ShopProduct {
  id: string; groupId: string; name: string; line: Product;
  serverGroupId: string | null; packageName: string | null;
  // Used until a package is bound, and for lines whose software has no packages.
  spec: Spec;
  title?: string; slots?: number;
  prices: Partial<Record<Cycle, number>>;
  autoCycles: boolean;
  setup: number;
  stock: Stock; hidden: boolean; setupMode: SetupMode;
}
export interface ShopState {
  variant: ShopId | null;
  // Owned licence instead of the lease, for variants that sell one.
  owned: boolean;
  since: number;
  // Bought modules and the hour each starts working.
  modules: Record<string, number>;
  // What the systems in use before had: their modules and registered licences (s.modules), back on switching back.
  modulesBy: Partial<Record<ShopId, { modules: Record<string, number>; licences: string[] }>>;
  // Visitors this month who found no fitting plan in stock.
  soldOut: Record<string, number>;
  groups: ServerGroup[];
  // Discount off N times the monthly price per cycle for products with automatic cycle prices; 0 where unset.
  optionDiscount: Partial<Record<Cycle, number>>;
  products: ShopProduct[];
  productGroups: ProductGroup[];
  // Payment methods the player switched off in this shop.
  methodsOff: MethodId[];
  // The web space on a panel host the shop runs in, and the version it runs; null while it is not installed.
  install: ShopInstall | null;
  // The admin password reset mailed last: its link's token, the admin row it resets and the hour the link runs out.
  reset: { token: string; pk: number; until: number } | null;
  orders: ShopOrder[];
  // The emails the shop sent in the last year, and the templates the player switched off.
  emails: ShopEmail[];
  mailOff: MailTemplate[];
  // False from install until the setup wizard is finished or closed; saves from before the wizard skip it.
  setupDone?: boolean;
  // Install guide steps seen done; a step stays ticked.
  ticked?: string[];
  // The hour the shop's cron job was last seen set; billing stops a month after it was removed.
  cronRanAt?: number;
}
// ws, folder and db name where the installer put the shop (web-hosting.md 5); a hosted shop has none.
export interface ShopInstall { clusterId: string; version: string; at: number; ws?: string; folder?: string; db?: string }

export const newShop = (): ShopState => ({ variant: null, owned: false, since: 0, modules: {}, modulesBy: {}, soldOut: {}, groups: [], optionDiscount: {}, products: [], productGroups: [], methodsOff: [], install: null, reset: null, orders: [], emails: [], mailOff: [] });

export const shopActive = (s: GameState): boolean => s.shop.variant !== null && !shopBroken(s);


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

export const groupOf = (s: GameState, clusterId: string): ServerGroup | undefined => s.shop.groups.find((g) => g.members.includes(clusterId));
// The kind of software a group holds: its first member's; undefined while it is empty.
export const groupKind = (s: GameState, g: ServerGroup): SoftwareKind | undefined => s.clusters.find((c) => c.id === g.members[0])?.kind;
// Customer accounts on an installation.
export const accountsOn = (s: GameState, clusterId: string): number => s.workloads.filter((w) => w.clusterId === clusterId && w.serviceId).length;
// Whether automatic provisioning may use this target: a product without a server group waits for the player.
export const deployable = (s: GameState, clusterId: string | null, productId?: string): boolean =>
  !clusterId || !productId || !!s.shop.products.find((p) => p.id === productId)?.serverGroupId;

// Whether the shop has the module for every server of the group; a product can bind only such a group, or none and be manual.
export const groupProvisions = (s: GameState, g: ServerGroup): boolean => g.members.every((id) => hasModule(s, moduleFor(s, "webHosting", id)));

export function soldOutVisit(s: GameState, p: string): void {
  s.shop = { ...s.shop, soldOut: { ...s.shop.soldOut, [p]: (s.shop.soldOut[p] ?? 0) + 1 } };
}

// The newest release the key may install: one its major covers, out before its updates end. Without a key, the newest out.
export function installable(s: GameState, id: ShopId, k: Licence | undefined): SoftwareVersion | undefined {
  const until = k?.updatesUntil === undefined ? s.hour : Math.min(s.hour, k.updatesUntil);
  return releasedAt(id, until).filter((v) => !k || covers(k, v.version)).at(-1);
}
// The release Install update takes the installed shop to; null while it runs the newest its key may install.
// The release the vendor's download area hands out (web-hosting.md 5, step 1): the newest one the best key the company
// holds covers, else the newest one while the shop is sold with a trial or for free; null while there is nothing to fetch.
export function downloadableRelease(s: GameState, id: ShopId): SoftwareVersion | null {
  const keys = s.licenses.filter((k) => k.product === id);
  const best = keys.map((k) => installable(s, id, k)).filter((v): v is SoftwareVersion => !!v).sort((a, b) => b.release - a.release)[0];
  if (best) return best;
  const latest = releasedAt(id, s.hour).at(-1) ?? null;
  return latest && shopOnSale(id, s.hour) && (!isLicensed(id) || shopLicence(id).trialDays !== null) ? latest : null;
}

export function shopUpdate(s: GameState): SoftwareVersion | null {
  const id = s.shop.variant, at = s.shop.install;
  if (!id || !at) return null;
  const v = installable(s, id, assignedKey(s, SHOP_MACHINE, id)), vs = versionsOf(id);
  return v && vs.indexOf(v) > vs.findIndex((x) => x.version === at.version) ? v : null;
}

// The yearly updates fee of a one-time shop key: the vendor's current one, else the one of the era the key was bought in.
export const shopUpdatesFee = (s: GameState, k: Licence): number | undefined =>
  shopEra(k.product as ShopId, s.hour).updatesFee ?? shopEra(k.product as ShopId, k.boughtAt).updatesFee;

// What a shop edition caps: active clients or managed servers; 0 for a shop without caps.
export function shopCount(s: GameState): number {
  const caps = s.shop.variant && shopLicence(s.shop.variant).caps;
  return caps === "servers" ? s.devices.filter((d) => d.rackId && modelById(d.model).server).length
    : caps === "clients" ? s.customers.filter((c) => c.churnedAt === null).length : 0;
}

// The month's shop bill: the vendor's cut of the shop's revenue. Keys renew and lapse with the other licence keys.
export function shopBills(s: GameState): { key: string; params: Record<string, string | number>; amount: number }[] {
  if (!s.shop.variant) return [];
  const v = shopById(s.shop.variant), share = shopEra(v.id, s.hour).cut;
  if (!share) return [];
  const revenue = s.services.filter((x) => x.viaShop && x.endedAt === null).reduce((n, x) => n + x.price * 730, 0);
  const cut = Math.round(revenue * share * 100) / 100;
  return cut > 0 ? [{ key: "ledger.shopCut", params: { name: v.name }, amount: cut }] : [];
}

// A leak of the shop's customer data: WHMCache's in May 2012, and a monthly risk for a shop past its last update or running a
// version past its end of security updates.
export const SHOP_BREACH = { happiness: -15, monthly: 0.02 };
export const WHM_BREACH_AT = hourOf(new Date(Date.UTC(2012, 4, 21)));
const unpatched = (id: ShopId, year: number): boolean => (id === "modemBill" && year >= 2011) || (id === "boxBillin" && year >= 2015 && year < 2022);

export function shopTick(s: GameState, events: SimEvent[]): void {
  const id = s.shop.variant;
  if (!id || !shopActive(s) || !s.shop.install) return;
  const old = unpatched(id, yearOf(s.hour)) || supportOn(s, SHOP_MACHINE, id) === "securityEnded";
  const hit = (id === "whmCache" && s.hour === WHM_BREACH_AT) || (isMonthStart(s.hour) && old && rand(hashRng(s.seed, s.hour, 271)) < SHOP_BREACH.monthly);
  if (!hit) return;
  s.customers = s.customers.map((c) => {
    if (c.churnedAt !== null) return c;
    const copy = { ...c };
    bump(copy, SHOP_BREACH.happiness);
    return copy;
  });
  events.push({ app: "Security", key: "event.shopBreach", params: { name: shopById(id).name } });
}
