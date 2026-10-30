import { reprice } from "../30-customers/pricing";
import type { GameState } from "../50-state";
import { loseRequest } from "../30-market/sales";
import { declineReason, mailRequest } from "../30-market/orders";
import type { ActionResult } from "./hardware";
import { logActivity } from "../47-staff/activity";

const fail = (error: string): ActionResult => ({ ok: false, error });
export function decline(s: GameState, requestId: string): ActionResult {
  const r = s.sales.requests.find((x) => x.id === requestId);
  if (!r || !["open", "countered", "refused"].includes(r.status)) return fail("error.unknownRequest");
  mailRequest(s, r.id, `decline.${declineReason(s, r)}`);
  loseRequest(s, s.sales.requests.find((x) => x.id === requestId)!, "declined", "lost.declined");
  return { ok: true };
}

export function changePrice(s: GameState, serviceId: string, monthly: number): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.endedAt !== null) return fail("error.unknownService");
  if (v.period !== "hour") return fail("error.yearlyPrice");
  if (!Number.isFinite(monthly) || monthly <= 0) return fail("error.quotePrice");
  const price = Math.round(monthly * 100) / 100;
  if (Math.abs(price - v.price * 730) >= 0.005) {
    reprice(s, v, price);
    logActivity(s, { customerId: v.customerId, serviceId: v.id, by: null, key: "activity.price", params: { price }, minutes: 0 });
  }
  return { ok: true };
}
