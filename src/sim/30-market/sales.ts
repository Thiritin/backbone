// Requests over time: the morning mail of new leads, expansion requests from upgrade tickets, customer replies to quotes,
// expiry into lost sales and the monthly happiness drift. Decisions are recorded in docs/design/economy.md, "Requests, SLAs and growth".
import { rand, type Rng } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import { CHOICE_TAU, NEVER_PAYS, ON_TIME } from "../10-catalog/economy";
import { PRODUCTS, sizeSpec, SIZES } from "../10-catalog/products";
import { yearOf } from "../00-core/time";
import { inUs } from "../20-world/datacenters";
import { activeServices, type PaymentHabit, type Product, type Profile } from "../30-customers/customers";
import { bump, isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { lineOffered, noRoomError, pickNode, serverTaken, supports, workloadsOf } from "../60-infra/cluster";
import { phpNeeded } from "../60-infra/php";
import { locationOf } from "../60-infra/status";
import { modelById } from "../10-catalog/hardware";
import { addAwareness, discountFor } from "../80-business/marketing";
import { listed, siteFactor } from "../80-business/website";
import { forumAwareness } from "../47-staff/staff";
import type { SimEvent } from "../88-tick/tick";
import { addCustomer } from "../90-actions/customers";
import { domainFor } from "../30-customers/domains";
import { emailFor, firstOrder, isStandard, orderLead, orderQueued } from "./orders";
import { provisionService } from "../90-actions/clusters";
import { addressesFit } from "../60-infra/addresses";
import { withAddressNeeds } from "../10-catalog/addresses";
import { grownSpec, setupPremium, sizeOf, specFor, specText } from "./spec";
import { specParams } from "./manual";
import type { ActionResult } from "../90-actions/hardware";
import {
  acceptChance, acceptMid, FORUM_AWARENESS, FORUM_PROFILES, leadFlows, missingFor, needFor, referenceFor, REQUEST_HOURS,
  requestName, senderFor, share, values, type Need, type SalesMessage, type SalesRequest,
} from "./market";

const DAYS_PER_MONTH = 30.4;
const MAIL_HOUR = 8;
// A shady request about every three months, from the fourth month on.
const SHADY_PER_MONTH = 0.3;
const EXPANSION_HOURS = 7 * 24;
const RETRY_HOURS = 48;
// economy.md, Sales requests: how long a customer who accepted waits for a server with room before going elsewhere.
export const SETUP_WAIT_HOURS = 48;
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

export function say(s: GameState, id: string, from: SalesMessage["from"], key: string, params: SalesMessage["params"] = {}, by?: string): void {
  editRequest(s, id, (r) => ({ thread: [...r.thread, { ...msg(s, from, key, params), ...(by && { by }) }] }));
}

export function addRequest(s: GameState, r: Omit<SalesRequest, "id" | "createdAt" | "status" | "quote" | "counter" | "replyAt" | "attempts" | "thread">, key: string): SalesRequest {
  const req: SalesRequest = { ...r, id: `req${s.nextId++}`, createdAt: s.hour, status: "open", quote: null, counter: null, replyAt: null, attempts: 0, thread: [] };
  if (req.product === "webHosting") req.domain = s.services.find((v) => v.id === req.serviceId)?.domain ?? domainFor(s, requestName(req), req.profile, req.city, Number(req.id.slice(3)));
  const params = { spec: specText(req.product, req.spec), ...specParams(req.spec), city: req.city, sla: req.sla, name: req.contact, domain: req.domain ?? "" };
  req.thread = [msg(s, "customer", key, params)];
  if (req.discount > 0) req.thread.push(msg(s, "customer", "sales.msg.discount", { discount: Math.round(req.discount * 100) }));
  s.sales = { ...s.sales, requests: [...s.sales.requests, req] };
  return req;
}

// The hidden budget: the price ratio to the reference accepted, drawn evenly from this range.
export const BUDGET_RANGE: [number, number] = [1.08 * 0.9, 1.08 * 1.15];
const budgetOf = (r: Rng): number => BUDGET_RANGE[0] + (BUDGET_RANGE[1] - BUDGET_RANGE[0]) * rand(r);

// The spec of the request about to be added, with the addresses its customer needs: drawn with its id as the key, so it is
// stable for a seed.
export const nextSpec = (s: GameState, need: Need, profile: Profile) =>
  withAddressNeeds(s.seed, s.nextId, profile, need.product, specFor(s.seed, s.nextId, need.product, need.size, yearOf(s.hour)), yearOf(s.hour));

export function newLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile)): SalesRequest {
  const who = senderFor(s.rng, profile, false, inUs(city));
  const variant = Math.floor(rand(s.rng) * 2), spec = nextSpec(s, need, profile);
  const req = addRequest(s, {
    kind: "new", customerId: null, ...who, profile, city, product: need.product, spec, sla: need.sla, reference: referenceFor(s, profile, need.product, spec, need.sla),
    discount: discountFor(s, profile), budget: budgetOf(s.rng), shady: false, serviceId: null, ticketId: null, deadline: s.hour + REQUEST_HOURS,
  }, `sales.msg.${need.product}.${variant}`);
  if (!missingFor(s, req).length) events.push({ app: "Support", key: "event.salesRequest", params: { name: requestName(req), spec: specText(req.product, spec) } });
  return req;
}

