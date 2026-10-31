// GDD, Custom orders: an order email is worked step by step, each step a reply in its thread. Quote a price and wait for the
// customer to accept, then create the customer account, confirm the order with its invoice, register or transfer the domain
// and set up the service. Numbers in economy.md, Custom orders.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Product, Service } from "../30-customers/customers";
import { DOMAIN_FEE, domainOf, register, TRANSFER_FEE } from "../30-customers/registry";
import { CERT_SHARE, offerCertificate } from "../30-customers/certificates";
import { cancelCustomer, isFinal, replyDue, type Ticket } from "../40-support/tickets";
import { DUE_DAYS, issue, rollPayStep, type Invoice, type InvoiceLine } from "../45-billing/billing";
import { ACTION_MINUTES, logActivity } from "../47-staff/activity";
import type { GameState } from "../50-state";
import { bookable, nodeUsed, workloadsOf } from "../60-infra/cluster";
import { preferredRoute, routeError, routeTarget } from "../60-infra/routes";
import type { SimEvent } from "../88-tick/tick";
import { addCustomer } from "../90-actions/customers";
import { placeService, provisionService } from "../90-actions/clusters";
import type { ActionResult } from "../90-actions/hardware";
import { setupFee, sizeOf } from "./spec";
import { missingFor, requestName, REQUEST_HOURS, type SalesRequest } from "./market";
import { mailRequest, orderOf } from "./orders";
import { answerAt, editRequest, habitFor, loseRequest, targetFor } from "./sales";
import { mailDelay } from "../80-business/mail";
import { belowFloor, bookingFor, covers, packageNamed, suggestedUsername, type PackageDef } from "../80-business/packages";
import type { Sla, Spec } from "../10-catalog/products";
import { AUTOMATION_SKILL } from "../10-catalog/research";
import { failsReview, hiddenTraits, REVIEW_MINUTES, reviewing } from "../45-billing/fraud";

export type OrderStep = "quote" | "account" | "invoice" | "domain" | "provision";
export const ORDER_STEPS: OrderStep[] = ["quote", "account", "invoice", "domain", "provision"];
export const isStep = (x: string): x is OrderStep => (ORDER_STEPS as string[]).includes(x);
const STEP_MINUTES: Record<OrderStep, number> = {
  quote: ACTION_MINUTES.orderQuote, account: ACTION_MINUTES.orderAccount, invoice: ACTION_MINUTES.orderInvoice, domain: ACTION_MINUTES.orderDomain, provision: ACTION_MINUTES.orderProvision,
};
// The package an order provisions from on the host it goes to, or undefined for a custom spec, an automatic route or a missing package.
export function packageFor(s: GameState, r: SalesRequest, route?: string): PackageDef | undefined {
  const to = route ?? r.route ?? hostFor(s, r), target = r.pkg && to && to !== "auto" ? routeTarget(s, to, r.product) : null;
  const c = target && s.clusters.find((x) => x.id === target.clusterId);
  return c && r.pkg ? packageNamed(c, r.pkg) : undefined;
}
export const stepMinutes = (step: OrderStep, s?: GameState, r?: SalesRequest): number => {
  const pkg = step === "provision" && s && r ? packageFor(s, r) : undefined;
  if (pkg && covers(pkg, r!.spec)) return ACTION_MINUTES.orderProvisionPackage;
  return STEP_MINUTES[step] + (step === "account" && s && r && reviewing(s, r.product) ? REVIEW_MINUTES : 0);
};
// A customer who pays an order on time does so within this many days, eager to get started.
export const ORDER_PAY_DAYS = 3;
const DAY = 24, MONTH = 730;
const cents = (v: number) => Math.round(v * 100) / 100;

// Thread params naming a spec's resources; "0" and "1" suffixes for the current and the requested spec of an upgrade.
export const specParams = (spec: Spec, suffix = ""): Record<string, number> => ({
  [`cpu${suffix}`]: spec.vcpu, [`ram${suffix}`]: spec.ramGb, [`disk${suffix}`]: spec.diskGb, [`traffic${suffix}`]: spec.trafficGb, [`mail${suffix}`]: spec.mailboxes, [`gpu${suffix}`]: spec.gpus ?? 0,
});

