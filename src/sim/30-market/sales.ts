// Requests over time: new leads through the day, expansion requests from upgrade tickets, customer replies to quotes,
// expiry into lost sales and the monthly happiness drift. Decisions are recorded in docs/design/economy.md, "Requests, SLAs and growth".
import { rand, type Rng } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import { arrivalWeight } from "../10-catalog/attention";
import { CHOICE_TAU, NEVER_PAYS, ON_TIME } from "../10-catalog/economy";
import { PRODUCTS, sizeSpec, SIZES } from "../10-catalog/products";
import { yearOf } from "../00-core/time";
import { activeServices, type PaymentHabit, type Product, type Profile } from "../30-customers/customers";
import { bump, expandable, isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { betterHost } from "../60-infra/routes";
import { gameFirst, lineOffered, noRoomError, pickNode, serverTaken, supports, withDatastore, workloadsOf } from "../60-infra/cluster";
import { phpNeeded } from "../60-infra/php";
import { installedRamGb, locationOf } from "../60-infra/status";
import { addAwareness } from "../80-business/marketing";
import { mailShare } from "../80-business/mail";
import { listed, siteFactor } from "../80-business/website";
import { forumAwareness } from "../47-staff/staff";
import type { SimEvent } from "../88-tick/tick";
import { addCustomer } from "../90-actions/customers";
import { hiddenTraits } from "../45-billing/fraud";
import { domainFor } from "../30-customers/domains";
import { CERT_SHARE, offerCertificate } from "../30-customers/certificates";
import { shopPriceLevel } from "./cycles";
import { emailFor, firstOrder, isStandard, orderLead, orderQueued } from "./orders";
import { growSlots } from "../60-infra/games";
import { provisionService } from "../90-actions/clusters";
import { addressesFit } from "../60-infra/addresses";
import { withAddressNeeds } from "../10-catalog/addresses";
import { grownSpec, setupPremium, sizeOf, specFor, specText } from "./spec";
import { acceptQuote, resize, specParams } from "./manual";
import { answerQuote } from "./quotes";
import { logActivity } from "../47-staff/activity";
import type { ActionResult } from "../90-actions/hardware";
import { forSale, inStock, shopStocked, soldOutVisit, type ShopProduct } from "../80-business/shop";
import { chooseProduct, packageSpec } from "../80-business/portal";
import { belowFloor, bookingFor, packageNamed } from "../80-business/packages";
import {
  acceptChance, acceptMid, FORUM_AWARENESS, FORUM_PROFILES, leadFlows, missingFor, needFor, referenceFor,
  requestName, share, values, type Need, type SalesMessage, type SalesRequest,
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
export const budgetOf = (r: Rng): number => BUDGET_RANGE[0] + (BUDGET_RANGE[1] - BUDGET_RANGE[0]) * rand(r);

// The spec of the request about to be added, with the addresses its customer needs: drawn with its id as the key, so it is
// stable for a seed.
export const nextSpec = (s: GameState, need: Need, profile: Profile) =>
  withAddressNeeds(s.seed, s.nextId, profile, need.product, specFor(s.seed, s.nextId, need.product, need.size, yearOf(s.hour)), yearOf(s.hour));

// A sales lead writes in its own words, asks for its SLA and weighs your quote against its own budget; from there on it is an order
// ticket in Support like any other, worked step by step.
export function newLead(s: GameState, profile: Profile, city: string, events: SimEvent[], need = needFor(s.rng, profile, yearOf(s.hour))): SalesRequest {
  return orderLead(s, profile, city, events, need, true, undefined, { budget: budgetOf(s.rng) });
}

// High volume, no questions, crypto: pays well and carries a hidden flag for abuse and legal follow-ups.
export function shadyLead(s: GameState, city: string, events: SimEvent[]): SalesRequest {
  const spec = sizeSpec("vps", SIZES.vps.length - 1, yearOf(s.hour));
  return orderLead(s, "hobbyDev", city, events, { product: "vps", size: SIZES.vps.length - 1, sla: "basic" }, true, spec, { budget: 1.8, shady: true, key: "sales.msg.shady" });
}

function newLeads(s: GameState, events: SimEvent[]): void {
  const cache = new Map<string, number>(), site = siteFactor(s);
  for (const f of leadFlows(s)) {
    const n = poisson(s.rng, (f.leads / DAYS_PER_MONTH / 24) * arrivalWeight(f.profile, s.hour));
    for (let i = 0; i < n; i++) {
      // An order the form takes weighs the setup fee too.
      const need = needFor(s.rng, f.profile, yearOf(s.hour)), form = isStandard(f.profile, need.sla) && !emailFor(s), k = `${f.profile}/${need.product}/${f.city}/${form}`;
      if (!cache.has(k)) cache.set(k, share(s, f.profile, need.product, f.city, form ? setupPremium(s, need.product) : 0, form ? shopPriceLevel(s, f.profile, need.product) : undefined));
      if (rand(s.rng) >= Math.min(1, cache.get(k)! * f.conversion)) continue;
      // Leads only write about lines on the website, which needs a control plane that sells them.
      if (!lineOffered(s, need.product) || !listed(s, need.product)) continue;
      // The order form is part of the website: a down, slow or dated site loses its orders. Website leads already carry the factor in their count.
      if (form && !f.site && site < 1 && rand(s.rng) >= site) continue;
      if (!isStandard(f.profile, need.sla)) {
        newLead(s, f.profile, f.city, events, need);
        continue;
      }
      // Email orders thin out while delivery is impaired, and businesses shy away from a freemail address.
      if (!form && mailShare(s, f.profile) < 1 && rand(s.rng) >= mailShare(s, f.profile)) continue;
      // A shop sells only what is in stock; a sold-out visitor leaves no request.
      let spec = form && shopStocked(s) ? nextSpec(s, need, f.profile) : undefined, pick: ShopProduct | undefined;
      // A line with plans sells the plan that fits the visitor; without plans it sells configurable options.
      const plan = spec ? chooseProduct(s, { city: f.city, product: need.product, spec, reference: referenceFor(s, f.profile, need.product, spec, need.sla) }) : null;
      if (plan === "soldOut") {
        soldOutVisit(s, need.product);
        continue;
      }
      if (plan) {
        pick = plan;
        spec = { ...spec!, ...packageSpec(s, plan) };
      } else if (spec && !inStock(s, { city: f.city, product: need.product, spec })) {
        soldOutVisit(s, need.product);
        continue;
      }
      orderLead(s, f.profile, f.city, events, need, !form, spec, undefined, pick);
    }
  }
}

function morningMail(s: GameState, events: SimEvent[]): void {
  if (listed(s, "webHosting")) firstOrder(s, events);
  if (s.hour > 2160 && lineOffered(s, "vps") && listed(s, "vps") && rand(s.rng) < SHADY_PER_MONTH / DAYS_PER_MONTH) shadyLead(s, s.locations[0]?.city ?? "Frankfurt", events);
}

// An open upgrade ticket asks what more of each resource of its service would cost; taken, the service grows in place.
function expansions(s: GameState): void {
  for (const t of s.tickets) {
    if (t.kind !== "upgrade" || isFinal(t) || s.sales.requests.some((r) => r.ticketId === t.id)) continue;
    const c = s.customers.find((x) => x.id === t.customerId), v = s.services.find((x) => x.id === t.serviceId);
    if (!c || c.churnedAt !== null || !v || v.endedAt !== null || !expandable(v)) continue;
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

// The cluster or zone in the request's city where the service fits; null when nothing has room. A shop order only goes
// to software in a server group that sells its line.
export function targetFor(s: GameState, r: Pick<SalesRequest, "city" | "product" | "spec" | "shop" | "productId">): { clusterId: string | null; zone: string | null } | null {
  // Only zones with the addresses the service needs.
  const zones = s.locations.filter((l) => l.city === r.city && addressesFit(s, l, r.product, r.spec)).map((l) => l.az);
  const spec = PRODUCTS[r.product], size = sizeOf(r.spec);
  if (spec.runsOn === "cluster") {
    // A cluster with the RAM for it wins; with none, the first cluster with the disk takes it past its RAM.
    // A product sells from its own server group, and only from installations that have its package.
    const prod = r.productId ? s.shop.products.find((p) => p.id === r.productId) : undefined;
    const pg = prod?.serverGroupId ? s.shop.groups.find((g) => g.id === prod.serverGroupId) : undefined;
    const sold = pg ? new Set(pg.members) : r.shop ? forSale(s, r.product) : null;
    const fit = [...s.clusters].sort((x, y) => gameFirst(x, y) || betterHost(s)(x, y)).filter((x) => zones.includes(x.az) && supports(x, r.product) && (!sold || sold.has(x.id)) && (!prod?.packageName || packageNamed(x, prod.packageName)));
    const c = fit.find((x) => pickNode(s, x, withDatastore(s, x, size), null, x.placement, true)) ?? fit.find((x) => pickNode(s, x, withDatastore(s, x, size)));
    return c ? { clusterId: c.id, zone: c.az } : null;
  }
  if (spec.runsOn === "server") {
    const d = s.devices.find((x) => x.rackId && installedRamGb(x) >= size.ramGb && zones.includes(locationOf(s, x)?.az ?? "") && !serverTaken(s, x.id));
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
    customerId = addCustomer(s, requestName(r), r.profile, r.shady || r.fraud ? "prompt" : habitFor(s.rng, r.profile), r);
    if (r.shady || r.fraud) s.customers = s.customers.map((c) => (c.id === customerId ? { ...c, ...hiddenTraits(s, r) } : c));
  }
  const target = targetFor(s, r);
  const cluster = target?.clusterId ? s.clusters.find((x) => x.id === target.clusterId) : undefined;
  const pkg = cluster && r.pkg ? packageNamed(cluster, r.pkg) : undefined, booking = pkg && !belowFloor(pkg, r.spec) ? bookingFor(pkg, r.spec) : null;
  const placed: ActionResult = target
    ? provisionService(s, customerId, r.product, { label, spec: r.spec, sla: r.sla, price: r.quote! / 730, clusterId: target.clusterId, zone: target.zone, ...(booking && { pkg: { name: pkg!.name, ...booking } }) })
    : { ok: false, error: noRoomError(s, r.product) };
  if (!placed.ok) Object.assign(s, before);
  else if (r.kind !== "expansion") {
    editRequest(s, r.id, () => ({ customerId }));
    const v = r.product === "webHosting" && s.services.find((x) => x.id === placed.id);
    if (v) offerCertificate(s, v, CERT_SHARE.order);
  }
  return placed;
}

export function loseRequest(s: GameState, r: SalesRequest, status: "lost" | "declined", reason: string, params: Record<string, string | number> = {}): void {
  editRequest(s, r.id, () => ({ status, replyAt: null }));
  s.sales = { ...s.sales, lost: [...s.sales.lost, { hour: s.hour, name: requestName(r), product: r.product, spec: r.spec, reference: r.reference, reason, params }].slice(-LOST_KEPT) };
  closeTicket(s, r);
}

// A shop order that cannot be placed is cancelled and refunded; it counts as a sold-out visit, never as a lost sale.
export function cancelShopOrder(s: GameState, r: SalesRequest): void {
  editRequest(s, r.id, () => ({ status: "lost", replyAt: null }));
  closeTicket(s, r);
  soldOutVisit(s, r.product);
}

const closeTicket = (s: GameState, r: SalesRequest) => {
  if (r.ticketId) s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "closed", updatedAt: s.hour, work: null } : t));
};

// The customer answers 4 to 24 hours after a quote, 2 hours after you meet their counter-offer.
const REPLY_MIN = 4, REPLY_SPREAD = 20, COUNTER_REPLY = 2;
export const answerAt = (s: GameState, r: SalesRequest, price: number): number =>
  s.hour + (r.counter !== null && price <= r.counter ? COUNTER_REPLY : REPLY_MIN + Math.floor(rand(s.rng) * REPLY_SPREAD));

// An order's ticket goes back to the inbox when the customer answers with something to act on.
const wake = (s: GameState, id: string): void => {
  const r = s.sales.requests.find((x) => x.id === id)!;
  if (r.kind === "order" || r.kind === "expansion") s.tickets = s.tickets.map((t) => (t.id === r.ticketId && !isFinal(t) ? { ...t, status: "open", unread: true, dueAt: r.deadline, updatedAt: s.hour } : t));
};

// The customer's answer to an upgrade offer: taken, the service grows by the offered route; otherwise a counter or a no.
function replyUpgrade(s: GameState, r: SalesRequest, events: SimEvent[]): void {
  const name = requestName(r), price = r.quote!, v = s.services.find((x) => x.id === r.serviceId && x.endedAt === null);
  if (!v) return loseRequest(s, r, "lost", "lost.declined");
  const accepts = (r.counter !== null && price <= r.counter) || rand(s.rng) < acceptChance(s, r, price);
  if (accepts) {
    say(s, r.id, "customer", "sales.reply.accept", { name: r.contact });
    if (!resize(s, v, r.spec!, r.route ?? "auto", r.city).ok) return loseRequest(s, r, "lost", "lost.noCapacity", { city: r.city });
    growSlots(s, v.id, r.spec!.ramGb / v.spec.ramGb);
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: price / 730, before: undefined } : x));
    say(s, r.id, "you", "sales.you.upgradeDone", { price });
    editRequest(s, r.id, () => ({ status: "won", replyAt: null }));
    closeTicket(s, r);
    logActivity(s, { customerId: v.customerId, serviceId: v.id, by: null, key: "activity.upgrade", params: { price }, minutes: 0 });
    events.push({ app: "Support", key: "event.salesWon", params: { name, spec: specText(r.product, r.spec), price } });
    return;
  }
  const mid = acceptMid(s, r);
  if (r.attempts < 3 && price / r.reference <= mid + NO_BUDGET_GAP) {
    const counter = Math.min(price - 0.01, Math.round(r.reference * mid * 0.97 * 100) / 100);
    editRequest(s, r.id, () => ({ status: "countered", counter, replyAt: null, deadline: s.hour + RETRY_HOURS }));
    say(s, r.id, "customer", "sales.reply.counter", { name: r.contact, price: counter });
    events.push({ app: "Support", key: "event.salesCounter", params: { name, price: counter } });
    wake(s, r.id);
    return;
  }
  say(s, r.id, "customer", "sales.reply.noBudget", { name: r.contact });
  events.push({ app: "Support", key: "event.salesRefused", params: { name } });
  loseRequest(s, r, "lost", "lost.price");
}

