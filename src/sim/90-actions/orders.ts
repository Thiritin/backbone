// The steps of a custom order, domain renewals and upgrades of custom services (30-market/manual.ts).
import { rand } from "../00-core/rng";
import { DOMAIN_FEE, domainOf, extend } from "../30-customers/registry";
import { acceptChance, acceptMid, type SalesRequest } from "../30-market/market";
import { issueInvoice, resize, stepError, stepMinutes, type OrderStep } from "../30-market/manual";
import { orderOf } from "../30-market/orders";
import { editRequest, loseRequest, say } from "../30-market/sales";
import type { GameState } from "../50-state";
import { logActivity } from "../47-staff/activity";
import type { ActionResult } from "./hardware";
import { find, queue } from "./support";

const fail = (error: string): ActionResult => ({ ok: false, error });
const MONTH = 730;
// economy.md, Customer choice: a refusal this far above the accepted ratio reads as "no budget"; closer ones counter.
const NO_BUDGET_GAP = 0.12;
const validPrice = (monthly: number, reference: number) => Number.isFinite(monthly) && monthly > 0 && monthly <= 100 * Math.max(1, reference);

function step(s: GameState, ticketId: string, which: OrderStep, route?: string): ActionResult {
  const f = find(s, ticketId);
  if ("error" in f) return f.error;
  const error = stepError(s, f.t, which, route);
  if (error) return fail(error);
  if (route) editRequest(s, orderOf(s, f.t)!.id, () => ({ route }));
  return queue(s, f.t, "resolve", which, stepMinutes(which));
}

export const createAccount = (s: GameState, ticketId: string): ActionResult => step(s, ticketId, "account");
export const registerOrderDomain = (s: GameState, ticketId: string): ActionResult => step(s, ticketId, "domain");
export const provisionOrder = (s: GameState, ticketId: string, route = "auto"): ActionResult => step(s, ticketId, "provision", route);

// Sets the monthly price and queues the confirmation with its invoice.
export function confirmOrder(s: GameState, ticketId: string, monthly: number): ActionResult {
  const r = s.tickets.find((x) => x.id === ticketId) && orderOf(s, s.tickets.find((x) => x.id === ticketId)!);
  if (!r) return fail("error.unknownRequest");
  if (!validPrice(monthly, r.reference)) return fail("error.quotePrice");
  const before = r.quote;
  editRequest(s, r.id, () => ({ quote: Math.round(monthly * 100) / 100 }));
  const done = step(s, ticketId, "invoice");
  if (!done.ok) editRequest(s, r.id, () => ({ quote: before }));
  return done;
}

// Another year of a customer's domain: the registry is paid now and the customer invoiced the yearly fee.
export function renewDomain(s: GameState, name: string): ActionResult {
  const d = domainOf(s, name);
  if (!d || !s.customers.some((c) => c.id === d.customerId && c.churnedAt === null)) return fail("error.unknownDomain");
  if (!extend(s, name)) return fail("error.noCash");
  issueInvoice(s, d.customerId, [{ serviceId: null, key: "invoice.line.domainRenewal", params: { domain: name }, amount: DOMAIN_FEE }]);
  logActivity(s, { customerId: d.customerId, serviceId: null, by: null, key: "activity.renewDomain", params: { domain: name }, minutes: 0 });
  return { ok: true };
}

const live = (s: GameState, r: SalesRequest) => s.services.find((v) => v.id === r.serviceId && v.endedAt === null);
const closeUpgrade = (s: GameState, r: SalesRequest) => {
  s.tickets = s.tickets.map((t) => (t.id === r.ticketId && t.status !== "resolved" && t.status !== "closed" ? { ...t, status: "closed", updatedAt: s.hour, work: null } : t));
};

// Answers an upgrade request of a custom service in one step: the customer takes the new monthly price, counters it or
// walks away. Taken, the service grows to the requested resources (in place, or by route when its node lacks room).
export function acceptUpgrade(s: GameState, requestId: string, monthly: number, route = "auto"): ActionResult {
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
  const met = r.counter !== null && price <= r.counter;
  const accepts = met || rand(s.rng) < acceptChance(s, r, price);
  editRequest(s, r.id, (x) => ({ quote: price, attempts: x.attempts + 1 }));
  say(s, r.id, "you", "sales.you.upgrade", { price });
  if (accepts) {
    resize(s, v, r.spec, route, r.city);
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: price / MONTH, before: undefined } : x));
    say(s, r.id, "customer", "sales.reply.accept", { name: r.contact });
    say(s, r.id, "you", "sales.you.upgradeDone", { price });
    editRequest(s, r.id, () => ({ status: "won", replyAt: null }));
    closeUpgrade(s, r);
    logActivity(s, { customerId: v.customerId, serviceId: v.id, by: null, key: "activity.upgrade", params: { price }, minutes: 0 });
    return { ok: true, id: v.id };
  }
  const mid = acceptMid(s, r), ratio = price / r.reference, attempts = r.attempts + 1;
  if (attempts < 3 && ratio <= mid + NO_BUDGET_GAP) {
    const counter = Math.min(price - 0.01, Math.round(r.reference * mid * 0.97 * 100) / 100);
    editRequest(s, r.id, () => ({ status: "countered", counter }));
    say(s, r.id, "customer", "sales.reply.counter", { name: r.contact, price: counter });
  } else {
    say(s, r.id, "customer", "sales.reply.noBudget", { name: r.contact });
    loseRequest(s, s.sales.requests.find((x) => x.id === r.id)!, "lost", "lost.price");
  }
  return { ok: true };
}
