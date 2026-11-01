// The steps of a custom order, domain renewals and upgrades of custom services (30-market/manual.ts).
import { authCode, DOMAIN_FEE, domainOf, extend } from "../30-customers/registry";
import type { SalesRequest } from "../30-market/market";
import type { Address } from "../30-customers/addresses";
import { canAutomate, draftInvoice, firstLines, invoiceOf, issueInvoice, resize, shopRegisters, stepError, stepMinutes, type OrderStep } from "../30-market/manual";
import { offerPrice, setupFee } from "../30-market/spec";
import { cyclesFor, discountOf } from "../30-market/cycles";
import type { Cycle } from "../10-catalog/cycles";
import { carryForward, type Quote } from "../30-market/quotes";
import { orderOf } from "../30-market/orders";
import { answerAt, editRequest, say } from "../30-market/sales";
import { isFinal } from "../40-support/tickets";
import { SCREENING_SKILL } from "../45-billing/fraud";
import type { GameState } from "../50-state";
import { logActivity } from "../47-staff/activity";
import type { ActionResult } from "./hardware";
import { routeTarget } from "../60-infra/routes";
import { yearOf } from "../00-core/time";
import { belowFloor, packageNamed, usernameError } from "../80-business/packages";
import { find, queue } from "./support";

const fail = (error: string): ActionResult => ({ ok: false, error });
const ADDRESS_FIELDS = ["contact", "street", "zip", "city", "email"] as const;
const OWNER_FIELDS = [...ADDRESS_FIELDS, "company"] as const;
const validPrice = (monthly: number, reference: number) => Number.isFinite(monthly) && monthly > 0 && monthly <= 100 * Math.max(1, reference);

function step(s: GameState, ticketId: string, which: OrderStep, route?: string, extra: Partial<Pick<SalesRequest, "pkg" | "username">> = {}): ActionResult {
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  const error = stepError(s, f.t, which, route);
  if (error) return fail(error);
  if (route) editRequest(s, orderOf(s, f.t)!.id, () => ({ route, ...extra }));
  return queue(s, f.t, "resolve", which, stepMinutes(which, s, orderOf(s, f.t)));
}

// Creates the customer with the address the player entered from the order email.
export function createAccount(s: GameState, ticketId: string, address?: Address): ActionResult {
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  const error = stepError(s, f.t, "account");
  if (error) return fail(error);
  if (!address || ADDRESS_FIELDS.some((k) => !address[k]?.trim())) return fail("error.addressMissing");
  const done = step(s, ticketId, "account");
  if (done.ok) editRequest(s, orderOf(s, f.t)!.id, () => ({ address: { ...address, company: address.company?.trim() || undefined } }));
  return done;
}
// Registers or transfers the order's domain from the registrar's form: the owner must match the customer record and a
// transfer needs the code from the order email. A shop with the registrar module needs neither.
export function registerOrderDomain(s: GameState, ticketId: string, owner?: Address, auth?: string): ActionResult {
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  const error = stepError(s, f.t, "domain");
  if (error) return fail(error);
  const r = orderOf(s, f.t)!, c = s.customers.find((x) => x.id === r.customerId)!;
  if (!shopRegisters(s, r)) {
    if (!owner || OWNER_FIELDS.some((k) => (owner[k] ?? "").trim() !== (c.address[k] ?? ""))) return fail("error.ownerMismatch");
    if (r.owned && auth?.trim().toUpperCase() !== authCode(s.seed, r.id)) return fail("error.authCode");
  }
  return step(s, ticketId, "domain");
}
// Sets the order up on a cluster or panel host of the city; "auto" lets the game pick and needs the provisioning skill.
// opts picks a package of the host to book and, for web hosting, the account's username.
export function provisionOrder(s: GameState, ticketId: string, route: string, opts?: { package?: string; username?: string }): ActionResult {
  if (!opts?.package && !opts?.username) return step(s, ticketId, "provision", route);
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  const error = stepError(s, f.t, "provision", route);
  if (error) return fail(error);
  const r = orderOf(s, f.t)!, extra: Partial<Pick<SalesRequest, "pkg" | "username">> = {};
  if (opts.package) {
    const target = route === "auto" ? null : routeTarget(s, route, r.product), c = target && s.clusters.find((x) => x.id === target.clusterId);
    const pkg = c ? packageNamed(c, opts.package) : undefined;
    if (!pkg) return fail("error.packageMissing");
    if (pkg.product !== r.product) return fail("error.packageProduct");
    if (belowFloor(pkg, r.spec)) return fail("error.packageTooSmall");
    extra.pkg = pkg.name;
  }
  if (opts.username) {
    const bad = r.product !== "webHosting" ? "error.username" : usernameError(s, opts.username, yearOf(s.hour));
    if (bad) return fail(bad);
    extra.username = opts.username;
  }
  return step(s, ticketId, "provision", route, extra);
}

