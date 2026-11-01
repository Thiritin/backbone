// GDD, Where requests come from: standard orders arrive as order emails in Support until the order form takes them in directly.
// Numbers in economy.md, Orders by email.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { CYCLE_MONTHS } from "../10-catalog/cycles";
import { drawCycle, startTerm, termLine, termPrice } from "./cycles";
import { LINE_NAME, offerPrice, setupFee, specText } from "./spec";
import { applyStep, AUTOMATION, canAutomate, isStep, issueInvoice, ORDER_PAY_DAYS } from "./manual";
import { marketPrice, PRODUCTS, type Spec } from "../10-catalog/products";
import { inUs } from "../20-world/datacenters";
import type { Product, Profile } from "../30-customers/customers";
import { authCode } from "../30-customers/registry";
import { profileStats, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { InvoiceLine } from "../45-billing/billing";
import { phpNeeded } from "../60-infra/php";
import { discountFor, hasOrderForm } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "../90-actions/hardware";
import { missingFor, needFor, referenceFor, REQUEST_HOURS, requestName, senderFor, type SalesRequest } from "./market";
import { addRequest, cancelShopOrder, editRequest, fulfil, loseRequest, nextSpec, say, targetFor } from "./sales";
import { deployable, hasModule, moduleFor, shopActive, shopStocked, takeStock, type ShopProduct } from "../80-business/shop";
import { productCycles, takeProductStock } from "../80-business/portal";
import { companyParams, variant } from "../40-support/replies";
import { failsScreen, reviewing, rollFraud, screening } from "../45-billing/fraud";

// Without an order, the first one comes from a friend's recommendation within this many days of the friends joining.
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
  if (r.shop) s.services = s.services.map((v) => (v.id === done.id ? { ...v, viaShop: true } : v));
  return done;
}

// email: the customer writes an order email and gets a quote first; otherwise the order form takes the spec at the player's
// rates, which counts as the accepted quote. With automation switched on the form places it at once, otherwise it waits in
// Support like an email order. A shop takes one unit of the line's stock.
// lead marks a sales lead: an email in its own words (key), with the budget it brings and the shady flag, owning no domain.
export interface LeadTraits { budget: number; shady?: boolean; key?: string }
export function orderLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile, yearOf(s.hour)), email = emailFor(s), given?: Spec, lead?: LeadTraits, pick?: ShopProduct): SalesRequest {
  const who = senderFor(s.rng, profile, !!lead?.shady, inUs(city)), variant = Math.floor(rand(s.rng) * 2);
  const key = s.nextId, spec = given ?? nextSpec(s, need, profile), reference = referenceFor(s, profile, need.product, spec, need.sla), discount = discountFor(s, profile);
  // One in three web customers already owns the domain they name.
  const owned = !lead && email && need.product === "webHosting" && rand(hashRng(s.seed, key, 229)) < 1 / 3;
  const shop = !email && shopStocked(s);
  const fraud = !lead && rollFraud(s, key, need.product, yearOf(s.hour), email);
  const screened = !lead && screening(s);
  if (screened) s.screenChecks++;
  const declined = screened && failsScreen(s, key, fraud);
  if (shop && !declined) pick ? takeProductStock(s, pick.id) : takeStock(s, need.product);
  const price = email ? reference : offerPrice(s, need.product, spec, need.sla);
  const cycle = email ? "monthly" : drawCycle(s, profile, need.product, rand(hashRng(s.seed, key, 281)), pick && productCycles(s, pick)), months = CYCLE_MONTHS[cycle];
  const budget = lead ? lead.budget : email ? ORDER_BUDGET[0] + (ORDER_BUDGET[1] - ORDER_BUDGET[0]) * rand(hashRng(s.seed, key, 263)) : 1;
  let r = addRequest(s, {
    kind: "order", customerId: null, ...who, profile, city, product: need.product, spec, sla: need.sla, reference, discount, budget, shady: !!lead?.shady, ...(fraud && { fraud }),
    serviceId: null, ticketId: null, deadline: s.hour + REQUEST_HOURS,
  }, lead ? lead.key ?? `sales.msg.${need.product}.${variant}` : `order.msg.${need.product}.${variant}`);
  r = editRequest(s, r.id, (x) => ({
    quote: pick ? Math.round((pick.prices[cycle]! * (1 - discount) / months) * 100) / 100 : Math.round((termPrice(s, price * (1 - discount), cycle) / months) * 100) / 100,
    ...(pick && { productId: pick.id, setup: pick.setup, ...(pick.packageName && { pkg: pick.packageName }) }),
    ...(months > 1 && { cycle }),
    ...(shop && { shop: true }),
    ...(email && { owned, thread: x.thread.map((m, i) => (i ? m : { ...m, params: { ...m.params, owned: owned ? 1 : 0, ...(owned && { auth: authCode(s.seed, x.id) }) } })) }),
  }));
  if (declined) {
    loseRequest(s, r, "declined", "lost.declined");
    return r;
  }
  const params = { name: requestName(r), spec: specText(r.product, spec) };
  // The form places an order itself only through the module (or custom script) for the software it lands on.
  const auto = !email && s.autoOrders && pick?.setupMode !== "accept" && pick?.setupMode !== "off" && canAutomate(s) && !reviewing(s, need.product), target = auto && !missingFor(s, r).length ? targetFor(s, r) : null;
  if (auto && (!target || (hasModule(s, moduleFor(s, r.product, target.clusterId)) && deployable(s, target.clusterId)))) {
    const done = target ? place(s, r) : null;
    if (done?.ok) {
      formInvoice(s, r.id);
      events.push({ app: "Customers", key: "event.orderPlaced", params: { ...params, price: r.quote! } });
      return r;
    }
    // Without email orders, an order the form cannot place goes elsewhere.
    if (shop) {
      cancelShopOrder(s, r);
      return r;
    }
    if (!s.marketing.emailOrders) {
      loseRequest(s, r, "lost", done?.reason ?? "lost.noCapacity", done?.params ?? { city: r.city });
      return r;
    }
  }
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "order", topic: need.product, status: "open",
    createdAt: s.hour, dueAt: r.deadline, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, t];
  r = editRequest(s, r.id, () => ({ ticketId: t.id, ...(!email && { form: true, status: "accepted" as const }) }));
  if (missingFor(s, r).length) return r;
  // Automation quotes an email order at the line's own rate when there is room for it.
  if (email && !lead && s.autoOrders && canAutomate(s) && targetFor(s, r)) {
    r = editRequest(s, r.id, () => ({ quote: Math.round(emailRate(s, need.product, spec, need.sla) * (1 - discount) * 100) / 100 }));
    if (!applyStep(s, s.tickets.find((x) => x.id === t.id)!, "quote", AUTOMATION)) {
      events.push({ app: "Support", key: "event.orderQuoted", params: { ...params, ticketId: t.id, price: r.quote! } });
      return r;
    }
  }
  events.push({ app: "Support", key: "event.order", params: { ...params, ticketId: t.id } });
  return r;
}

