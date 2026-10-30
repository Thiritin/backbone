// The company website: every company has one, and it lists the product lines the player switched on. Leads only write
// about listed lines; gdd.md, "Where requests come from".
import { yearOf } from "../00-core/time";
import { sizeSpec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { serviceOnline } from "../40-support/status";
import { bookable, diskFits, lineOffered, noRoomError, nodeUsed, serverOf, vmRoom, workloadOnline, workloadsOf, type Cluster, type Workload } from "../60-infra/cluster";
import { hostPerf } from "../60-infra/php";
import { nodeUsage } from "../60-infra/usage";
import type { SimEvent } from "../88-tick/tick";
import { hasOrderForm, owns } from "./marketing";
import { salesAddress } from "./mail";

export const SITE_LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation", "gpu", "ssl"];

export const listed = (s: GameState, p: Product): boolean => s.marketing.lines.includes(p);

// The error key for why a line cannot go on the website, or null when it can.
export const lineBlocker = (s: GameState, p: Product): string | null =>
  p === "ssl" ? (s.registrar ? null : "error.needsRegistrar") : lineOffered(s, p) ? null : noRoomError(s, p);

// Saves from before the website list every line they could sell.
export const fillLines = (s: GameState, saved: Product[] | undefined): GameState =>
  saved ? s : { ...s, marketing: { ...s.marketing, lines: SITE_LINES.filter((p) => !lineBlocker(s, p)) } };

// What the website shows: each listed line, with its price from the line's smallest size at the player's rates once the
// order form takes orders, and the order address while orders still come by email.
export const siteContent = (s: GameState): { lines: { product: Product; from: number | null }[]; email: string | null } => ({
  lines: SITE_LINES.filter((p) => listed(s, p)).map((p) => ({ product: p, from: hasOrderForm(s) ? offerPrice(s, p, sizeSpec(p, 0, yearOf(s.hour))) : null })),
  email: s.marketing.emailOrders ? salesAddress(s) : null,
});

// The company site is rented from Strateaux at a flat price (economy.md, "Market and leads") or runs on an own panel host.
export const SITE_RENT = 9.9;
// What the site takes on an own host, like a small web space.
export const SITE_LOAD = { vcpu: 0.25, ramGb: 0.5, diskGb: 2 };
const SLOW_RAM = 0.9;

export const siteHostingCost = (s: GameState): number => (owns(s, "website") && s.marketing.siteHost.kind === "rented" ? SITE_RENT : 0);

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

// What the status does to website leads and order form orders.
export const STATUS_FACTOR: Record<SiteStatus, number> = { up: 1, slow: 0.5, down: 0 };
export const siteFactor = (s: GameState): number => STATUS_FACTOR[siteStatus(s)] * agePenalty(s);

// Saves from before design years get the generation of the game year when the web design is owned.
export const fillDesign = (s: GameState, saved: number | undefined): GameState =>
  saved !== undefined || !owns(s, "website") ? s : { ...s, marketing: { ...s.marketing, designYear: generationOf(yearOf(s.hour)) } };

// Hourly: tells the player once when an own host takes the site down.
export function siteDownEvent(s: GameState, events: SimEvent[]): void {
  const host = s.marketing.siteHost;
  if (host.kind === "rented") return;
  const down = siteStatus(s) === "down";
  if (down === s.marketing.siteOutage) return;
  s.marketing = { ...s.marketing, siteOutage: down };
  if (down) events.push({ app: "Website", key: "event.siteDown", params: { host: s.clusters.find((c) => c.id === host.clusterId)?.name ?? "" } });
}

export type CustomerSiteStatus = "up" | "slow" | "defaced" | "down";

// A web hosting customer's own site, from the customer's name and the profile; blurb is an i18n key.
export function customerSite(s: GameState, serviceId: string): { title: string; blurb: string; status: CustomerSiteStatus } | null {
  const v = s.services.find((x) => x.id === serviceId), cus = v && s.customers.find((c) => c.id === v.customerId);
  if (!v || !cus || v.product !== "webHosting") return null;
  const ws = workloadsOf(s, serviceId);
  const hacked = ws.some((w) => w.clusterId && s.security.hacked.includes(w.clusterId));
  const status: CustomerSiteStatus = hacked || s.sites.defaced.includes(serviceId) ? "defaced"
    : v.endedAt !== null || !serviceOnline(s, serviceId) ? "down"
    : ws.some((w) => slowHost(s, w, s.clusters.find((c) => c.id === w.clusterId))) ? "slow" : "up";
  return { title: cus.name, blurb: `site.blurb.${cus.profile}`, status };
}
