import { rand } from "../00-core/rng";
import { reprice } from "../30-customers/pricing";
import type { GameState } from "../50-state";
import { missingFor } from "../30-market/market";
import { editRequest, loseRequest, say } from "../30-market/sales";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
// The customer answers 4 to 24 hours after a quote, 2 hours after you meet their counter-offer.
const REPLY_MIN = 4, REPLY_SPREAD = 20, COUNTER_REPLY = 2;

// Sends a monthly price for a request; the customer replies later.
export function quote(s: GameState, requestId: string, monthly: number): ActionResult {
  const r = s.sales.requests.find((x) => x.id === requestId);
  if (!r || !["open", "countered", "refused"].includes(r.status)) return fail("error.unknownRequest");
  if (!Number.isFinite(monthly) || monthly <= 0 || monthly > 100 * r.reference) return fail("error.quotePrice");
  if (missingFor(s, r).length) return fail("error.requestMissing");
  const price = Math.round(monthly * 100) / 100;
  const met = r.counter !== null && price <= r.counter;
  editRequest(s, r.id, (x) => ({
    status: "quoted", quote: price, attempts: x.attempts + 1, replyAt: s.hour + (met ? COUNTER_REPLY : REPLY_MIN + Math.floor(rand(s.rng) * REPLY_SPREAD)),
  }));
  say(s, r.id, "you", "sales.you.quote", { price });
  return { ok: true, id: r.id };
}

export function decline(s: GameState, requestId: string): ActionResult {
  const r = s.sales.requests.find((x) => x.id === requestId);
  if (!r || !["open", "countered", "refused"].includes(r.status)) return fail("error.unknownRequest");
  say(s, r.id, "you", "sales.you.decline");
  loseRequest(s, s.sales.requests.find((x) => x.id === requestId)!, "declined", "lost.declined");
  return { ok: true };
}

export function changePrice(s: GameState, serviceId: string, monthly: number): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.endedAt !== null) return fail("error.unknownService");
  if (v.period !== "hour") return fail("error.yearlyPrice");
  if (!Number.isFinite(monthly) || monthly <= 0) return fail("error.quotePrice");
  const price = Math.round(monthly * 100) / 100;
  if (Math.abs(price - v.price * 730) >= 0.005) reprice(s, v, price);
  return { ok: true };
}
