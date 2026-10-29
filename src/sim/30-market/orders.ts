// GDD, Where requests come from: standard orders arrive as order emails in Support until the order form takes them in directly.
// Numbers in economy.md, Orders by email.
import { hashRng, rand } from "../00-core/rng";
import { LINE_NAME, offerPrice, specText } from "./spec";
import { applyStep, isStep } from "./manual";
import { PRODUCTS } from "../10-catalog/products";
import { inUs } from "../20-world/datacenters";
import type { Profile } from "../30-customers/customers";
import { profileStats, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { phpNeeded } from "../60-infra/php";
import { discountFor, hasOrderForm } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "../90-actions/hardware";
import { missingFor, needFor, referenceFor, REQUEST_HOURS, requestName, senderFor, type SalesRequest } from "./market";
import { addRequest, editRequest, fulfil, loseRequest, nextSpec, say, targetFor } from "./sales";
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

// email: the customer writes an order email, worked step by step at a price set by hand; otherwise the order form takes
// the spec at the player's rates and places it at once.
export function orderLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile), email = emailFor(s)): SalesRequest {
  const who = senderFor(s.rng, profile, false, inUs(city)), variant = Math.floor(rand(s.rng) * 2);
  const key = s.nextId, spec = nextSpec(s, need), reference = referenceFor(s, profile, need.product, spec, need.sla), discount = discountFor(s, profile);
  // One in three web customers already owns the domain they name.
  const owned = email && need.product === "webHosting" && rand(hashRng(s.seed, key, 229)) < 1 / 3;
  const price = email ? reference : offerPrice(s, need.product, spec, need.sla);
  let r = addRequest(s, {
    kind: "order", customerId: null, ...who, profile, city, product: need.product, spec, sla: need.sla, reference, discount, budget: 1, shady: false,
    serviceId: null, ticketId: null, deadline: s.hour + REQUEST_HOURS,
  }, `order.msg.${need.product}.${variant}`);
  r = editRequest(s, r.id, (x) => ({
    quote: Math.round(price * (1 - discount) * 100) / 100,
    ...(email && { owned, thread: x.thread.map((m, i) => (i ? m : { ...m, params: { ...m.params, owned: owned ? 1 : 0 } })) }),
  }));
  const params = { name: requestName(r), spec: specText(r.product, spec) };
  if (!email) {
    const done = !missingFor(s, r).length && targetFor(s, r) ? place(s, r) : null;
    if (done?.ok) {
      events.push({ app: "Customers", key: "event.orderPlaced", params: { ...params, price: r.quote! } });
      return r;
    }
    // Without email orders, an order the form cannot place goes elsewhere.
    if (!s.marketing.emailOrders) {
      loseRequest(s, r, "lost", done?.reason ?? "lost.noCapacity", done?.params ?? { city: r.city });
      return r;
    }
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

// With the order form and email orders on, this share of order leads still writes an email.
export const EMAIL_SHARE = 0.25;
// Whether the next order lead writes an email: always before the order form, never with email orders off.
export const emailFor = (s: GameState): boolean =>
  !hasOrderForm(s) || (s.marketing.emailOrders && rand(hashRng(s.seed, s.hour, s.nextId, 233)) < EMAIL_SHARE);

// Why a request is declined, in the customer's terms: the product is not sold there, there is no room, or neither.
export const declineReason = (s: GameState, r: SalesRequest): string =>
  missingFor(s, r).length ? "notOffered" : !targetFor(s, r) ? "noCapacity" : "busy";

// Our email on a request's thread, worded by the seed.
export function mailRequest(s: GameState, id: string, what: string, by?: string, extra: Record<string, string | number> = {}): void {
  const r = s.sales.requests.find((x) => x.id === id)!;
  const params = { ...companyParams(s), name: r.contact, spec: specText(r.product, r.spec), line: LINE_NAME[r.product], city: r.city, domain: r.domain ?? "", price: r.quote ?? r.reference, hour: s.hour, ...extra };
  say(s, r.id, "you", variant(s, what, Number(r.id.slice(3)) || 0, r.thread.length), params, by);
}

// Applies a queued accept or decline; the support tick calls this once the work time has passed.
export function applyOrderWork(s: GameState, t: Ticket, action: string, by?: string): SimEvent | null {
  if (isStep(action)) return applyStep(s, t, action, by);
  const r = orderOf(s, t);
  // A confirmed custom order waits on payment as "quoted" and can still be declined.
  if (!r || !["open", "quoted"].includes(r.status)) {
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
    return { app: "Support", key: "event.orderFailed", params: { name: requestName(r), spec: specText(r.product, r.spec), reason: done.reason!, ...done.params } };
  }
  const won = s.sales.requests.find((x) => x.id === r.id)!;
  Object.assign(t, { status: "resolved", outcome: "accepted", updatedAt: s.hour, customerId: won.customerId, serviceId: won.serviceId });
  return null;
}

export function declineOrder(s: GameState, t: Ticket): void {
  applyOrderWork(s, t, "reject");
  t.unread = false;
}
