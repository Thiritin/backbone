import { bump, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { quotaCapMb, quotaFits, quotaKind, quotaOf, quotaUsers } from "../60-infra/netsvc-quota";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Sets the quota per mailbox or per cloud user. Raising answers a customer whose quota is full; lowering below the stored data
// cuts it down and costs the customer happiness.
export function setQuota(s: GameState, serviceId: string, perUserMb: number): ActionResult {
  const v = s.services.find((x) => x.id === serviceId && x.endedAt === null);
  if (!v || !quotaKind(v)) return fail("error.unknownService");
  if (!Number.isFinite(perUserMb) || perUserMb < 1) return fail("error.quotaInvalid");
  const cur = quotaOf(s, v);
  if (perUserMb > cur.perUserMb && !quotaFits(s, v, perUserMb)) return fail("error.quotaNoDisk");
  const cap = perUserMb * quotaUsers(v), cust = s.customers.find((c) => c.id === v.customerId)!;
  let usedMb = cur.usedMb;
  if (usedMb > cap) {
    usedMb = cap;
    s.customers = s.customers.map((c) => { if (c.id !== cust.id) return c; const n = { ...c }; bump(n, -3); return n; });
  }
  s.netsvc = { ...s.netsvc, quotas: { ...s.netsvc.quotas, [v.id]: { perUserMb, usedMb } } };
  if (usedMb < 0.95 * quotaCapMb(s, v)) {
    s.tickets = s.tickets.map((t) => (t.serviceId === v.id && (t.topic === "mailFull" || t.topic === "quotaFull") && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
  }
  return { ok: true };
}
