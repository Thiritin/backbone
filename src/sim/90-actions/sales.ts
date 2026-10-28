import { chance, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { marketPrice } from "../10-catalog/products";
import { bump, createTicket, isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { missingFor, OFFER } from "../30-market/market";
import { editRequest, loseRequest, say } from "../30-market/sales";
import type { ActionResult } from "./hardware";
import { logActivity } from "../47-staff/activity";

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

// economy.md, Happiness and churn: −0.5 happiness per 1% of increase (at most −30), +0.2 per 1% of decrease (at most +10).
// A price more than 1.3× the market reference makes a cancellation likely, certain from 1.7×.
export const RAISE_PENALTY = 0.5, CUT_BONUS = 0.2, CANCEL_FROM = 1.3, CANCEL_SPAN = 0.4;

export function changePrice(s: GameState, serviceId: string, monthly: number): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.endedAt !== null) return fail("error.unknownService");
  if (v.period !== "hour") return fail("error.yearlyPrice");
  if (!Number.isFinite(monthly) || monthly <= 0) return fail("error.quotePrice");
  const c = s.customers.find((x) => x.id === v.customerId)!;
  const old = v.price * 730, price = Math.round(monthly * 100) / 100, pct = (100 * (price - old)) / old;
  if (Math.abs(price - old) < 0.005) return { ok: true };
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: price / 730 } : x));
  s.customers = s.customers.map((x) => (x.id === c.id ? { ...x } : x));
  const cust = s.customers.find((x) => x.id === c.id)!;
  bump(cust, pct > 0 ? -Math.min(30, RAISE_PENALTY * pct) : Math.min(10, -CUT_BONUS * pct));
  logActivity(s, { customerId: c.id, serviceId: v.id, by: null, key: "activity.price", params: { price }, minutes: 0 });
  const ref = marketPrice(v.product, v.plan, yearOf(s.hour), v.sla) * OFFER[profileStats(c.profile).budget];
  const over = price / ref;
  const leaving = pct > 0 && over > CANCEL_FROM && chance(s.rng, Math.min(1, (over - CANCEL_FROM) / CANCEL_SPAN));
  if (leaving && !s.tickets.some((t) => t.customerId === c.id && t.kind === "cancellation" && !isFinal(t))) createTicket(s, cust, "cancellation", v.id);
  return { ok: true };
}
