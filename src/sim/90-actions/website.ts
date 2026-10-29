import { yearOf } from "../00-core/time";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { hasOrderForm, OWNED, owns, type SiteHost } from "../80-business/marketing";
import { generationOf, lineBlocker, SITE_LINES, siteRoom } from "../80-business/website";
import type { ActionResult } from "./hardware";

// Lists or removes a product line on the website; removing one stops new requests and keeps existing customers.
export function setLine(s: GameState, p: Product, on: boolean): ActionResult {
  if (!SITE_LINES.includes(p)) return { ok: false, error: "error.unknownSiteLine" };
  const blocker = on ? lineBlocker(s, p) : null;
  if (blocker) return { ok: false, error: blocker };
  const lines = s.marketing.lines.filter((x) => x !== p);
  s.marketing = { ...s.marketing, lines: on ? [...lines, p] : lines };
  return { ok: true, id: p };
}

// Stops or resumes taking orders by email; with them off, only the order form takes orders.
export function setEmailOrders(s: GameState, on: boolean): ActionResult {
  if (!on && !hasOrderForm(s)) return { ok: false, error: "error.needsOrderForm" };
  s.marketing = { ...s.marketing, emailOrders: on };
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

// A new design for the price of the web design setup, in the generation of the current year.
export function redesign(s: GameState): ActionResult {
  const { setup } = OWNED.website, generation = generationOf(yearOf(s.hour));
  if (!owns(s, "website")) return { ok: false, error: "error.needsWebsite" };
  if (s.marketing.designYear >= generation) return { ok: false, error: "error.designCurrent" };
  if (s.cash < setup) return { ok: false, error: "error.noCash" };
  s.cash = Math.round((s.cash - setup) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.redesign", params: {}, amount: -setup }];
  s.marketing = { ...s.marketing, designYear: generation };
  return { ok: true };
}