// High volume, no questions, crypto: pays well and carries a hidden flag for abuse and legal follow-ups.
export function shadyLead(s: GameState, city: string, events: SimEvent[]): SalesRequest {
  const who = senderFor(s.rng, "hobbyDev", true), spec = sizeSpec("vps", SIZES.vps.length - 1, yearOf(s.hour));
  const req = addRequest(s, {
    kind: "new", customerId: null, ...who, profile: "hobbyDev", city, product: "vps", spec, sla: "basic",
    reference: referenceFor(s, "hobbyDev", "vps", spec, "basic"), discount: 0, budget: 1.8, shady: true, serviceId: null, ticketId: null,
    deadline: s.hour + REQUEST_HOURS,
  }, "sales.msg.shady");
  if (!missingFor(s, req).length) events.push({ app: "Support", key: "event.salesRequest", params: { name: requestName(req), spec: specText("vps", spec) } });
  return req;
}

function morningMail(s: GameState, events: SimEvent[]): void {
  const cache = new Map<string, number>(), site = siteFactor(s);
  for (const f of leadFlows(s)) {
    const n = poisson(s.rng, f.leads / DAYS_PER_MONTH);
    for (let i = 0; i < n; i++) {
      // An order the form takes weighs the setup fee too.
      const need = needFor(s.rng, f.profile), form = isStandard(f.profile, need.sla) && !emailFor(s), k = `${f.profile}/${need.product}/${f.city}/${form}`;
      if (!cache.has(k)) cache.set(k, share(s, f.profile, need.product, f.city, form ? setupPremium(s, need.product) : 0));
      if (rand(s.rng) >= Math.min(1, cache.get(k)! * f.conversion)) continue;
      // Leads only write about lines on the website, which needs a control plane that sells them.
      if (!lineOffered(s, need.product) || !listed(s, need.product)) continue;
      // The order form is part of the website: a down, slow or dated site loses its orders.
      if (form && site < 1 && rand(s.rng) >= site) continue;
      if (!isStandard(f.profile, need.sla)) {
        newLead(s, f.profile, f.city, events, need);
        continue;
      }
      orderLead(s, f.profile, f.city, events, need, !form);
    }
  }
  if (listed(s, "webHosting")) firstOrder(s, events);
  if (s.hour > 2160 && lineOffered(s, "vps") && listed(s, "vps") && rand(s.rng) < SHADY_PER_MONTH / DAYS_PER_MONTH) shadyLead(s, s.locations[0]?.city ?? "Frankfurt", events);
}

// An open upgrade ticket asks what more of each resource of its service would cost; taken, the service grows in place.
function expansions(s: GameState): void {
  for (const t of s.tickets) {
    if (t.kind !== "upgrade" || isFinal(t) || s.sales.requests.some((r) => r.ticketId === t.id)) continue;
    const c = s.customers.find((x) => x.id === t.customerId), v = s.services.find((x) => x.id === t.serviceId);
    if (!c || c.churnedAt !== null || !v || v.endedAt !== null || PRODUCTS[v.product].runsOn === "none" || PRODUCTS[v.product].period !== "hour") continue;
    const loc = s.locations.find((l) => l.az === v.zone);
    const spec = grownSpec(s.seed, Number(t.id.slice(3)) || 0, v.product, v.spec), old = v.spec;
    const r = addRequest(s, {
      kind: "expansion", customerId: c.id, contact: c.name, company: null, profile: c.profile, city: loc?.city ?? s.locations[0].city,
      product: v.product, spec, sla: v.sla, reference: referenceFor(s, c.profile, v.product, spec, v.sla), discount: 0, budget: budgetOf(s.rng),
      shady: !!c.shady, serviceId: v.id, ticketId: t.id, deadline: s.hour + EXPANSION_HOURS,
    }, "sales.msg.upgrade");
    editRequest(s, r.id, (x) => ({ thread: x.thread.map((m, n) => (n ? m : { ...m, params: { ...m.params, product: v.product, ...specParams(old, "0"), ...specParams(spec, "1") } })) }));
    s.tickets = s.tickets.map((x) => (x.id === t.id ? { ...x, topic: "more" } : x));
  }
}