// The monthly rate an email order is quoted: the configurable option rates with a shop, the market's before one.
export const emailRate = (s: GameState, product: Product, spec: Spec, sla: SalesRequest["sla"]): number =>
  shopActive(s) ? offerPrice(s, product, spec, sla) : marketPrice(product, spec, yearOf(s.hour), sla);

// The order form bills at once: the line's setup fee and the first term, which the monthly run then skips.
function formInvoice(s: GameState, id: string): void {
  const r = s.sales.requests.find((x) => x.id === id)!, label = s.services.find((v) => v.id === r.serviceId)?.label ?? requestName(r), fee = r.setup ?? setupFee(s, r.product);
  const lines: InvoiceLine[] = [
    ...(fee > 0 ? [{ serviceId: null, key: "invoice.line.setupFee", params: { label }, amount: fee }] : []),
    termLine(r, label),
  ];
  issueInvoice(s, r.customerId!, lines, ORDER_PAY_DAYS - 1);
  s.services = s.services.map((v) => (v.id === r.serviceId ? startTerm(s, v, r.cycle) : v));
}

export function firstOrder(s: GameState, events: SimEvent[]): void {
  const friend = s.customers.find((c) => c.habit === "friend"), day = friend ? Math.floor((s.hour - friend.since) / 24) : 0;
  if (!friend || day >= FIRST_ORDER_DAYS || s.sales.requests.some((r) => r.kind === "order")) return;
  if (rand(s.rng) < 1 / (FIRST_ORDER_DAYS - day)) orderLead(s, "private", s.locations[0]?.city ?? "Frankfurt", events);
}

// An email customer weighs the quote against a budget like a sales lead does; a standard order is a shelf product, so
// the budgets sit in the upper half of a sales lead's range and a quote at the market reference is mostly taken.
export const ORDER_BUDGET: [number, number] = [1.1, 1.25];

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
  if (!r || !["open", "quoted", "countered", "refused", "accepted"].includes(r.status)) {
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
  if (!done.ok && r.shop) {
    Object.assign(t, { status: "closed", outcome: "failed", updatedAt: s.hour });
    cancelShopOrder(s, r);
    return null;
  }
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
