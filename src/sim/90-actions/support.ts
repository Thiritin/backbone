import type { GameState } from "../50-state";
import { ACTIONS, bump, cancelCustomer, canEscalate, isFinal, MINUTES, TEMPLATES, type Ticket, type TicketAction, type Work } from "../40-support/tickets";
import { hashRng } from "../00-core/rng";
import { ignoreNotice } from "../40-support/notices";
import { declineOrder, orderError } from "../30-market/orders";
import type { ActionResult } from "./hardware";
import { logActivity } from "../47-staff/activity";
import { sendAction } from "../40-support/replies";

const fail = (error: string): ActionResult => ({ ok: false, error });

type Found = { t: Ticket } | { error: ActionResult };

export function find(s: GameState, id: string): Found {
  const t = s.tickets.find((x) => x.id === id);
  if (!t) return { error: fail("error.unknownTicket") };
  if (isFinal(t)) return { error: fail("error.ticketDone") };
  if (t.work) return { error: fail("error.ticketBusy") };
  return { t };
}

// The player works one task at a time, so each reply or action starts when the previous one ends.
export function queue(s: GameState, t: Ticket, op: Work["op"], arg: string, minutes = MINUTES[t.kind]): ActionResult {
  const start = Math.max(s.playerBusyUntil, s.hour * 60);
  s.playerBusyUntil = start + minutes;
  t.work = { op, arg, doneAt: s.playerBusyUntil };
  t.unread = false;
  logActivity(s, { customerId: t.customerId, serviceId: t.serviceId, by: null, key: `activity.${op}`, params: { kind: t.kind, arg }, minutes });
  return { ok: true, id: t.id };
}

export function readTicket(s: GameState, id: string): ActionResult {
  const t = s.tickets.find((x) => x.id === id);
  if (!t) return fail("error.unknownTicket");
  t.unread = false;
  return { ok: true, id };
}

// Reserves a ticket for one support agent, who answers it before the rest of the queue; null hands it back.
export function assignTicket(s: GameState, id: string, employeeId: string | null): ActionResult {
  const t = s.tickets.find((x) => x.id === id);
  if (!t) return fail("error.unknownTicket");
  if (isFinal(t)) return fail("error.ticketDone");
  if (employeeId !== null && !s.staff.some((e) => e.id === employeeId && e.role === "support")) return fail("error.unknownEmployee");
  t.assignee = employeeId;
  return { ok: true, id };
}

export function replyTicket(s: GameState, id: string, template: string): ActionResult {
  const f = find(s, id);
  if ("error" in f) return f.error;
  if (f.t.status !== "open") return fail("error.ticketNotOpen");
  if (!TEMPLATES[f.t.kind].includes(template)) return fail("error.unknownTemplate");
  return queue(s, f.t, "reply", template);
}

// Without an action, resolving confirms an answered ticket; with one, it queues that action.
export function resolveTicket(s: GameState, id: string, action?: TicketAction): ActionResult {
  const f = find(s, id);
  if ("error" in f) return f.error;
  if (action) {
    if (!ACTIONS[f.t.kind].includes(action)) return fail("error.unknownTicketAction");
    if ((action === "forward" || action === "takedown") && !f.t.customerId) return fail("error.notHosted");
    const order = action === "accept" ? orderError(s, f.t) : null;
    if (order) return fail(order);
    if (action === "revert" && (f.t.topic !== "price" || s.services.find((v) => v.id === f.t.serviceId)?.before === undefined)) return fail("error.unknownTicketAction");
    return queue(s, f.t, "resolve", action);
  }
  if (f.t.status !== "waiting") return fail("error.ticketNotAnswered");
  Object.assign(f.t, { status: "resolved", updatedAt: s.hour });
  bump(s.customers.find((c) => c.id === f.t.customerId)!, 5);
  return { ok: true, id };
}

export function escalateTicket(s: GameState, id: string): ActionResult {
  const f = find(s, id);
  if ("error" in f) return f.error;
  if (!canEscalate(f.t.kind)) return fail("error.cannotEscalate");
  if (f.t.status !== "open") return fail("error.ticketNotOpen");
  return queue(s, f.t, "escalate", "");
}

// Closing an unanswered ticket counts as a wrong answer; closing a cancellation processes it.
export function closeTicket(s: GameState, id: string): ActionResult {
  const f = find(s, id);
  if ("error" in f) return f.error;
  // Closing a notice or legal request ignores it.
  if (f.t.notice) {
    if (f.t.kind === "notice") ignoreNotice(s, f.t, hashRng(s.seed, s.hour, Number(f.t.id.slice(3)) || 0, 94));
    else Object.assign(f.t, { status: "closed", outcome: "ignored", updatedAt: s.hour, unread: false });
    return { ok: true, id };
  }
  if (f.t.kind === "order") {
    declineOrder(s, f.t);
    return { ok: true, id };
  }
  const c = s.customers.find((x) => x.id === f.t.customerId)!;
  if (f.t.kind === "cancellation") {
    sendAction(s, f.t, c, "cancel");
    cancelCustomer(s, c);
    f.t.outcome = "cancelled";
  } else if (f.t.status === "open") bump(c, -10);
  Object.assign(f.t, { status: "closed", updatedAt: s.hour, unread: false });
  return { ok: true, id };
}