const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 20) || "kunde";
const labelFor = (r: SalesRequest): string => {
  const base = slug(r.company ?? r.contact);
  return r.product === "webHosting" ? r.domain ?? `${base}.de` : `${base}-${r.product === "gameServer" ? "game" : r.product}`;
};

// The cluster or zone in the request's city where the service fits; null when nothing has room.
export function targetFor(s: GameState, r: Pick<SalesRequest, "city" | "product" | "spec">): { clusterId: string | null; zone: string | null } | null {
  // Only zones with the addresses the service needs.
  const zones = s.locations.filter((l) => l.city === r.city && addressesFit(s, l, r.product, r.spec)).map((l) => l.az);
  const spec = PRODUCTS[r.product], size = sizeOf(r.spec);
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

export const habitFor = (r: Rng, p: Profile): PaymentHabit => {
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
    ? provisionService(s, customerId, r.product, { label, spec: r.spec, sla: r.sla, price: r.quote! / 730, clusterId: target.clusterId, zone: target.zone })
    : { ok: false, error: noRoomError(s, r.product) };
  if (!placed.ok) Object.assign(s, before);
  else if (r.kind !== "expansion") editRequest(s, r.id, () => ({ customerId }));
  return placed;
}

export function loseRequest(s: GameState, r: SalesRequest, status: "lost" | "declined", reason: string, params: Record<string, string | number> = {}): void {
  editRequest(s, r.id, () => ({ status, replyAt: null }));
  s.sales = { ...s.sales, lost: [...s.sales.lost, { hour: s.hour, name: requestName(r), product: r.product, spec: r.spec, reference: r.reference, reason, params }].slice(-LOST_KEPT) };
  closeTicket(s, r);
}

const closeTicket = (s: GameState, r: SalesRequest) => {
  if (r.ticketId) s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "closed", updatedAt: s.hour, work: null } : t));
};

function reply(s: GameState, r: SalesRequest, events: SimEvent[]): void {
  const name = requestName(r), spec = specText(r.product, r.spec), price = r.quote!;
  const accepts = (r.counter !== null && price <= r.counter) || rand(s.rng) < acceptChance(s, r, price);
  const php = accepts && r.product === "webHosting" ? phpNeeded(s, r.id, targetFor(s, r)?.clusterId ?? null) : null;
  if (php) {
    say(s, r.id, "customer", "sales.reply.oldPhp", { name: r.contact, version: php });
    loseRequest(s, r, "lost", "lost.oldPhp", { version: php });
    events.push({ app: "Support", key: "event.salesPhp", params: { name, spec, version: php } });
    return;
  }
  if (accepts) {
    say(s, r.id, "customer", "sales.reply.accept", { name: r.contact });
    if (setUp(s, r, events)) return;
    editRequest(s, r.id, () => ({ status: "accepted", replyAt: null, deadline: s.hour + SETUP_WAIT_HOURS }));
    events.push({ app: "Support", key: "event.salesNoRoom", params: { name, spec, city: r.city, hours: SETUP_WAIT_HOURS } });
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

function setUp(s: GameState, r: SalesRequest, events: SimEvent[]): boolean {
  const done = fulfil(s, r);
  if (!done.ok) return false;
  editRequest(s, r.id, () => ({ status: "won", replyAt: null, serviceId: done.id ?? r.serviceId }));
  closeTicket(s, r);
  events.push({ app: "Support", key: "event.salesWon", params: { name: requestName(r), spec: specText(r.product, r.spec), price: r.quote! } });
  return true;
}

// Accepted orders wait for room: each hour the setup is tried again until the customer gives up.
function awaitSetup(s: GameState, events: SimEvent[]): void {
  for (const r of s.sales.requests) {
    if (r.status !== "accepted" || setUp(s, r, events) || s.hour < r.deadline) continue;
    say(s, r.id, "customer", "sales.reply.gone", { name: r.contact });
    loseRequest(s, r, "lost", "lost.noCapacity", { city: r.city });
    events.push({ app: "Support", key: "event.salesFailed", params: { name: requestName(r), spec: specText(r.product, r.spec), city: r.city } });
  }
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
    const n = { ...c };
    bump(n, 0.2 * (memo.get(k)! - c.happiness));
    return n;
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
  awaitSetup(s, events);
  expire(s);
  return events;
}
