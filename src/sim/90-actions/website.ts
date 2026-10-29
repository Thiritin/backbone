import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { hasOrderForm } from "../80-business/marketing";
import { lineBlocker, SITE_LINES } from "../80-business/website";
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

// Sells a line's packages through the order form, or stops; orders on a line without packages ask for their own resources.
export function setPackages(s: GameState, p: Product, on: boolean): ActionResult {
  if (!SITE_LINES.includes(p)) return { ok: false, error: "error.unknownSiteLine" };
  if (on && !hasOrderForm(s)) return { ok: false, error: "error.needsOrderForm" };
  const lines = s.marketing.packages.filter((x) => x !== p);
  s.marketing = { ...s.marketing, packages: on ? [...lines, p] : lines };
  return { ok: true, id: p };
}

// Stops or resumes taking orders by email; with them off, only the order form takes orders.
export function setEmailOrders(s: GameState, on: boolean): ActionResult {
  if (!on && !hasOrderForm(s)) return { ok: false, error: "error.needsOrderForm" };
  s.marketing = { ...s.marketing, emailOrders: on };
  return { ok: true };
}