export const invoiceOf = (s: GameState, r: SalesRequest): Invoice | undefined => (r.invoiceId ? s.invoices.find((i) => i.id === r.invoiceId) : undefined);
const needsDomain = (r: SalesRequest) => r.product === "webHosting" && !!r.domain;
const domainDone = (s: GameState, r: SalesRequest) => !needsDomain(r) || domainOf(s, r.domain!)?.customerId === r.customerId;

// The sender of the steps automation runs.
export const AUTOMATION = "Automation";
export const canAutomate = (s: GameState): boolean => s.unlocks.includes(AUTOMATION_SKILL);
// The quote counts as accepted once the customer said yes or the order came through the form; an order past its account
// from an older save counts too.
export const quoteAccepted = (r: SalesRequest): boolean => r.status === "accepted" || !!r.customerId || !!r.invoiceId || !!r.serviceId;
// The best host of the order's city (routes.ts, preferredRoute): what the setup preselects, and the pick of staff, who
// cannot ask.
export const hostFor = (s: GameState, r: SalesRequest): string | null => preferredRoute(s, r.product, r.city, sizeOf(r.spec));

// Which steps the order has behind it.
export function stepsDone(s: GameState, r: SalesRequest): Record<OrderStep, boolean> {
  return { quote: quoteAccepted(r), account: !!r.customerId, invoice: !!r.invoiceId && invoiceOf(s, r)?.status !== "draft", domain: !!r.customerId && domainDone(s, r), provision: !!r.serviceId };
}

// Why a step of a custom order cannot run now, or null. Steps run in order; the domain only for web hosting. The setup
// runs on the route given, else the one chosen before, else the first host with room; "auto" needs the provisioning skill.
const LIVE = ["open", "quoted", "countered", "refused", "accepted"];
export function stepError(s: GameState, t: Ticket, step: OrderStep, route?: string): string | null {
  const r = orderOf(s, t);
  if (!r || isFinal(t) || !LIVE.includes(r.status)) return "error.unknownRequest";
  if (missingFor(s, r).length) return "error.orderNotOffered";
  const done = stepsDone(s, r);
  if (done[step]) return "error.stepDone";
  if (step === "quote") return r.replyAt !== null ? "error.quoteSent" : null;
  if (!done.quote) return "error.needsQuote";
  if (step === "account") return null;
  if (!done.account) return "error.needsAccount";
  if (step === "invoice") return r.quote && r.quote > 0 ? null : "error.quotePrice";
  if (!done.invoice) return "error.needsInvoice";
  if (step === "domain") {
    if (!needsDomain(r)) return "error.unknownTicketAction";
    return domainOf(s, r.domain!) ? "error.domainTaken" : null;
  }
  if (!done.domain) return "error.needsDomain";
  const to = route ?? r.route ?? hostFor(s, r);
  if (to === "auto") return !canAutomate(s) ? "error.needsAutomation" : targetFor(s, r) ? null : "error.noCapacity";
  return to ? routeError(s, r.product, r.city, sizeOf(r.spec), to) : "error.noCapacity";
}

// The step staff work next: everything in order, the setup only once the invoice is paid. The quote waits for the customer's answer.
export function nextStep(s: GameState, r: SalesRequest): OrderStep | null {
  const done = stepsDone(s, r), step = ORDER_STEPS.find((x) => !done[x]) ?? null;
  if (step === "quote") return r.replyAt === null ? step : null;
  return step === "provision" && invoiceOf(s, r)?.status !== "paid" ? null : step;
}

// What a support agent does on an order ticket, or null when it waits for the player or the customer.
export function staffOrderStep(s: GameState, t: Ticket, legacyError: string | null): string | null {
  const r = orderOf(s, t);
  if (!r) return legacyError ? null : "accept";
  const step = nextStep(s, r);
  // The quote stays the player's.
  return step && step !== "quote" && !stepError(s, t, step) ? step : null;
}
export const orderMinutes = (s: GameState, t: Ticket, arg: string, legacy: number): number => (isStep(arg) && orderOf(s, t) ? stepMinutes(arg, s, orderOf(s, t)) : legacy);