// Sends the customer a monthly price and a setup fee (the line's rate where omitted); they answer within their reply time.
// A cycle other than monthly offers a prepaid term at the shop's discount; the customer weighs the discounted monthly price.
export const effectiveMonthly = (s: GameState, monthly: number, cycle?: Cycle): number =>
  Math.round(monthly * (cycle ? 1 - discountOf(s, cycle) : 1) * 100) / 100;

export function quoteOrder(s: GameState, ticketId: string, monthly: number, setup?: number, cycle?: Cycle): ActionResult {
  const t = s.tickets.find((x) => x.id === ticketId), r = t && orderOf(s, t);
  if (!r) return fail("error.unknownRequest");
  if (!validPrice(monthly, r.reference)) return fail("error.quotePrice");
  if (setup !== undefined && !validPrice(setup + 1, r.reference)) return fail("error.quotePrice");
  if (cycle && (cycle === "monthly" || !cyclesFor(s, r.product).includes(cycle))) return fail("error.cycleNotSupported");
  const before = { quote: r.quote, setup: r.setup, cycle: r.cycle };
  editRequest(s, r.id, () => ({ quote: effectiveMonthly(s, monthly, cycle), cycle, setup: setup === undefined ? undefined : Math.round(setup * 100) / 100 }));
  const done = step(s, ticketId, "quote");
  if (!done.ok) editRequest(s, r.id, () => before);
  return done;
}

// A quote in Books for an order that waits for one, priced at the player's rates or the customer's counter-offer. An
// unsent quote of the order is reused.
export function createQuote(s: GameState, ticketId: string): ActionResult {
  const t = s.tickets.find((x) => x.id === ticketId), r = t && orderOf(s, t);
  if (!t || !r) return fail("error.unknownRequest");
  const error = stepError(s, t, "quote");
  if (error) return fail(error);
  const open = s.quotes.find((q) => q.ticketId === ticketId && q.status === "draft");
  if (open) return { ok: true, id: open.id };
  const monthly = r.counter ?? Math.round(offerPrice(s, r.product, r.spec, r.sla) * 100) / 100, setup = r.setup ?? setupFee(s, r.product);
  const q: Quote = {
    id: `quo${s.nextId++}`, number: `${yearOf(s.hour)}-${String(s.quotes.length + 1).padStart(4, "0")}`, customerId: r.customerId, ticketId,
    lines: firstLines(s, r, monthly, setup, null), monthly, setup, status: "draft", sentAt: null, createdAt: s.hour,
  };
  s.quotes = [...s.quotes, q];
  return { ok: true, id: q.id };
}

const draftQuote = (s: GameState, id: string) => s.quotes.find((q) => q.id === id && q.status === "draft");

export function editQuote(s: GameState, quoteId: string, monthly: number, setup: number): ActionResult {
  const q = draftQuote(s, quoteId), t = q && s.tickets.find((x) => x.id === q.ticketId), r = t && orderOf(s, t);
  if (!q || !r) return fail("error.quoteSentAlready");
  if (!validPrice(monthly, r.reference) || !validPrice(setup + 1, r.reference)) return fail("error.quotePrice");
  const m = Math.round(monthly * 100) / 100, f = Math.round(setup * 100) / 100;
  s.quotes = s.quotes.map((x) => (x.id === q.id ? { ...x, monthly: m, setup: f, lines: firstLines(s, r, effectiveMonthly(s, m, x.cycle), f, x.cycle ?? null) } : x));
  return { ok: true };
}

// Offers a draft quote as a prepaid term, or back as month-to-month.
export function setQuoteCycle(s: GameState, quoteId: string, cycle: Cycle | null): ActionResult {
  const q = draftQuote(s, quoteId), t = q && s.tickets.find((x) => x.id === q.ticketId), r = t && orderOf(s, t);
  if (!q || !r) return fail("error.quoteSentAlready");
  if (cycle && (cycle === "monthly" || !cyclesFor(s, r.product).includes(cycle))) return fail("error.cycleNotSupported");
  const c = cycle ?? undefined;
  s.quotes = s.quotes.map((x) => (x.id === q.id ? { ...x, cycle: c, lines: firstLines(s, r, effectiveMonthly(s, x.monthly, c), x.setup, c ?? null) } : x));
  return { ok: true };
}

// Sends a quote onto its order ticket: dropped there from Books, or sent from Books with the Helpdesk link.
export function attachQuote(s: GameState, quoteId: string, ticketId: string): ActionResult {
  const q = draftQuote(s, quoteId);
  if (!q) return fail("error.quoteSentAlready");
  if (q.ticketId !== ticketId) return fail("error.quoteOtherOrder");
  const done = quoteOrder(s, ticketId, q.monthly, q.setup, q.cycle);
  if (done.ok) s.quotes = s.quotes.map((x) => (x.id === q.id ? { ...x, status: "sent", sentAt: s.hour } : x));
  return done;
}

