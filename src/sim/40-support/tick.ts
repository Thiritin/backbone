import { chance, rand } from "../00-core/rng";
import { CRYPTO_ABUSE, PAYSAFE_CHURN } from "../10-catalog/payments";
import { refundUnused, termRoll } from "./terms";
import { isMonthStart, nowMinutes } from "../00-core/time";
import { counts } from "../00-core/workhours";
import { noticed, segmentOf } from "../10-catalog/attention";
import { activeServices, type Customer } from "../30-customers/customers";
import { resellerAbuse } from "../30-customers/resellers";
import { serviceFqdn } from "../30-customers/hostnames";
import { grantExtension, serviceHeld, KEEP_SUSPENDED_HAPPINESS, UNSUSPEND_HAPPINESS } from "../45-billing/billing";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { fullBoost, fullServer } from "../60-infra/games";
import { takenDown } from "../60-infra/ops";
import { liveServices, readOnlySweep } from "../60-infra/status";
import { coverage } from "../60-infra/maintenance";
import { applyNoticeWork } from "./notices";
import { applyOrderWork } from "../30-market/orders";
import { howToFactor } from "../85-products/products";
import { movesTick } from "../90-actions/moves";
import { phpAbuse } from "../60-infra/php";
import { APP_ACTIONS, applyAppWork } from "../60-infra/apps";
import { decideBreach } from "../60-infra/breach";
import { serviceOnline } from "./status";
import { outgoing, sendAction } from "./replies";
import { overpricing, revertPrice } from "../30-customers/pricing";
import { CERT_SHARE, offerCertificate } from "../30-customers/certificates";
import { applyRetention, cancelReason, endDiscounts, FIX_CHECK, sendOffer, settleFix, type RetentionId } from "./retention";
import {
  bump, cancelCustomer, createTicket, credit, expandable, GAMER_ABUSE_RATE, HOURS_PER_MONTH, HOW_TO, isFinal, KB_DEFLECT, KNOWLEDGE_BASE, MONTHLY_RATES, OUTAGE_WRITE_CHANCE,
  pickHowTo, profileStats, replyDue, rightTemplate, tenureFactor, TOPICS, UPGRADE_CHANCE, WAITING_CLOSE_HOURS, type Ticket,
} from "./tickets";

// A shady customer draws this many times the abuse reports.
export const SHADY_ABUSE = 10;
const RIGHT_ANSWER = 5, WRONG_ANSWER = -10, HISTORY_MONTHS = 12;
// A right first answer within FAST_HOURS of the ticket opening adds FAST_ANSWER happiness.
export const FAST_HOURS = 2, FAST_ANSWER = 2;

function resolve(s: GameState, t: Ticket, c: Customer, outcome: Ticket["outcome"] = null): void {
  Object.assign(t, { status: "resolved", updatedAt: s.hour, outcome });
  if (outcome !== "cancelled" && outcome !== "offerRefused" && outcome !== "fixFailed" && outcome !== "noBackup") bump(c, RIGHT_ANSWER);
}