// A new invoice outside the monthly run, paid by the customer's habit; an order is paid within ORDER_PAY_DAYS when on time.
export function issueInvoice(s: GameState, customerId: string, lines: InvoiceLine[], payDays = DUE_DAYS - 1): Invoice {
  const payStep = rollPayStep(s.rng, s.customers.find((c) => c.id === customerId)?.habit ?? "prompt");
  const inv: Invoice = {
    id: `inv${s.nextId++}`, number: `${yearOf(s.hour)}-${String(s.invoices.length + 1).padStart(4, "0")}`, customerId, lines,
    issuedAt: s.hour, dueAt: s.hour + DUE_DAYS * DAY, status: "open", reminders: [], suspended: false, suspendedAt: null, extendedUntil: null,
    payStep, payAt: payStep === 0 ? s.hour + DAY + Math.floor(rand(s.rng) * payDays * DAY) + mailDelay(s) : null, paidAt: null,
  };
  s.invoices = [...s.invoices, inv];
  return inv;
}

// An invoice waiting in Books to be sent; it is not due and never pays.
export function draftInvoice(s: GameState, customerId: string, lines: InvoiceLine[]): Invoice {
  const inv: Invoice = {
    id: `inv${s.nextId++}`, number: `${yearOf(s.hour)}-${String(s.invoices.length + 1).padStart(4, "0")}`, customerId, lines,
    issuedAt: s.hour, dueAt: s.hour, status: "draft", reminders: [], suspended: false, suspendedAt: null, extendedUntil: null, payStep: 0, payAt: null, paidAt: null,
  };
  s.invoices = [...s.invoices, inv];
  return inv;
}

// The first invoice of an order, and the quote for it: the setup fee, the first month and a new or moved domain.
export function firstLines(s: GameState, r: SalesRequest, monthly = r.quote ?? 0, setup = r.setup ?? setupFee(s, r.product)): InvoiceLine[] {
  const label = r.domain ?? requestName(r);
  const lines: InvoiceLine[] = [
    ...(setup > 0 ? [{ serviceId: null, key: "invoice.line.setupFee", params: { label }, amount: setup }] : []),
    { serviceId: null, key: "invoice.line.firstMonth", params: { label }, amount: monthly },
  ];
  if (needsDomain(r)) lines.push({ serviceId: null, key: r.owned ? "invoice.line.domainTransfer" : "invoice.line.domain", params: { domain: r.domain! }, amount: r.owned ? TRANSFER_FEE : DOMAIN_FEE });
  return lines;
}

// Sends the first invoice of a live order as the confirmation step; false when the invoice belongs to no order that waits for it.
export function sendOrderInvoice(s: GameState, inv: Invoice): boolean {
  const r = s.sales.requests.find((x) => x.kind === "order" && x.invoiceId === inv.id), t = r && s.tickets.find((x) => x.id === r.ticketId);
  return !!t && !stepError(s, t, "invoice") && !applyStep(s, t, "invoice");
}

const setTicket = (s: GameState, id: string, fields: Partial<Ticket>) => {
  s.tickets = s.tickets.map((x) => (x.id === id ? { ...x, ...fields } : x));
};

