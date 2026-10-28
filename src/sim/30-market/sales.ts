// Requests over time: the morning mail of new leads, expansion requests from upgrade tickets, customer replies to quotes,
// expiry into lost sales and the monthly happiness drift. Decisions are recorded in docs/design/economy.md, "Requests, SLAs and growth".
import { rand, type Rng } from "../00-core/rng";
import { isMonthStart, yearOf } from "../00-core/time";
import { CHOICE_TAU, NEVER_PAYS, ON_TIME } from "../10-catalog/economy";
import { PRODUCTS } from "../10-catalog/products";
import { activeServices, type PaymentHabit, type Product, type Profile } from "../30-customers/customers";
import { isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { lineOffered, noRoomError, pickNode, serverTaken, supports, workloadsOf } from "../60-infra/cluster";
import { phpNeeded } from "../60-infra/php";
import { locationOf } from "../60-infra/status";
import { modelById } from "../10-catalog/hardware";
import { addAwareness, discountFor } from "../80-business/marketing";
import { forumAwareness } from "../47-staff/staff";
import type { SimEvent } from "../88-tick/tick";
import { addCustomer } from "../90-actions/customers";
import { firstOrder, isStandard, orderLead, orderQueued } from "./orders";
import { provisionService } from "../90-actions/clusters";
import type { ActionResult } from "../90-actions/hardware";
import {
  acceptChance, acceptMid, FORUM_AWARENESS, FORUM_PROFILES, leadFlows, missingFor, needFor, planName, referenceFor, REQUEST_HOURS,
  requestName, senderFor, share, values, type SalesMessage, type SalesRequest,
} from "./market";

const DAYS_PER_MONTH = 30.4;
const MAIL_HOUR = 8;
// A shady request about every three months, from the fourth month on.
const SHADY_PER_MONTH = 0.3;
const EXPANSION_HOURS = 7 * 24;
const RETRY_HOURS = 48;
const KEEP_HOURS = 60 * 24;
const LOST_KEPT = 300;
// A refusal this far above the ratio accepted half the time reads as "no budget"; closer ones may counter.
const NO_BUDGET_GAP = 0.12;
const COUNTER_CHANCE = 0.5;

function poisson(r: Rng, mean: number): number {
  const l = Math.exp(-mean);
  let k = 0, p = rand(r);
  while (p > l && k < 50) { k++; p *= rand(r); }
  return k;
}

const msg = (s: GameState, from: SalesMessage["from"], key: string, params: SalesMessage["params"] = {}): SalesMessage => ({ hour: s.hour, from, key, params });

export function editRequest(s: GameState, id: string, fn: (r: SalesRequest) => Partial<SalesRequest>): SalesRequest {
  let out: SalesRequest | undefined;
  s.sales = { ...s.sales, requests: s.sales.requests.map((r) => (r.id === id ? (out = { ...r, ...fn(r) }) : r)) };
  return out!;
}

export function say(s: GameState, id: string, from: SalesMessage["from"], key: string, params: SalesMessage["params"] = {}): void {
  editRequest(s, id, (r) => ({ thread: [...r.thread, msg(s, from, key, params)] }));
}

export function addRequest(s: GameState, r: Omit<SalesRequest, "id" | "createdAt" | "status" | "quote" | "counter" | "replyAt" | "attempts" | "thread">, key: string): SalesRequest {
  const req: SalesRequest = { ...r, id: `req${s.nextId++}`, createdAt: s.hour, status: "open", quote: null, counter: null, replyAt: null, attempts: 0, thread: [] };
  const params = { plan: planName(req), city: req.city, sla: req.sla, name: req.contact };
  req.thread = [msg(s, "customer", key, params)];
  if (req.discount > 0) req.thread.push(msg(s, "customer", "sales.msg.discount", { discount: Math.round(req.discount * 100) }));
  s.sales = { ...s.sales, requests: [...s.sales.requests, req] };
  return req;
}

// The hidden budget: the price ratio to the reference accepted half the time, between 0.97 and 1.24.
const budgetOf = (r: Rng): number => 1.08 * (0.9 + 0.25 * rand(r));

export function newLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile)): SalesRequest {
  const who = senderFor(s.rng, profile);
  const variant = Math.floor(rand(s.rng) * 2);
  const req = addRequest(s, {
    kind: "new", customerId: null, ...who, profile, city, ...need, reference: referenceFor(s, profile, need.product, need.plan, need.sla),
    discount: discountFor(s, profile), budget: budgetOf(s.rng), shady: false, serviceId: null, ticketId: null, deadline: s.hour + REQUEST_HOURS,
  }, `sales.msg.${need.product}.${variant}`);
  if (!missingFor(s, req).length) events.push({ app: "Support", key: "event.salesRequest", params: { name: requestName(req), plan: planName(req) } });
  return req;
}

