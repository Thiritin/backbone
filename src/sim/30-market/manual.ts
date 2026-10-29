// GDD, Custom orders: an order email is worked step by step, each step a reply in its thread. Create the customer account,
// confirm the order with its invoice, register or transfer the domain, then set up the service. Numbers in economy.md, Custom orders.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import { DOMAIN_FEE, domainOf, register, registryCost, TRANSFER_FEE } from "../30-customers/registry";
import { cancelCustomer, isFinal, replyDue, type Ticket } from "../40-support/tickets";
import { DUE_DAYS, rollPayStep, type Invoice, type InvoiceLine } from "../45-billing/billing";
import { ACTION_MINUTES, logActivity } from "../47-staff/activity";
import type { GameState } from "../50-state";
import { bookable, nodeUsed, workloadsOf } from "../60-infra/cluster";
import { routeError, routeTarget } from "../60-infra/routes";
import type { SimEvent } from "../88-tick/tick";
import { addCustomer } from "../90-actions/customers";
import { placeService, provisionService } from "../90-actions/clusters";
import type { ActionResult } from "../90-actions/hardware";
import { setupFee, sizeOf } from "./spec";
import { missingFor, requestName, type SalesRequest } from "./market";
import { mailRequest, orderOf } from "./orders";
import { editRequest, habitFor, loseRequest } from "./sales";
import type { Spec } from "../10-catalog/products";

export type OrderStep = "account" | "invoice" | "domain" | "provision";
export const ORDER_STEPS: OrderStep[] = ["account", "invoice", "domain", "provision"];
export const isStep = (x: string): x is OrderStep => (ORDER_STEPS as string[]).includes(x);
const STEP_MINUTES: Record<OrderStep, number> = {
  account: ACTION_MINUTES.orderAccount, invoice: ACTION_MINUTES.orderInvoice, domain: ACTION_MINUTES.orderDomain, provision: ACTION_MINUTES.orderProvision,
};
export const stepMinutes = (step: OrderStep): number => STEP_MINUTES[step];
// A customer who pays an order on time does so within this many days, eager to get started.
export const ORDER_PAY_DAYS = 3;
const DAY = 24, MONTH = 730;
const cents = (v: number) => Math.round(v * 100) / 100;

// Thread params naming a spec's resources; "0" and "1" suffixes for the current and the requested spec of an upgrade.
export const specParams = (spec: Spec, suffix = ""): Record<string, number> => ({
  [`cpu${suffix}`]: spec.vcpu, [`ram${suffix}`]: spec.ramGb, [`disk${suffix}`]: spec.diskGb, [`traffic${suffix}`]: spec.trafficGb, [`mail${suffix}`]: spec.mailboxes,
});

export const invoiceOf = (s: GameState, r: SalesRequest): Invoice | undefined => (r.invoiceId ? s.invoices.find((i) => i.id === r.invoiceId) : undefined);
const needsDomain = (r: SalesRequest) => r.product === "webHosting" && !!r.domain;
const domainDone = (s: GameState, r: SalesRequest) => !needsDomain(r) || domainOf(s, r.domain!)?.customerId === r.customerId;

// Which steps the order has behind it.
export function stepsDone(s: GameState, r: SalesRequest): Record<OrderStep, boolean> {
  return { account: !!r.customerId, invoice: !!r.invoiceId, domain: !!r.customerId && domainDone(s, r), provision: !!r.serviceId };
}