// Applies a queued step; the support tick calls this once its work time has passed. Returns an event when it failed.
export function applyStep(s: GameState, t: Ticket, step: OrderStep, by?: string): SimEvent | null {
  const r = orderOf(s, t)!;
  const error = r && stepError(s, t, step, r.route);
  if (!r || error) return r ? { app: "Support", key: "event.stepFailed", params: { name: requestName(r), error: error! } } : null;
  // Queuing logs the work; only the account step had no customer to log it on yet.
  const log = (customerId: string) => logActivity(s, { customerId, serviceId: t.serviceId, by: by ?? null, key: "activity.resolve", params: { kind: "order", arg: step }, minutes: by === AUTOMATION ? 0 : stepMinutes(step, s, r) });
  if (step === "quote") {
    const at = answerAt(s, r, r.quote!);
    // The request outlasts the customer's answer.
    editRequest(s, r.id, (x) => ({ status: "quoted", attempts: x.attempts + 1, replyAt: at, deadline: Math.max(x.deadline, at + 1) }));
    mailRequest(s, r.id, "order.quote", by, { price: r.quote!, setup: r.setup ?? setupFee(s, r.product) });
    setTicket(s, t.id, { status: "waiting", updatedAt: s.hour });
    return null;
  }
  if (step === "account") {
    if (failsReview(s, r)) {
      setTicket(s, t.id, { status: "closed", outcome: "declined", updatedAt: s.hour });
      loseRequest(s, r, "declined", "lost.declined");
      return { app: "Support", key: "event.orderDeclined", params: { name: requestName(r) } };
    }
    const id = addCustomer(s, requestName(r), r.profile, r.shady || r.fraud ? "prompt" : habitFor(hashRng(s.seed, Number(r.id.slice(3)) || 0, 227), r.profile), r);
    if (r.shady || r.fraud) s.customers = s.customers.map((c) => (c.id === id ? { ...c, ...hiddenTraits(s, r) } : c));
    editRequest(s, r.id, () => ({ customerId: id }));
    setTicket(s, t.id, { customerId: id, updatedAt: s.hour });
    s.quotes = s.quotes.map((q) => (q.ticketId === t.id ? { ...q, customerId: id } : q));
    log(id);
    return null;
  }
  const customerId = r.customerId!;
  if (step === "invoice") {
    // The draft converted from the quote, else one made now; the customer pays it by bank transfer.
    const draft = invoiceOf(s, r), inv = draft?.status === "draft" ? draft : draftInvoice(s, customerId, firstLines(s, r));
    issue(s, inv, ORDER_PAY_DAYS - 1);
    editRequest(s, r.id, () => ({ invoiceId: inv.id, status: "quoted", replyAt: null }));
    mailRequest(s, r.id, "order.invoice", by, { invoice: inv.number, total: cents(inv.lines.reduce((n, l) => n + l.amount, 0)) });
    setTicket(s, t.id, { status: "waiting", updatedAt: s.hour });
  } else if (step === "domain") {
    register(s, r.domain!, customerId, !!r.owned);
  } else {
    const to = r.route ?? hostFor(s, r) ?? "";
    const target = to === "auto" ? null : routeTarget(s, to, r.product), auto = to === "auto" ? targetFor(s, r) : null;
    const pkg = packageFor(s, r), booking = pkg && !belowFloor(pkg, r.spec) ? bookingFor(pkg, r.spec) : null;
    const done = provisionService(s, customerId, r.product, {
      label: r.domain ?? requestName(r), sla: r.sla, price: r.quote! / MONTH, spec: r.spec,
      ...(booking && { pkg: { name: pkg!.name, ...booking } }), ...(r.username && r.product === "webHosting" && { username: r.username }),
      clusterId: target?.clusterId ?? auto?.clusterId ?? null, deviceId: target?.deviceId ?? null, zone: auto?.zone ?? null,
    });
    if (!done.ok) return { app: "Support", key: "event.stepFailed", params: { name: requestName(r), error: done.error ?? "error.noCapacity" } };
    s.services = s.services.map((v) => (v.id === done.id ? { ...v, prepaidUntil: s.hour + MONTH } : v));
    if (r.product === "webHosting") offerCertificate(s, s.services.find((v) => v.id === done.id)!, CERT_SHARE.order);
    editRequest(s, r.id, () => ({ serviceId: done.id! }));
    setTicket(s, t.id, { serviceId: done.id!, updatedAt: s.hour });
    mailRequest(s, r.id, "order.live", by, { owned: r.owned ? 1 : 0 });
  }
  settle(s, orderOf(s, t)!);
  return null;
}

// A paid order with its service is done; a paid order without one goes back to the inbox, due within the customer's reply time.
function settle(s: GameState, r: SalesRequest): SimEvent | null {
  const t = s.tickets.find((x) => x.id === r.ticketId);
  if (!t || isFinal(t) || invoiceOf(s, r)?.status !== "paid") return null;
  if (r.serviceId) {
    editRequest(s, r.id, () => ({ status: "won" }));
    setTicket(s, t.id, { status: "resolved", outcome: "accepted", updatedAt: s.hour });
    return null;
  }
  if (t.status !== "waiting") return null;
  const c = s.customers.find((x) => x.id === r.customerId)!;
  setTicket(s, t.id, { status: "open", unread: true, dueAt: replyDue(c, s.hour), updatedAt: s.hour });
  return { app: "Support", key: "event.orderPaid", params: { name: requestName(r) } };
}

// The customer took the quote: the steps open and, with automation on, the whole chain runs at once. A step that fails
// leaves the order at that step for the player.
export function acceptQuote(s: GameState, r: SalesRequest, events: SimEvent[]): void {
  const due = s.hour + REQUEST_HOURS;
  editRequest(s, r.id, () => ({ status: "accepted", replyAt: null, deadline: due }));
  if (!r.ticketId) return;
  setTicket(s, r.ticketId, { status: "open", unread: true, dueAt: due, updatedAt: s.hour });
  events.push({ app: "Support", key: "event.orderAccepted", params: { name: requestName(r) } });
  if (!s.autoOrders || !canAutomate(s) || reviewing(s, r.product)) return;
  editRequest(s, r.id, () => ({ route: "auto" }));
  for (const step of ORDER_STEPS.slice(1)) {
    const t = s.tickets.find((x) => x.id === r.ticketId)!;
    if (stepsDone(s, orderOf(s, t)!)[step]) continue;
    const failed = applyStep(s, t, step, AUTOMATION);
    if (failed) return void events.push(failed);
  }
}