function reply(s: GameState, r: SalesRequest, events: SimEvent[]): void {
  if (r.kind === "expansion" && r.spec) return replyUpgrade(s, r, events);
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
    return acceptQuote(s, r, events);
  }
  const mid = acceptMid(s, r), ratio = price / r.reference;
  if (r.attempts < 2 && ratio <= mid + NO_BUDGET_GAP && rand(s.rng) < COUNTER_CHANCE) {
    const counter = Math.min(price - 0.01, Math.round(r.reference * mid * 0.97 * 100) / 100);
    editRequest(s, r.id, () => ({ status: "countered", counter, replyAt: null, deadline: s.hour + RETRY_HOURS }));
    say(s, r.id, "customer", "sales.reply.counter", { name: r.contact, price: counter });
    events.push({ app: "Support", key: "event.salesCounter", params: { name, price: counter } });
    wake(s, r.id);
    return;
  }
  const key = ratio > mid + NO_BUDGET_GAP ? "sales.reply.noBudget" : "sales.reply.refused";
  say(s, r.id, "customer", key, { name: r.contact });
  events.push({ app: "Support", key: "event.salesRefused", params: { name } });
  if (r.attempts < 2) {
    editRequest(s, r.id, () => ({ status: "refused", replyAt: null, deadline: s.hour + RETRY_HOURS }));
    wake(s, r.id);
  } else loseRequest(s, r, "lost", "lost.price");
}

function expire(s: GameState): void {
  for (const r of s.sales.requests) {
    // An accepted quote waits for the steps until its deadline too.
    const accepted = r.status === "accepted";
    if (!(["open", "countered", "refused"].includes(r.status) || accepted) || s.hour < r.deadline || orderQueued(s, r)) continue;
    const missing = missingFor(s, r)[0];
    if (r.shop) cancelShopOrder(s, r);
    else if (r.status !== "open" && !accepted) loseRequest(s, r, "lost", "lost.price");
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
  newLeads(s, events);
  if (s.hour % 24 === MAIL_HOUR) morningMail(s, events);
  expansions(s);
  for (const r of s.sales.requests) {
    if (r.status !== "quoted" || r.replyAt === null || r.replyAt > s.hour) continue;
    reply(s, r, events);
    if (r.kind === "order") answerQuote(s, r.id, events);
  }
  expire(s);
  return events;
}
