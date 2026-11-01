// The company website: every company has one, and it lists the product lines the player switched on. Leads only write
// about listed lines; gdd.md, "Where requests come from".
import { yearOf } from "../00-core/time";
import { sizeSpec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { serviceOnline } from "../40-support/status";
import { serviceHeld } from "../45-billing/billing";
import { HOW_TO, KNOWLEDGE_BASE } from "../40-support/tickets";
import { bookable, diskFits, lineOffered, noRoomError, nodeUsed, serverOf, vmRoom, workloadOnline, workloadsOf, type Cluster, type Workload } from "../60-infra/cluster";
import { machineAddress } from "../60-infra/addresses";
import { hostPerf } from "../60-infra/php";
import { nodeUsage } from "../60-infra/usage";
import type { SimEvent } from "../88-tick/tick";
import { owns } from "./marketing";
import { salesAddress } from "./mail";
import { CYCLE_MONTHS, CYCLES } from "../10-catalog/cycles";
import { companyDomain } from "../30-customers/domains";
import { lineHasProducts, portalPath, productsOf } from "./portal";
import { STATUS_FROM_YEAR, STATUS_MIN_CUSTOMERS } from "./status";
import { shopActive, type ShopProduct } from "./shop";
import { offeredProducts, type CatalogProduct } from "./catalog";

export const SITE_LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation", "gpu", "ssl"];

export const listed = (s: GameState, p: Product): boolean => s.marketing.lines.includes(p);

// The error key for why a line cannot go on the website, or null when it can. SSL is an add-on for web hosting customers.
export function lineBlocker(s: GameState, p: Product): string | null {
  if (p !== "ssl") return lineOffered(s, p) ? null : noRoomError(s, p);
  if (!s.registrar) return "error.needsRegistrar";
  return listed(s, "webHosting") ? null : "error.needsWebHostingLine";
}

// The first site is hand-written HTML: free, and ready three days after the player starts it.
export const SITE_BUILD_HOURS = 72;
export const siteBuilt = (s: GameState): boolean => s.marketing.siteReady !== null && s.hour >= s.marketing.siteReady;

// Saves from before the build step count a site as launched once it had a domain and listed lines.
export const fillLaunch = (s: GameState, saved: boolean | undefined): GameState =>
  saved !== undefined || !s.company.domain || !s.marketing.lines.length ? s : { ...s, marketing: { ...s.marketing, siteReady: 0, launched: true } };

// Saves from before the website list every line they could sell.
export function fillLines(s: GameState, saved: Product[] | undefined): GameState {
  if (saved) return s;
  const base = { ...s, marketing: { ...s.marketing, lines: SITE_LINES.filter((p) => p !== "ssl" && !lineBlocker(s, p)) } };
  return lineBlocker(base, "ssl") ? base : { ...base, marketing: { ...base.marketing, lines: [...base.marketing.lines, "ssl"] } };
}

// Products of a line the shop shows: neither the product nor its group is hidden.
export const visibleProducts = (s: GameState, line: Product): ShopProduct[] =>
  productsOf(s, line).filter((p) => !p.hidden && !s.shop.productGroups.find((g) => g.id === p.groupId)?.hidden);
// The lowest price per month over a product's cycles.
export const fromMonthly = (p: ShopProduct): number =>
  Math.min(...CYCLES.filter((c) => p.prices[c] !== undefined).map((c) => p.prices[c]! / CYCLE_MONTHS[c]));
// The portal address an order button leads to: the product's configure page, else the store root. Null without a shop.
export function orderLink(s: GameState, product?: ShopProduct): string | null {
  const v = s.shop.variant;
  if (!v || !shopActive(s)) return null;
  const path = product ? portalPath(v, "configure", { group: product.groupId, product: product.id }) : portalPath(v, "store");
  return `portal.${companyDomain(s)}${path}`;
}

// What the website shows: each listed line, with its published products before a shop, else the price from its cheapest
// visible shop product, or from the line's smallest size at the player's rates for lines sold through configurable options,
// and the order address while orders still come by email.
export interface SiteLine { product: Product; from: number | null; link: string | null; items: CatalogProduct[] }
export const siteContent = (s: GameState): { lines: SiteLine[]; email: string | null } => ({
  lines: SITE_LINES.filter((p) => listed(s, p)).map((p) => {
    const items = shopActive(s) ? [] : offeredProducts(s, p);
    if (items.length) return { product: p, from: null, link: null, items };
    const best = visibleProducts(s, p).filter((x) => Number.isFinite(fromMonthly(x))).sort((x, y) => fromMonthly(x) - fromMonthly(y))[0];
    if (best) return { product: p, from: fromMonthly(best), link: orderLink(s, best), items };
    return { product: p, from: shopActive(s) ? offerPrice(s, p, sizeSpec(p, 0, yearOf(s.hour))) : null, link: orderLink(s), items };
  }),
  email: s.marketing.emailOrders ? salesAddress(s) : null,
});

// The site grows with the company: the hand-written page is one page, the web design adds the menu, the Knowledge base
// app adds its articles and enough customers fill a help desk with questions and answers.
export type SitePage = "home" | "products" | "pricing" | "kb" | "helpdesk" | "network" | "status" | "about" | "legal" | "contact" | "support";
export const HELPDESK_CUSTOMERS = 25;
export const statusPage = (s: GameState): boolean =>
  yearOf(s.hour) >= STATUS_FROM_YEAR && s.customers.filter((c) => c.churnedAt === null).length >= STATUS_MIN_CUSTOMERS;
export function sitePages(s: GameState): SitePage[] {
  if (!owns(s, "website")) return ["home"];
  const kb = s.installed.includes(KNOWLEDGE_BASE), desk = s.customers.filter((c) => c.churnedAt === null).length >= HELPDESK_CUSTOMERS;
  const priced = shopActive(s) && SITE_LINES.some((p) => listed(s, p) && (visibleProducts(s, p).length > 0 || !lineHasProducts(s, p)));
  return ["home", "products", ...(priced ? ["pricing" as const] : []), ...(kb ? ["kb" as const] : []), ...(desk ? ["helpdesk" as const] : []),
    ...(s.locations.some((l) => l.dc) ? ["network" as const] : []), ...(statusPage(s) ? ["status" as const] : []), "about", "contact", "legal", "support"];
}
// The articles the Knowledge base answers, with how often customers read each.
export const kbArticles = (s: GameState): { topic: string; reads: number }[] =>
  Object.keys(HOW_TO).filter((t) => HOW_TO[t].basic).map((topic) => ({ topic, reads: s.kbReads[topic] ?? 0 }));

// The company site is rented from Strateaux at a flat price (economy.md, "Market and leads") or runs on an own panel host.
export const SITE_RENT = 9.9;
// What the site takes on an own host, like a small web space.
export const SITE_LOAD = { vcpu: 0.25, ramGb: 0.5, diskGb: 2 };
const SLOW_RAM = 0.9;

export const siteHostingCost = (s: GameState): number => (s.marketing.launched && s.marketing.siteHost.kind === "rented" ? SITE_RENT : 0);

// The site is a virtual workload on its host: it books nothing in the node, so workloadsOf and billing stay as they are.
function siteWorkload(c: Cluster): Workload {
  return {
    id: "site", serviceId: "site", clusterId: c.id, deviceId: c.vm ? null : c.nodes[0]?.deviceId ?? null, rackId: null, slot: 0, units: 0, watts: 0,
    // Never placed before a disk loss, so a static site survives one.
    placedAt: Number.MAX_SAFE_INTEGER, stopped: false, busyUntil: 0, backupAt: null, ...SITE_LOAD,
  };
}

// Whether the workload's host runs it slowly: an overloaded node or a PHP upgrade on its panel host.
export function slowHost(s: GameState, w: Workload, c: Cluster | undefined): boolean {
  const at = serverOf(s, w);
  return Math.min(at ? nodeUsage(s, at).perf : 1, hostPerf(s, c)) < 1;
}

// Whether a panel host has the disk for the site next to its web spaces, and whether its RAM is over 90% booked with the site.
export function siteRoom(s: GameState, c: Cluster): { fits: boolean; crowded: boolean } {
  const d = c.vm ? null : s.devices.find((x) => x.id === c.nodes[0]?.deviceId);
  const room = c.vm ? vmRoom(s, c) : d ? { cap: bookable(s, d), used: nodeUsed(s, d.id) } : null;
  if (!room) return { fits: false, crowded: true };
  return { fits: diskFits(room.used, room.cap, SITE_LOAD), crowded: room.used.ramGb + SITE_LOAD.ramGb > SLOW_RAM * room.cap.ramGb };
}

export type SiteStatus = "up" | "slow" | "down";

// A rented site is always up. On an own host it is down while the site's workload is offline and slow while the host
// performs below 1 or has over 90% of its RAM booked.
export function siteStatus(s: GameState): SiteStatus {
  const host = s.marketing.siteHost;
  if (host.kind === "rented") return "up";
  const c = s.clusters.find((x) => x.id === host.clusterId);
  if (!c) return "down";
  const w = siteWorkload(c);
  if (!workloadOnline(s, w)) return "down";
  return slowHost(s, w, c) || siteRoom(s, c).crowded ? "slow" : "up";
}

// Design generations are 4 years apart; a site is fine one generation behind and loses 20% of its requests for each
// further one, down to 40% (economy.md, "Marketing and reviews").
export const generationOf = (year: number): number => 2005 + 4 * Math.max(0, Math.floor((year - 2005) / 4));
export const generationsBehind = (s: GameState): number => (generationOf(yearOf(s.hour)) - s.marketing.designYear) / 4;
export const penaltyFor = (behind: number): number => Math.max(0.4, 1 - 0.2 * Math.max(0, behind - 1));
export const agePenalty = (s: GameState): number => penaltyFor(generationsBehind(s));

// What the status does to website leads and shop orders.
export const STATUS_FACTOR: Record<SiteStatus, number> = { up: 1, slow: 0.5, down: 0 };
export const siteFactor = (s: GameState): number => STATUS_FACTOR[siteStatus(s)] * agePenalty(s);

// Saves from before design years get the generation of the game year when the web design is owned.
export const fillDesign = (s: GameState, saved: number | undefined): GameState =>
  saved !== undefined || !owns(s, "website") ? s : { ...s, marketing: { ...s.marketing, designYear: generationOf(yearOf(s.hour)) } };

// Hourly: tells the player when the first site is written.
export function siteBuiltEvent(s: GameState, events: SimEvent[]): void {
  if (s.marketing.siteReady === s.hour && !s.marketing.launched) events.push({ app: "Marketing", key: "event.siteBuilt", params: {} });
}

// Hourly: tells the player once when an own host takes the site down.
export function siteDownEvent(s: GameState, events: SimEvent[]): void {
  const host = s.marketing.siteHost;
  if (host.kind === "rented" || !s.marketing.launched) return;
  const down = siteStatus(s) === "down";
  if (down === s.marketing.siteOutage) return;
  s.marketing = { ...s.marketing, siteOutage: down };
  if (down) events.push({ app: "Browser", key: "event.siteDown", params: { host: s.clusters.find((c) => c.id === host.clusterId)?.name ?? "" } });
}

export type CustomerSiteStatus = "up" | "slow" | "defaced" | "down";

// A web hosting customer's own site, from the customer's name and the profile; blurb is an i18n key.
// sponsored: a running sponsorship covers the site and its banner still hangs, so the company's logo shows on it.
export function customerSite(s: GameState, serviceId: string): { title: string; blurb: string; status: CustomerSiteStatus; sponsored: boolean } | null {
  const v = s.services.find((x) => x.id === serviceId), cus = v && s.customers.find((c) => c.id === v.customerId);
  if (!v || !cus || v.product !== "webHosting") return null;
  const ws = workloadsOf(s, serviceId);
  const hacked = ws.some((w) => w.clusterId && s.security.hacked.includes(w.clusterId));
  const status: CustomerSiteStatus = v.endedAt !== null || serviceHeld(s, v) ? "down"
    : hacked || s.sites.defaced.includes(serviceId) ? "defaced"
    : !serviceOnline(s, serviceId) ? "down"
    : ws.some((w) => slowHost(s, w, s.clusters.find((c) => c.id === w.clusterId))) ? "slow" : "up";
  const sponsored = s.sponsorships.some((x) => x.status === "running" && x.serviceIds.includes(serviceId) && !x.board?.dropped);
  return { title: cus.name, blurb: `site.blurb.${cus.profile}`, status, sponsored };
}

// Where a customer's site answers: its domain, or the private address of its account until it has one.
export function siteHost(s: GameState, serviceId: string): string | null {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.product !== "webHosting") return null;
  const w = workloadsOf(s, serviceId)[0];
  return v.domain ?? (w ? machineAddress(s, w.id) : null);
}