// Hourly: paid orders move on; an order that lapsed, was declined or never paid closes its account and its open invoice.
export function ordersTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const { id } of s.sales.requests) {
    let r = s.sales.requests.find((x) => x.id === id)!;
    if (r.kind !== "order") continue;
    if (r.status === "quoted" && r.invoiceId) {
      const t = s.tickets.find((x) => x.id === r.ticketId);
      if (!t || !isFinal(t)) {
        const e = settle(s, r);
        if (e) events.push(e);
        continue;
      }
      loseRequest(s, r, "lost", "lost.unpaid");
      r = s.sales.requests.find((x) => x.id === id)!;
    }
    if ((r.status !== "lost" && r.status !== "declined") || !r.customerId) continue;
    const c = s.customers.find((x) => x.id === r.customerId);
    if (!c || c.churnedAt !== null) continue;
    s.customers = s.customers.map((x) => (x.id === c.id ? { ...x } : x));
    s.tickets = s.tickets.map((x) => ({ ...x }));
    cancelCustomer(s, s.customers.find((x) => x.id === c.id)!);
    s.invoices = s.invoices.map((i) => (i.id === r.invoiceId && (i.status === "draft" || i.status === "open" || i.status === "overdue") ? { ...i, status: "writtenOff", payAt: null, suspended: false } : i));
  }
  return events;
}

// Grows a custom service to spec at a new hourly price: in place while its node holds the RAM and disk, otherwise placed again by route.
export function resize(s: GameState, v: Service, spec: Spec, route: string, city: string): ActionResult {
  const size = sizeOf(spec), w = workloadsOf(s, v.id)[0];
  const d = w?.deviceId && w.clusterId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  if (route === "auto" && d) {
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    if ((["ramGb", "diskGb"] as const).every((k) => used[k] - w[k] + size[k] <= cap[k] + 1e-9)) {
      s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...size, promised: undefined } : x));
      s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec, pkgBook: undefined } : x));
      return { ok: true };
    }
  }
  const before = { workloads: s.workloads, services: s.services };
  s.workloads = s.workloads.filter((x) => x.serviceId !== v.id);
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec, pkgBook: undefined } : x));
  const error = routeError(s, v.product, city, size, route), target = routeTarget(s, route, v.product);
  const placed = error ? { ok: false, error } : placeService(s, v.id, target?.clusterId ?? null, target?.deviceId ?? null);
  if (!placed.ok) Object.assign(s, before);
  return placed.ok ? { ok: true } : placed;
}

export interface OrderChoice {
  ticketId: string; requestId: string; name: string; domain?: string;
  product: Product; spec: Spec; sla: Sla; city: string; quote: number | null;
  // The invoice is paid; the player may still provision before.
  paid: boolean;
  // The step the order waits at.
  next: OrderStep | null;
  // Why the provision step cannot run now, an i18n key.
  error: string | null;
  suggestedUsername?: string;
}

// The open orders of the products whose quote the customer accepted and that have no service yet, for a create form to take.
export function orderChoices(s: GameState, products: Product[]): OrderChoice[] {
  const out: OrderChoice[] = [];
  for (const t of s.tickets) {
    const r = orderOf(s, t);
    if (!r || isFinal(t) || !LIVE.includes(r.status) || r.serviceId || !products.includes(r.product) || !quoteAccepted(r)) continue;
    out.push({
      ticketId: t.id, requestId: r.id, name: requestName(r), ...(r.domain && { domain: r.domain }), product: r.product, spec: r.spec, sla: r.sla, city: r.city,
      quote: r.quote ?? null, paid: invoiceOf(s, r)?.status === "paid", next: nextStep(s, r), error: stepError(s, t, "provision"),
      ...(r.product === "webHosting" && r.domain && { suggestedUsername: suggestedUsername(s, r.domain, yearOf(s.hour)) }),
    });
  }
  return out;
}
