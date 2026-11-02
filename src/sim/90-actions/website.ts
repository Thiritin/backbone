import { yearOf } from "../00-core/time";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { owns, type SiteHost } from "../80-business/marketing";
import { shopActive } from "../80-business/shop";
import { DESIGN_DAYS, designQuote, generationOf, lineBlocker, SITE_BUILD_HOURS, SITE_LINES, siteBuilt, siteRoom } from "../80-business/website";
import type { ActionResult } from "./hardware";

// Lists or removes a product line on the website; removing one stops new requests and keeps existing customers.
export function setLine(s: GameState, p: Product, on: boolean): ActionResult {
  if (!SITE_LINES.includes(p)) return { ok: false, error: "error.unknownSiteLine" };
  const blocker = on ? lineBlocker(s, p) : null;
  if (blocker) return { ok: false, error: blocker };
  if (on && !s.marketing.launched) return { ok: false, error: "error.needsLaunch" };
  // Web hosting takes its SSL add-on with it.
  const lines = s.marketing.lines.filter((x) => x !== p && (on || p !== "webHosting" || x !== "ssl"));
  s.marketing = { ...s.marketing, lines: on ? [...lines, p] : lines };
  return { ok: true, id: p };
}

// Switches custom requests for a listed line on or off.
export function setCustom(s: GameState, p: Product, on: boolean): ActionResult {
  if (!SITE_LINES.includes(p)) return { ok: false, error: "error.unknownSiteLine" };
  const custom = s.marketing.custom.filter((x) => x !== p);
  s.marketing = { ...s.marketing, custom: on ? [...custom, p] : custom };
  return { ok: true, id: p };
}

// Starts writing the first site by hand; it costs nothing and is ready after three days.
export function buildSite(s: GameState): ActionResult {
  if (s.marketing.siteReady !== null) return { ok: false, error: "error.siteStarted" };
  s.marketing = { ...s.marketing, siteReady: s.hour + SITE_BUILD_HOURS };
  return { ok: true };
}

// Puts the finished site online under the company domain on the chosen host.
export function launchSite(s: GameState, host: SiteHost): ActionResult {
  if (s.marketing.launched) return { ok: false, error: "error.siteLaunched" };
  if (!siteBuilt(s)) return { ok: false, error: "error.siteNotBuilt" };
  if (!s.company.domain) return { ok: false, error: "error.needsDomain" };
  const r = setSiteHost(s, host);
  if (r.ok) s.marketing = { ...s.marketing, launched: true };
  return r;
}

// Stops or resumes taking orders by email; with them off, only the shop takes orders.
export function setEmailOrders(s: GameState, on: boolean): ActionResult {
  if (!on && !shopActive(s)) return { ok: false, error: "error.needsShop" };
  s.marketing = { ...s.marketing, emailOrders: on };
  return { ok: true };
}

// Lets leads ask for products you do not sell, or stops them.
export function setCustomRequests(s: GameState, on: boolean): ActionResult {
  s.marketing = { ...s.marketing, customRequests: on };
  return { ok: true };
}

// Moves the company site to the rented host or to an own panel host with room for it; moving is instant and free.
export function setSiteHost(s: GameState, host: SiteHost): ActionResult {
  if (host.kind === "own") {
    const c = s.clusters.find((x) => x.id === host.clusterId);
    if (!c) return { ok: false, error: "error.unknownCluster" };
    if (c.kind !== "panel" || !c.panel) return { ok: false, error: "error.siteHostPanel" };
    if (!siteRoom(s, c).fits) return { ok: false, error: "error.siteHostNoRoom" };
  }
  s.marketing = { ...s.marketing, siteHost: host.kind === "own" ? { kind: "own", clusterId: host.clusterId } : { kind: "rented" }, siteOutage: false };
  return { ok: true };
}

// Orders a new design from the agency at its price for the year and the company level; it goes live DESIGN_DAYS later.
export function redesign(s: GameState): ActionResult {
  if (!owns(s, "website")) return { ok: false, error: "error.needsWebsite" };
  if (s.marketing.designReady) return { ok: false, error: "error.designOrdered" };
  const price = designQuote(s);
  if (s.cash < price) return { ok: false, error: "error.noCash" };
  s.cash = Math.round((s.cash - price) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.redesign", params: {}, amount: -price }];
  s.marketing = { ...s.marketing, designReady: { hour: s.hour + DESIGN_DAYS * 24, year: generationOf(yearOf(s.hour)) } };
  return { ok: true };
}