// High volume, no questions, crypto: pays well and carries a hidden flag for abuse and legal follow-ups.
export function shadyLead(s: GameState, city: string, events: SimEvent[]): SalesRequest {
  const who = senderFor(s.rng, "hobbyDev", true), plan = PRODUCTS.vps.plans.at(-1)!.id;
  const req = addRequest(s, {
    kind: "new", customerId: null, ...who, profile: "hobbyDev", city, product: "vps", plan, sla: "basic",
    reference: referenceFor(s, "hobbyDev", "vps", plan, "basic"), discount: 0, budget: 1.8, shady: true, serviceId: null, ticketId: null,
    deadline: s.hour + REQUEST_HOURS,
  }, "sales.msg.shady");
  if (!missingFor(s, req).length) events.push({ app: "Support", key: "event.salesRequest", params: { name: requestName(req), plan: planName(req) } });
  return req;
}

function morningMail(s: GameState, events: SimEvent[]): void {
  const cache = new Map<string, number>();
  for (const f of leadFlows(s)) {
    const n = poisson(s.rng, f.leads / DAYS_PER_MONTH);
    for (let i = 0; i < n; i++) {
      const need = needFor(s.rng, f.profile), k = `${f.profile}/${need.product}/${f.city}`;
      if (!cache.has(k)) cache.set(k, share(s, f.profile, need.product, f.city));
      if (rand(s.rng) >= Math.min(1, cache.get(k)! * f.conversion)) continue;
      // The website and order emails only sell lines some installed control plane supports.
      if (!lineOffered(s, need.product)) continue;
      if (isStandard(f.profile, need.sla)) orderLead(s, f.profile, f.city, events, need);
      else newLead(s, f.profile, f.city, events, need);
    }
  }
  firstOrder(s, events);
  if (s.hour > 2160 && lineOffered(s, "vps") && rand(s.rng) < SHADY_PER_MONTH / DAYS_PER_MONTH) shadyLead(s, s.locations[0]?.city ?? "Frankfurt", events);
}

// An open upgrade ticket asks for the next bigger plan of its service, or one more of the biggest.
function expansions(s: GameState): void {
  for (const t of s.tickets) {
    if (t.kind !== "upgrade" || isFinal(t) || s.sales.requests.some((r) => r.ticketId === t.id)) continue;
    const c = s.customers.find((x) => x.id === t.customerId), v = s.services.find((x) => x.id === t.serviceId);
    if (!c || c.churnedAt !== null || !v || v.endedAt !== null || PRODUCTS[v.product].runsOn === "none" || PRODUCTS[v.product].period !== "hour") continue;
    const plans = PRODUCTS[v.product].plans, i = Math.max(0, plans.findIndex((p) => p.id === v.plan));
    const bigger = plans[i + 1], plan = (bigger ?? plans[i]).id;
    const loc = s.locations.find((l) => l.az === v.zone);
    addRequest(s, {
      kind: "expansion", customerId: c.id, contact: c.name, company: null, profile: c.profile, city: loc?.city ?? s.locations[0].city,
      product: v.product, plan, sla: v.sla, reference: referenceFor(s, c.profile, v.product, plan, v.sla), discount: 0, budget: budgetOf(s.rng),
      shady: !!c.shady, serviceId: bigger ? v.id : null, ticketId: t.id, deadline: s.hour + EXPANSION_HOURS,
    }, "sales.msg.expansion");
  }
}

const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 20) || "kunde";
const labelFor = (r: SalesRequest): string => {
  const base = slug(r.company ?? r.contact);
  return r.product === "webHosting" ? (r.company?.includes(".") ? r.company : `${base}.de`) : `${base}-${r.product === "gameServer" ? "game" : r.product}`;
};

