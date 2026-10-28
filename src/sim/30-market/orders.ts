// GDD, Where requests come from: standard orders arrive as order emails in Support until the order form takes them in directly.
// Numbers in economy.md, Orders by email.
import { rand } from "../00-core/rng";
import { PRODUCTS } from "../10-catalog/products";
import type { Profile } from "../30-customers/customers";
import { profileStats, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { phpNeeded } from "../60-infra/php";
import { discountFor, hasOrderForm } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "../90-actions/hardware";
import { missingFor, needFor, planName, referenceFor, REQUEST_HOURS, requestName, senderFor, type SalesRequest } from "./market";
import { addRequest, editRequest, fulfil, loseRequest, say, targetFor } from "./sales";
import { companyParams, variant } from "../40-support/replies";

// Without an order, the first one comes from a friend's recommendation within this many days.
export const FIRST_ORDER_DAYS = 14;

// A basic SLA from a profile without a big budget: a standard product off the shelf. Everything else is a sales request.
export const isStandard = (profile: Profile, sla: SalesRequest["sla"]): boolean => sla === "basic" && profileStats(profile).budget !== "high";

export const orderOf = (s: GameState, t: Ticket): SalesRequest | undefined => s.sales.requests.find((r) => r.kind === "order" && r.ticketId === t.id);
export const orderQueued = (s: GameState, r: SalesRequest): boolean => r.kind === "order" && s.tickets.some((t) => t.id === r.ticketId && t.work !== null);

// Why accepting the order would fail right now, or null.
export function orderError(s: GameState, t: Ticket): string | null {
  const r = orderOf(s, t);
  if (!r || r.status !== "open") return "error.unknownRequest";
  if (missingFor(s, r).length) return "error.orderNotOffered";
  return targetFor(s, r) ? null : PRODUCTS[r.product].runsOn === "server" ? "error.noFreeServer" : "error.noCapacity";
}

// Creates the customer and sets up the service at the order's price; a too old PHP or a full cluster loses the order.
function place(s: GameState, r: SalesRequest): ActionResult & { reason?: string; params?: Record<string, string | number> } {
  const php = r.product === "webHosting" ? phpNeeded(s, r.id, targetFor(s, r)?.clusterId ?? null) : null;
  if (php) return { ok: false, error: "lost.oldPhp", reason: "lost.oldPhp", params: { version: php } };
  const done = fulfil(s, r);
  if (!done.ok) return { ...done, reason: "lost.noCapacity", params: { city: r.city } };
  editRequest(s, r.id, () => ({ status: "won", serviceId: done.id ?? null }));
  return done;
}

export function orderLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile)): SalesRequest {
  const who = senderFor(s.rng, profile), variant = Math.floor(rand(s.rng) * 2);
  const reference = referenceFor(s, profile, need.product, need.plan, need.sla), discount = discountFor(s, profile);
  let r = addRequest(s, {
    kind: "order", customerId: null, ...who, profile, city, ...need, reference, discount, budget: 1, shady: false, serviceId: null, ticketId: null,
    deadline: s.hour + REQUEST_HOURS,
  }, `order.msg.${need.product}.${variant}`);
  r = editRequest(s, r.id, () => ({ quote: Math.round(reference * (1 - discount) * 100) / 100 }));
  const params = { name: requestName(r), plan: planName(r) };
  if (hasOrderForm(s) && !missingFor(s, r).length && targetFor(s, r) && place(s, r).ok) {
    events.push({ app: "Customers", key: "event.orderPlaced", params: { ...params, price: r.quote! } });
    return r;
  }
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "order", topic: need.product, status: "open",
    createdAt: s.hour, dueAt: r.deadline, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null,
  };
  s.tickets = [...s.tickets, t];
  r = editRequest(s, r.id, () => ({ ticketId: t.id }));
  if (!missingFor(s, r).length) events.push({ app: "Support", key: "event.order", params });
  return r;
}

export function firstOrder(s: GameState, events: SimEvent[]): void {
  const day = Math.floor(s.hour / 24);
  if (day >= FIRST_ORDER_DAYS || !s.customers.some((c) => c.habit === "friend") || s.sales.requests.some((r) => r.kind === "order")) return;
  if (rand(s.rng) < 1 / (FIRST_ORDER_DAYS - day)) orderLead(s, "private", s.locations[0]?.city ?? "Frankfurt", events);
}

// Why a request is declined, in the customer's terms: the product is not sold there, there is no room, or neither.
export const declineReason = (s: GameState, r: SalesRequest): string =>
  missingFor(s, r).length ? "notOffered" : !targetFor(s, r) ? "noCapacity" : "busy";

// Our email on a request's thread, worded by the seed.
export function mailRequest(s: GameState, id: string, what: string, by?: string): void {
  const r = s.sales.requests.find((x) => x.id === id)!;
  const params = { ...companyParams(s), name: r.contact, plan: planName(r), city: r.city, domain: r.domain ?? "", price: r.quote ?? r.reference, hour: s.hour };
  say(s, r.id, "you", variant(s, what, Number(r.id.slice(3)) || 0, r.thread.length), params, by);
}

// Applies a queued accept or decline; the support tick calls this once the work time has passed.
export function applyOrderWork(s: GameState, t: Ticket, action: string, by?: string): SimEvent | null {
  const r = orderOf(s, t);
  if (!r || r.status !== "open") {
    Object.assign(t, { status: "closed", updatedAt: s.hour });
    return null;
  }
  // The ticket is settled first, so loseRequest finds it final and leaves it alone.
  if (action !== "accept") {
    mailRequest(s, r.id, `decline.${declineReason(s, r)}`, by);
    Object.assign(t, { status: "closed", outcome: "declined", updatedAt: s.hour });
    loseRequest(s, r, "declined", "lost.declined");
    return null;
  }
  const done = place(s, r);
  mailRequest(s, r.id, done.ok ? "accept" : "failed", by);
  if (!done.ok) {
    Object.assign(t, { status: "closed", outcome: "failed", updatedAt: s.hour });
    loseRequest(s, r, "lost", done.reason!, done.params);
    return { app: "Support", key: "event.orderFailed", params: { name: requestName(r), plan: planName(r), reason: done.reason!, ...done.params } };
  }
  const won = s.sales.requests.find((x) => x.id === r.id)!;
  Object.assign(t, { status: "resolved", outcome: "accepted", updatedAt: s.hour, customerId: won.customerId, serviceId: won.serviceId });
  return null;
}

export function declineOrder(s: GameState, t: Ticket): void {
  applyOrderWork(s, t, "reject");
  t.unread = false;
}
