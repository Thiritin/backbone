import type { GameState } from "../50-state";
import { holdReason, isSuspended, isUnpaid, SUSPEND_HAPPINESS, type HoldReason } from "../45-billing/billing";
import { bump, createTicket, isFinal, profileStats } from "../40-support/tickets";
import { workloadsOf } from "../60-infra/cluster";
import type { ActionResult } from "./hardware";

const REASONS: HoldReason[] = ["payment", "abuse", "manual"];

const live = (s: GameState, serviceId: string) => {
  const v = s.services.find((x) => x.id === serviceId && x.endedAt === null);
  return v && { v, c: s.customers.find((c) => c.id === v.customerId && c.churnedAt === null) };
};

// Holds one account offline. The first hold on a customer costs happiness and brings a ticket, as an invoice suspension does.
export function suspendService(s: GameState, serviceId: string, reason: HoldReason = "manual"): ActionResult {
  const f = live(s, serviceId);
  if (!f || !f.c) return { ok: false, error: "error.unknownService" };
  if (!REASONS.includes(reason)) return { ok: false, error: "error.holdReason" };
  if (holdReason(s, f.v)) return { ok: true, id: serviceId };
  const { v, c } = f;
  const first = !isSuspended(s, c.id) && !s.services.some((x) => x.customerId === c.id && x.id !== v.id && s.heldServices[x.id]);
  s.heldServices = { ...s.heldServices, [v.id]: reason };
  if (reason === "abuse") {
    // Holding the account answers its open abuse notices.
    for (const t of s.tickets) if (t.kind === "notice" && t.serviceId === v.id && !isFinal(t)) Object.assign(t, { status: "resolved", updatedAt: s.hour, outcome: "takenDown" });
  }
  if (first && !(reason === "abuse" && c.shady)) {
    bump(c, -SUSPEND_HAPPINESS[profileStats(c.profile).budget]);
    createTicket(s, c, "billing").topic = "suspended";
  }
  return { ok: true, id: serviceId };
}

export function unsuspendService(s: GameState, serviceId: string): ActionResult {
  const f = live(s, serviceId);
  if (!f) return { ok: false, error: "error.unknownService" };
  const why = holdReason(s, f.v);
  if (why === "payment" && s.invoices.some((i) => i.customerId === f.v.customerId && i.suspended && isUnpaid(i))) return { ok: false, error: "error.holdPayment" };
  if (!s.heldServices[serviceId]) return { ok: true, id: serviceId };
  const { [serviceId]: _gone, ...rest } = s.heldServices;
  s.heldServices = rest;
  return { ok: true, id: serviceId };
}

// Ends one account and drops its workloads; open invoices stay open.
export function terminateService(s: GameState, serviceId: string): ActionResult {
  const f = live(s, serviceId);
  if (!f || !f.c) return { ok: false, error: "error.unknownService" };
  const gone = new Set(workloadsOf(s, serviceId).map((w) => w.id));
  s.services = s.services.map((v) => (v.id === serviceId ? { ...v, endedAt: s.hour } : v));
  s.workloads = s.workloads.filter((w) => !gone.has(w.id));
  const { [serviceId]: _held, ...rest } = s.heldServices;
  s.heldServices = rest;
  bump(f.c, -SUSPEND_HAPPINESS[profileStats(f.c.profile).budget]);
  return { ok: true, id: serviceId };
}