// The cluster or zone in the request's city where the service fits; null when nothing has room.
export function targetFor(s: GameState, r: Pick<SalesRequest, "city" | "product" | "plan">): { clusterId: string | null; zone: string | null } | null {
  const zones = s.locations.filter((l) => l.city === r.city).map((l) => l.az);
  const spec = PRODUCTS[r.product], size = spec.plans.find((p) => p.id === r.plan)!.size(yearOf(s.hour));
  if (spec.runsOn === "cluster") {
    const c = s.clusters.find((x) => zones.includes(x.az) && supports(x, r.product) && pickNode(s, x, size));
    return c ? { clusterId: c.id, zone: c.az } : null;
  }
  if (spec.runsOn === "server") {
    const d = s.devices.find((x) => x.rackId && (modelById(x.model).server?.ramGb ?? 0) >= size.ramGb && zones.includes(locationOf(s, x)?.az ?? "") && !serverTaken(s, x.id));
    return d ? { clusterId: null, zone: locationOf(s, d)!.az } : null;
  }
  return { clusterId: null, zone: zones[0] ?? null };
}

const habitFor = (r: Rng, p: Profile): PaymentHabit => {
  const { budget } = profileStats(p), x = rand(r);
  return x < ON_TIME[budget] ? "prompt" : x < 1 - NEVER_PAYS[budget] ? "late" : "bad";
};

// Signs the accepted quote: a new customer with the service, or the bigger plan in place of the old one.
export function fulfil(s: GameState, r: SalesRequest): ActionResult {
  // addCustomer and addService push in place, so the rollback keeps copies.
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  let customerId = r.customerId, label = labelFor(r);
  if (r.kind === "expansion" && r.serviceId) {
    const old = s.services.find((v) => v.id === r.serviceId && v.endedAt === null);
    if (old) {
      label = old.label;
      const gone = new Set(workloadsOf(s, old.id).map((w) => w.id));
      s.services = s.services.map((v) => (v.id === old.id ? { ...v, endedAt: s.hour } : v));
      s.workloads = s.workloads.filter((w) => !gone.has(w.id));
    }
  }
  if (!customerId) {
    customerId = addCustomer(s, requestName(r), r.profile, r.shady ? "prompt" : habitFor(s.rng, r.profile));
    if (r.shady) s.customers = s.customers.map((c) => (c.id === customerId ? { ...c, shady: true } : c));
  }
  const target = targetFor(s, r);
  const placed: ActionResult = target
    ? provisionService(s, customerId, r.product, { label, plan: r.plan, sla: r.sla, price: r.quote! / 730, clusterId: target.clusterId, zone: target.zone })
    : { ok: false, error: noRoomError(s, r.product) };
  if (!placed.ok) Object.assign(s, before);
  else if (r.kind !== "expansion") editRequest(s, r.id, () => ({ customerId }));
  return placed;
}

export function loseRequest(s: GameState, r: SalesRequest, status: "lost" | "declined", reason: string, params: Record<string, string | number> = {}): void {
  editRequest(s, r.id, () => ({ status, replyAt: null }));
  s.sales = { ...s.sales, lost: [...s.sales.lost, { hour: s.hour, name: requestName(r), product: r.product, plan: r.plan, reference: r.reference, reason, params }].slice(-LOST_KEPT) };
  closeTicket(s, r);
}

const closeTicket = (s: GameState, r: SalesRequest) => {
  if (r.ticketId) s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "closed", updatedAt: s.hour, work: null } : t));
};