// Player work queued by the support actions takes effect once its time has passed.
function finishWork(s: GameState, customer: (id: string) => Customer, events: SimEvent[]): void {
  const due = s.tickets.filter((t) => t.work && t.work.doneAt <= nowMinutes(s)).sort((a, b) => a.work!.doneAt - b.work!.doneAt);
  for (const t of due) {
    // An earlier retention loss in this batch may have closed the customer's other tickets.
    if (!t.work) continue;
    const work = t.work, c = customer(t.customerId);
    t.work = null;
    if (t.kind === "extortion") {
      decideBreach(s, t, work.arg === "pay" ? "pay" : "refuse", events);
      continue;
    }
    if (t.kind === "order") {
      const e = applyOrderWork(s, t, work.arg, work.by);
      if (e) events.push(e);
      continue;
    }
    if (t.kind === "cancellation" && (work.arg.startsWith("retain.") || work.arg === FIX_CHECK)) {
      const check = work.arg === FIX_CHECK, id = work.arg.slice(7) as RetentionId;
      if (c.churnedAt !== null) {
        Object.assign(t, { status: "closed", updatedAt: s.hour });
        continue;
      }
      if (!check) sendOffer(s, t, c, id, work.by);
      const result = check ? settleFix(s, t, c) : applyRetention(s, t, id);
      if (result === "waiting") continue;
      if (result !== "retained") cancelCustomer(s, c);
      resolve(s, t, c, result);
      continue;
    }
    if (work.op === "resolve") sendAction(s, t, c, work.arg !== "reject" ? work.arg : t.kind === "refund" ? "refuse" : t.kind === "notice" && !t.customerId ? "notOurs" : "reject", work.by);
    if (t.kind === "notice" || t.kind === "legal" || t.kind === "refund") applyNoticeWork(s, t, c, work.arg);
    else if (work.op === "escalate") Object.assign(t, { status: "escalated", updatedAt: s.hour });
    else if (work.op === "reply") {
      const right = work.arg === rightTemplate(s, t);
      if (right && !t.replies.length && s.hour - t.createdAt <= FAST_HOURS) bump(c, FAST_ANSWER);
      t.replies = [...t.replies, { hour: s.hour, template: work.arg, right, ...outgoing(s, t, c, `tpl.${work.arg}`), ...(work.by && { by: work.by }) }];
      t.updatedAt = s.hour;
      if (right) {
        t.status = "waiting";
        const hosting = t.kind === "howTo" && t.topic === "ssl" && s.services.find((v) => v.id === t.serviceId && v.endedAt === null);
        if (hosting && offerCertificate(s, hosting, CERT_SHARE.asked)) events.push({ app: "Books", key: "event.certificateSold", params: { name: c.name, domain: hosting.domain ?? hosting.label } });
      } else {
        // A wrong answer brings a follow-up in the same thread with a fresh response time.
        bump(c, WRONG_ANSWER);
        Object.assign(t, { status: "open", unread: true, dueAt: replyDue(c, s.hour) });
      }
    } else if (APP_ACTIONS.includes(work.arg as never)) {
      const outcome = applyAppWork(s, t, c, work.arg);
      if (outcome) resolve(s, t, c, outcome);
      else {
        // The customer turns the offer down; the thread stays open for another one.
        Object.assign(t, { status: "open", unread: true, dueAt: replyDue(c, s.hour) });
        events.push({ app: "Support", key: "event.offerDeclined", params: { name: c.name } });
      }
    } else if (work.arg === "credit") {
      credit(s, c, 0.1);
      resolve(s, t, c, "credit");
    } else if (work.arg === "unsuspend") {
      grantExtension(s, c.id);
      bump(c, UNSUSPEND_HAPPINESS);
      resolve(s, t, c, "unsuspended");
    } else if (work.arg === "keep") {
      bump(c, KEEP_SUSPENDED_HAPPINESS);
      resolve(s, t, c, "kept");
    } else if (work.arg === "revert") {
      revertPrice(s, t.serviceId);
      resolve(s, t, c, "reverted");
    } else {
      cancelCustomer(s, c);
      resolve(s, t, c, "cancelled");
    }
  }
}

// A customer whose live services are all held draws no abuse.
const allHeld = (s: GameState, customerId: string): boolean => {
  const mine = liveServices(s, customerId);
  return mine.length > 0 && mine.every((v) => serviceHeld(s, v));
};

// Tickets of a kind a customer opens per month.
export function monthlyRate(s: GameState, c: Customer, kind: "howTo" | "billing" | "abuse"): number {
  const { skill } = profileStats(c.profile);
  return (kind === "abuse" && c.profile === "gamer" ? GAMER_ABUSE_RATE : MONTHLY_RATES[kind][skill] * (kind === "howTo" ? howToFactor(s, c.id) * tenureFactor(s, c) : 1)) * (kind === "abuse" && c.shady ? SHADY_ABUSE : 1) * (kind === "abuse" && c.method === "crypto" ? CRYPTO_ABUSE : 1) * (kind === "abuse" ? phpAbuse(s, c.id) * resellerAbuse(s, c.id) * (allHeld(s, c.id) ? 0 : 1) : 1);
}

function spawnHourly(s: GameState): void {
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    for (const kind of ["howTo", "billing", "abuse"] as const) {
      const rate = monthlyRate(s, c, kind);
      if (!chance(s.rng, rate / HOURS_PER_MONTH)) continue;
      if (kind !== "howTo") { createTicket(s, c, kind); continue; }
      const ask = pickHowTo(s, c);
      if (!ask) continue;
      if (HOW_TO[ask.topic].basic && s.installed.includes(KNOWLEDGE_BASE) && chance(s.rng, KB_DEFLECT)) s.kbReads = { ...s.kbReads, [ask.topic]: (s.kbReads[ask.topic] ?? 0) + 1 };
      else createTicket(s, c, kind, ask.serviceId, ask.topic);
    }
  }
}

// A suspended customer knows why their services are off: suspension brings one billing ticket instead.
// An outage hurts only once the customer noticed it (10-catalog/attention.ts), in hours that count on their clock; they may
// write in in the hour they notice.
function outages(s: GameState, customer: (id: string) => Customer): void {
  const down = readOnlySweep(s, () => s.services.filter((v) => v.endedAt === null && !serviceOnline(s, v.id) && !serviceHeld(s, v) && !takenDown(s, v.id)));
  const since: Record<string, number> = {};
  for (const v of down) {
    since[v.id] = s.downSince[v.id] ?? s.hour;
    const c = customer(v.customerId), p = profileStats(c.profile), { clock } = p.tolerance;
    // Downtime inside an announced window costs nothing and the outage counts from the window's end; a late announcement halves it.
    const cover = coverage(s, v), share = cover?.factor ?? 1;
    if (share === 0) { since[v.id] = cover!.end; continue; }
    const n = noticed(s.seed, c.id, v.id, segmentOf(c.profile, v.product), since[v.id], s.hour);
    if (!n.seen || (!n.fresh && !counts(clock, s.hour))) continue;
    bump(c, -p.outagePenalty * share);
    if (!n.fresh || !chance(s.rng, OUTAGE_WRITE_CHANCE[p.budget] * share)) continue;
    for (let i = 0; i < (p.budget === "high" ? 3 : 1); i++) createTicket(s, c, "outage", v.id);
  }
  s.downSince = since;
}

