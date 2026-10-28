import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
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