function reply(s: GameState, r: SalesRequest, events: SimEvent[]): void {
  const name = requestName(r), plan = planName(r), price = r.quote!;
  const accepts = (r.counter !== null && price <= r.counter) || rand(s.rng) < acceptChance(s, r, price);
  const php = accepts && r.product === "webHosting" ? phpNeeded(s, r.id, targetFor(s, r)?.clusterId ?? null) : null;
  if (php) {
    say(s, r.id, "customer", "sales.reply.oldPhp", { name: r.contact, version: php });
    loseRequest(s, r, "lost", "lost.oldPhp", { version: php });
    events.push({ app: "Support", key: "event.salesPhp", params: { name, plan, version: php } });
    return;
  }
  if (accepts) {
    say(s, r.id, "customer", "sales.reply.accept", { name: r.contact });
    const done = fulfil(s, r);
    if (done.ok) {
      editRequest(s, r.id, () => ({ status: "won", replyAt: null, serviceId: done.id ?? r.serviceId }));
      closeTicket(s, r);
      events.push({ app: "Support", key: "event.salesWon", params: { name, plan, price } });
    } else {
      say(s, r.id, "customer", "sales.reply.gone", { name: r.contact });
      loseRequest(s, r, "lost", "lost.noCapacity", { city: r.city });
      events.push({ app: "Support", key: "event.salesFailed", params: { name, plan, city: r.city } });
    }
    return;
  }
  const mid = acceptMid(s, r), ratio = price / r.reference;
  if (r.attempts < 2 && ratio <= mid + NO_BUDGET_GAP && rand(s.rng) < COUNTER_CHANCE) {
    const counter = Math.min(price - 0.01, Math.round(r.reference * mid * 0.97 * 100) / 100);
    editRequest(s, r.id, () => ({ status: "countered", counter, replyAt: null, deadline: s.hour + RETRY_HOURS }));
    say(s, r.id, "customer", "sales.reply.counter", { name: r.contact, price: counter });
    events.push({ app: "Support", key: "event.salesCounter", params: { name, price: counter } });
    return;
  }
  const key = ratio > mid + NO_BUDGET_GAP ? "sales.reply.noBudget" : "sales.reply.refused";
  say(s, r.id, "customer", key, { name: r.contact });
  events.push({ app: "Support", key: "event.salesRefused", params: { name } });
  if (r.attempts < 2) editRequest(s, r.id, () => ({ status: "refused", replyAt: null, deadline: s.hour + RETRY_HOURS }));
  else loseRequest(s, r, "lost", "lost.price");
}

function expire(s: GameState): void {
  for (const r of s.sales.requests) {
    if (!["open", "countered", "refused"].includes(r.status) || s.hour < r.deadline || orderQueued(s, r)) continue;
    const missing = missingFor(s, r)[0];
    if (r.status !== "open") loseRequest(s, r, "lost", "lost.price");
    else if (missing) loseRequest(s, r, "lost", missing.key, missing.params);
    else loseRequest(s, r, "lost", "lost.expired");
  }
}

// economy.md, Happiness and churn, Drift: a fifth of the way toward 70 + half the lead over the best competitor.
function drift(s: GameState): void {
  const home = s.locations[0]?.city ?? "Frankfurt", memo = new Map<string, number>();
  s.customers = s.customers.map((c) => {
    if (c.churnedAt !== null) return c;
    const product: Product = activeServices(s.services, c.id)[0]?.product ?? "webHosting", k = `${c.profile}/${product}`;
    if (!memo.has(k)) {
      const v = values(s, c.profile, product, home);
      // Without a competitor for the product, the best rival counts as one τ behind you.
      memo.set(k, Math.min(95, Math.max(20, 70 + 0.5 * (v.you - Math.max(v.you - CHOICE_TAU, ...v.others)))));
    }
    return { ...c, happiness: c.happiness + 0.2 * (memo.get(k)! - c.happiness) };
  });
}

function monthly(s: GameState): void {
  const forum = forumAwareness(s);
  if (forum > 0) for (const p of FORUM_PROFILES) addAwareness(s, p, FORUM_AWARENESS * forum);
  drift(s);
  const keep = (r: SalesRequest) =>
    !["won", "lost", "declined"].includes(r.status) || s.hour - r.createdAt < KEEP_HOURS || s.tickets.some((t) => t.id === r.ticketId && !isFinal(t));
  s.sales = { ...s.sales, requests: s.sales.requests.filter(keep) };
}

export function salesTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (isMonthStart(s.hour)) monthly(s);
  if (s.hour % 24 === MAIL_HOUR) morningMail(s, events);
  expansions(s);
  for (const r of s.sales.requests) if (r.status === "quoted" && r.replyAt !== null && r.replyAt <= s.hour) reply(s, r, events);
  expire(s);
  return events;
}