// Why a step of a custom order cannot run now, or null. Steps run in order; the domain only for web hosting.
export function stepError(s: GameState, t: Ticket, step: OrderStep, route = "auto"): string | null {
  const r = orderOf(s, t);
  if (!r || isFinal(t) || !["open", "quoted"].includes(r.status)) return "error.unknownRequest";
  if (missingFor(s, r).length) return "error.orderNotOffered";
  const done = stepsDone(s, r);
  if (done[step]) return "error.stepDone";
  if (step === "account") return null;
  if (!done.account) return "error.needsAccount";
  if (step === "invoice") return r.quote && r.quote > 0 ? null : "error.quotePrice";
  if (!done.invoice) return "error.needsInvoice";
  if (step === "domain") {
    if (!needsDomain(r)) return "error.unknownTicketAction";
    return domainOf(s, r.domain!) ? "error.domainTaken" : s.cash < registryCost(r.domain!, yearOf(s.hour)) ? "error.noCash" : null;
  }
  if (!done.domain) return "error.needsDomain";
  return routeError(s, r.product, r.city, sizeOf(r.spec), route) ?? (routeTarget(s, route) || autoFits(s, r) ? null : "error.noCapacity");
}

const autoFits = (s: GameState, r: SalesRequest) => {
  const zones = s.locations.filter((l) => l.city === r.city).map((l) => l.az);
  return s.clusters.some((c) => zones.includes(c.az) && !routeError(s, r.product, r.city, sizeOf(r.spec), c.id));
};

// The step staff work next: everything in order, the setup only once the invoice is paid.
export function nextStep(s: GameState, r: SalesRequest): OrderStep | null {
  const done = stepsDone(s, r), step = ORDER_STEPS.find((x) => !done[x]) ?? null;
  return step === "provision" && invoiceOf(s, r)?.status !== "paid" ? null : step;
}

// What a support agent does on an order ticket, or null when it waits for the player or the customer.
export function staffOrderStep(s: GameState, t: Ticket, legacyError: string | null): string | null {
  const r = orderOf(s, t);
  if (!r) return legacyError ? null : "accept";
  const step = nextStep(s, r);
  return step && !stepError(s, t, step) ? step : null;
}
export const orderMinutes = (s: GameState, t: Ticket, arg: string, legacy: number): number => (isStep(arg) && orderOf(s, t) ? stepMinutes(arg) : legacy);

// A new invoice outside the monthly run, paid by the customer's habit; an order is paid within ORDER_PAY_DAYS when on time.
export function issueInvoice(s: GameState, customerId: string, lines: InvoiceLine[], payDays = DUE_DAYS - 1): Invoice {
  const payStep = rollPayStep(s.rng, s.customers.find((c) => c.id === customerId)?.habit ?? "prompt");
  const inv: Invoice = {
    id: `inv${s.nextId++}`, number: `${yearOf(s.hour)}-${String(s.invoices.length + 1).padStart(4, "0")}`, customerId, lines,
    issuedAt: s.hour, dueAt: s.hour + DUE_DAYS * DAY, status: "open", reminders: [], suspended: false, suspendedAt: null, extendedUntil: null,
    payStep, payAt: payStep === 0 ? s.hour + DAY + Math.floor(rand(s.rng) * payDays * DAY) : null, paidAt: null,
  };
  s.invoices = [...s.invoices, inv];
  return inv;
}

const setTicket = (s: GameState, id: string, fields: Partial<Ticket>) => {
  s.tickets = s.tickets.map((x) => (x.id === id ? { ...x, ...fields } : x));
};