// The first invoice of an order as a draft in Books, once the account exists; sending it confirms the order.
export function invoiceOrder(s: GameState, ticketId: string): ActionResult {
  const t = s.tickets.find((x) => x.id === ticketId), r = t && orderOf(s, t);
  if (!t || !r) return fail("error.unknownRequest");
  const error = stepError(s, t, "invoice");
  if (error) return fail(error);
  const draft = invoiceOf(s, r);
  if (draft) return { ok: true, id: draft.id };
  const inv = draftInvoice(s, r.customerId!, firstLines(s, r));
  editRequest(s, r.id, () => ({ invoiceId: inv.id }));
  carryForward(s, ticketId, inv.id);
  return { ok: true, id: inv.id };
}

// Carry forward: an accepted quote becomes the order's first invoice, as a draft.
export function convertQuote(s: GameState, quoteId: string): ActionResult {
  const q = s.quotes.find((x) => x.id === quoteId);
  if (q?.status === "invoiced") return fail("error.quoteInvoiced");
  if (q?.status !== "accepted" || !q.ticketId) return fail("error.quoteNotAccepted");
  return invoiceOrder(s, q.ticketId);
}

// Deletes a quote that was never sent.
export function deleteQuote(s: GameState, quoteId: string): ActionResult {
  if (!draftQuote(s, quoteId)) return fail("error.quoteSentAlready");
  s.quotes = s.quotes.filter((q) => q.id !== quoteId);
  return { ok: true };
}

// Confirms the accepted quote and sends the invoice.
export const confirmOrder = (s: GameState, ticketId: string): ActionResult => step(s, ticketId, "invoice");

// Switches the automatic run of accepted orders; it needs the provisioning skill.
export function setAutoOrders(s: GameState, on: boolean): ActionResult {
  if (on && !canAutomate(s)) return fail("error.needsAutomation");
  s.autoOrders = on;
  return { ok: true };
}

// Switches the review by hand of server orders (45-billing/fraud.ts).
export function setReviewOrders(s: GameState, on: boolean): ActionResult {
  s.reviewOrders = on;
  return { ok: true };
}

export function setScreenOrders(s: GameState, on: boolean): ActionResult {
  if (on && !s.unlocks.includes(SCREENING_SKILL)) return fail("error.needsResearch");
  s.screenOrders = on;
  return { ok: true };
}

// Another year of a customer's domain: the customer is invoiced the yearly fee and the registrar bills the registry monthly.
export function renewDomain(s: GameState, name: string): ActionResult {
  const d = domainOf(s, name);
  if (!d?.customerId || !s.customers.some((c) => c.id === d.customerId && c.churnedAt === null)) return fail("error.unknownDomain");
  extend(s, name);
  issueInvoice(s, d.customerId, [{ serviceId: null, key: "invoice.line.domainRenewal", params: { domain: name }, amount: DOMAIN_FEE }]);
  logActivity(s, { customerId: d.customerId, serviceId: null, by: null, key: "activity.renewDomain", params: { domain: name }, minutes: 0 });
  return { ok: true };
}

const live = (s: GameState, r: SalesRequest) => s.services.find((v) => v.id === r.serviceId && v.endedAt === null);

// Offers the new monthly price for an upgrade of a custom service; the customer answers within their reply time and,
// taking it, the service grows to the requested resources (in place, or by route when its node lacks room).
export function offerUpgrade(s: GameState, requestId: string, monthly: number, route = "auto"): ActionResult {
  const r = s.sales.requests.find((x) => x.id === requestId);
  if (!r || r.kind !== "expansion" || !r.spec || !["open", "countered", "refused"].includes(r.status)) return fail("error.unknownRequest");
  const v = live(s, r);
  if (!v) return fail("error.unknownService");
  if (!validPrice(monthly, r.reference)) return fail("error.quotePrice");
  const price = Math.round(monthly * 100) / 100;
  // Checked on a copy first, so a refused route leaves nothing changed.
  const trial = { ...s, workloads: [...s.workloads], services: [...s.services] };
  const fits = resize(trial, v, r.spec, route, r.city);
  if (!fits.ok) return fits;
  const at = answerAt(s, r, price);
  editRequest(s, r.id, (x) => ({ status: "quoted", quote: price, route, attempts: x.attempts + 1, replyAt: at, deadline: Math.max(x.deadline, at + 1) }));
  say(s, r.id, "you", "sales.you.upgrade", { price });
  s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "waiting", updatedAt: s.hour } : t));
  return { ok: true };
}