// economy.md, Happiness and churn: a cancellation left open is processed at the next monthly billing date.
// A customer inside a paid term does not roll until the month the term ends, when one roll covers all its months.
function monthly(s: GameState): void {
  for (const c of s.customers) if (c.churnedAt === null) c.history = [...c.history, c.happiness].slice(-HISTORY_MONTHS);
  overpricing(s);
  endDiscounts(s);
  for (const t of s.tickets) {
    if (t.kind !== "cancellation" || isFinal(t) || t.createdAt >= s.hour || t.work?.arg === FIX_CHECK) continue;
    const c = s.customers.find((x) => x.id === t.customerId)!;
    refundUnused(s, c);
    cancelCustomer(s, c);
    Object.assign(t, { status: "closed", updatedAt: s.hour, outcome: "cancelled", work: null });
  }
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    const p = profileStats(c.profile), term = termRoll(s, c.id);
    const cancels = !(term.committed && c.happiness >= 15) && (c.happiness < 15 || chance(s.rng, Math.min(0.9, p.churn * (c.method === "paysafe" ? PAYSAFE_CHURN : 1) * term.months) + 0.5 * Math.max(0, (50 - c.happiness) / 50)));
    if (cancels && !s.tickets.some((t) => t.customerId === c.id && t.kind === "cancellation" && !isFinal(t))) createTicket(s, c, "cancellation", null).topic = cancelReason(s, c);
    else if (chance(s.rng, UPGRADE_CHANCE[p.budget] * fullBoost(s, c.id))) {
      const grow = activeServices(s.services, c.id).filter(expandable), full = fullServer(s, c.id);
      if (grow.length) createTicket(s, c, "upgrade", (grow.find((v) => v.id === full?.serviceId) ?? grow[Math.floor(rand(s.rng) * grow.length)]).id, TOPICS.upgrade[0]);
    }
  }
}

// Between hourly ticks: the queued work whose minute has come.
export function workTick(s: GameState): SimEvent[] {
  if (!s.tickets.some((t) => t.work && t.work.doneAt <= nowMinutes(s))) return [];
  s.customers = s.customers.map((c) => ({ ...c }));
  s.tickets = s.tickets.map((t) => ({ ...t }));
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  const customer = (id: string) => byId.get(id) ?? s.customers.find((c) => c.id === id)!;
  const events: SimEvent[] = [];
  finishWork(s, customer, events);
  return events;
}

export function supportTick(s: GameState): SimEvent[] {
  // Queued order work still runs before the first customer exists.
  if (!s.customers.length && !s.tickets.some((t) => t.work)) return [];
  s.customers = s.customers.map((c) => ({ ...c }));
  s.tickets = s.tickets.map((t) => ({ ...t }));
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  // An order step may open an account during the tick.
  const customer = (id: string) => byId.get(id) ?? s.customers.find((c) => c.id === id)!;
  const before = new Set(s.tickets.map((t) => t.id));

  const events: SimEvent[] = [];
  finishWork(s, customer, events);
  events.push(...movesTick(s, customer));
  for (const t of s.tickets) {
    const c = customer(t.customerId);
    // The customer does not wait on a notice or legal request about them, nor on an order before their account exists.
    // An order waiting on payment stays open until paid.
    if (t.work?.arg === FIX_CHECK) continue;
    if (t.notice || t.kind === "migration" || t.kind === "sponsor" || t.kind === "pear" || (t.kind === "order" && (!t.customerId || t.status !== "open"))) continue;
    if (t.status === "waiting" && s.hour - t.updatedAt >= WAITING_CLOSE_HOURS) resolve(s, t, c);
    else if (t.status === "escalated" && (!t.serviceId || serviceOnline(s, t.serviceId))) resolve(s, t, c);
    else if (t.status === "open" && c.churnedAt === null && s.hour > t.dueAt) {
      const p = profileStats(c.profile);
      if (counts(p.reply.clock, s.hour)) bump(c, -p.waitPenalty);
    }
  }
  outages(s, customer);
  readOnlySweep(s, () => spawnHourly(s));
  if (isMonthStart(s.hour)) monthly(s);

  const fresh = s.tickets.filter((t) => !before.has(t.id));
  if (fresh.length > 1) return [...events, { app: "Support", key: "event.tickets", params: { count: fresh.length } }];
  if (!fresh.length) return events;
  const t = fresh[0], service = s.services.find((v) => v.id === t.serviceId);
  return [...events, { app: "Support", key: "event.ticket", params: { ticketId: t.id, name: customer(t.customerId).name, subject: `ticket.${t.kind}.${t.topic}.subject`, service: service?.label ?? "", hostname: serviceFqdn(s, service) } }];
}