// Applies a queued step; the support tick calls this once its work time has passed. Returns an event when it failed.
export function applyStep(s: GameState, t: Ticket, step: OrderStep, by?: string): SimEvent | null {
  const r = orderOf(s, t)!;
  const error = r && stepError(s, t, step, r.route ?? "auto");
  if (!r || error) return r ? { app: "Support", key: "event.stepFailed", params: { name: requestName(r), error: error! } } : null;
  // Queuing logs the work; only the account step had no customer to log it on yet.
  const log = (customerId: string) => logActivity(s, { customerId, serviceId: t.serviceId, by: by ?? null, key: "activity.resolve", params: { kind: "order", arg: step }, minutes: stepMinutes(step) });
  if (step === "account") {
    const id = addCustomer(s, requestName(r), r.profile, habitFor(hashRng(s.seed, Number(r.id.slice(3)) || 0, 227), r.profile));
    editRequest(s, r.id, () => ({ customerId: id }));
    setTicket(s, t.id, { customerId: id, updatedAt: s.hour });
    mailRequest(s, r.id, "order.account", by);
    log(id);
    return null;
  }
  const customerId = r.customerId!;
  if (step === "invoice") {
    const label = r.domain ?? requestName(r), setup = r.setup ?? setupFee(s, r.product);
    const lines: InvoiceLine[] = [
      ...(setup > 0 ? [{ serviceId: null, key: "invoice.line.setupFee", params: { label }, amount: setup }] : []),
      { serviceId: null, key: "invoice.line.firstMonth", params: { label }, amount: r.quote! },
    ];
    if (needsDomain(r)) lines.push({ serviceId: null, key: r.owned ? "invoice.line.domainTransfer" : "invoice.line.domain", params: { domain: r.domain! }, amount: r.owned ? TRANSFER_FEE : DOMAIN_FEE });
    const inv = issueInvoice(s, customerId, lines, ORDER_PAY_DAYS - 1);
    editRequest(s, r.id, () => ({ invoiceId: inv.id, status: "quoted", replyAt: null }));
    mailRequest(s, r.id, "order.invoice", by, { invoice: inv.number, total: cents(lines.reduce((n, l) => n + l.amount, 0)) });
    setTicket(s, t.id, { status: "waiting", updatedAt: s.hour });
  } else if (step === "domain") {
    register(s, r.domain!, customerId, !!r.owned);
    mailRequest(s, r.id, r.owned ? "order.transfer" : "order.domain", by);
  } else {
    const target = routeTarget(s, r.route ?? "auto");
    const done = provisionService(s, customerId, r.product, {
      label: r.domain ?? requestName(r), sla: r.sla, price: r.quote! / MONTH, spec: r.spec, clusterId: target?.clusterId ?? null, deviceId: target?.deviceId ?? null,
    });
    if (!done.ok) return { app: "Support", key: "event.stepFailed", params: { name: requestName(r), error: done.error ?? "error.noCapacity" } };
    s.services = s.services.map((v) => (v.id === done.id ? { ...v, prepaidUntil: s.hour + MONTH } : v));
    editRequest(s, r.id, () => ({ serviceId: done.id! }));
    setTicket(s, t.id, { serviceId: done.id!, updatedAt: s.hour });
    mailRequest(s, r.id, "order.live", by);
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

// Hourly: paid orders move on; an order that lapsed, was declined or never paid closes its account and its open invoice.
export function ordersTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const { id } of s.sales.requests) {
    let r = s.sales.requests.find((x) => x.id === id)!;
    if (r.kind !== "order") continue;
    if (r.status === "quoted") {
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
    s.invoices = s.invoices.map((i) => (i.id === r.invoiceId && (i.status === "open" || i.status === "overdue") ? { ...i, status: "writtenOff", payAt: null, suspended: false } : i));
  }
  return events;
}

// Grows a custom service to spec at a new hourly price: in place when its node has room, otherwise placed again by route.
export function resize(s: GameState, v: Service, spec: Spec, route: string, city: string): ActionResult {
  const size = sizeOf(spec), w = workloadsOf(s, v.id)[0];
  const d = w?.deviceId && w.clusterId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  if (route === "auto" && d) {
    const cap = bookable(s, d, true), used = nodeUsed(s, d.id);
    if ((["vcpu", "ramGb", "diskGb"] as const).every((k) => used[k] - w[k] + size[k] <= cap[k] + 1e-9)) {
      s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...size } : x));
      s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec } : x));
      return { ok: true };
    }
  }
  const before = { workloads: s.workloads, services: s.services };
  s.workloads = s.workloads.filter((x) => x.serviceId !== v.id);
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec } : x));
  const error = routeError(s, v.product, city, size, route), target = routeTarget(s, route);
  const placed = error ? { ok: false, error } : placeService(s, v.id, target?.clusterId ?? null, target?.deviceId ?? null);
  if (!placed.ok) Object.assign(s, before);
  return placed.ok ? { ok: true } : placed;
}
