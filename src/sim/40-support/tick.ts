import { chance } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import { counts, hoursOn } from "../00-core/workhours";
import type { Customer } from "../30-customers/customers";
import { grantExtension, isSuspended, KEEP_SUSPENDED_HAPPINESS, UNSUSPEND_HAPPINESS } from "../45-billing/billing";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { takenDown } from "../60-infra/ops";
import { applyNoticeWork } from "./notices";
import { applyOrderWork } from "../30-market/orders";
import { howToFactor } from "../85-products/products";
import { phpAbuse } from "../60-infra/php";
import { serviceOnline } from "./status";
import { outgoing, sendAction } from "./replies";
import { overpricing, retains, revertPrice } from "../30-customers/pricing";
import {
  bump, cancelCustomer, createTicket, credit, GAMER_ABUSE_RATE, HOURS_PER_MONTH, isFinal, MONTHLY_RATES, OUTAGE_WRITE_CHANCE,
  profileStats, replyDue, rightTemplate, UPGRADE_CHANCE, WAITING_CLOSE_HOURS, type Ticket,
} from "./tickets";

// A shady customer draws this many times the abuse reports.
export const SHADY_ABUSE = 10;
const RIGHT_ANSWER = 5, WRONG_ANSWER = -10, HISTORY_MONTHS = 12;

function resolve(s: GameState, t: Ticket, c: Customer, outcome: Ticket["outcome"] = null): void {
  Object.assign(t, { status: "resolved", updatedAt: s.hour, outcome });
  if (outcome !== "cancelled" && outcome !== "offerRefused") bump(c, RIGHT_ANSWER);
}

// Player work queued by the support actions takes effect once its time has passed.
function finishWork(s: GameState, customer: (id: string) => Customer, events: SimEvent[]): void {
  const due = s.tickets.filter((t) => t.work && t.work.doneAt <= s.hour * 60).sort((a, b) => a.work!.doneAt - b.work!.doneAt);
  for (const t of due) {
    // An earlier retention loss in this batch may have closed the customer's other tickets.
    if (!t.work) continue;
    const work = t.work, c = customer(t.customerId);
    t.work = null;
    if (t.kind === "order") {
      const e = applyOrderWork(s, t, work.arg, work.by);
      if (e) events.push(e);
      continue;
    }
    if (work.op === "resolve") sendAction(s, t, c, t.kind === "refund" && work.arg === "reject" ? "refuse" : work.arg, work.by);
    if (t.kind === "notice" || t.kind === "legal" || t.kind === "refund") applyNoticeWork(s, t, c, work.arg);
    else if (work.op === "escalate") Object.assign(t, { status: "escalated", updatedAt: s.hour });
    else if (work.op === "reply") {
      const right = work.arg === rightTemplate(s, t);
      t.replies = [...t.replies, { hour: s.hour, template: work.arg, right, ...outgoing(s, t, c, `tpl.${work.arg}`), ...(work.by && { by: work.by }) }];
      t.updatedAt = s.hour;
      if (right) t.status = "waiting";
      else {
        // A wrong answer brings a follow-up in the same thread with a fresh response time.
        bump(c, WRONG_ANSWER);
        Object.assign(t, { status: "open", unread: true, dueAt: replyDue(c, s.hour) });
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
    } else if (work.arg === "retain" && retains(s, c)) {
      credit(s, c, 1);
      resolve(s, t, c, "retained");
    } else {
      cancelCustomer(s, c);
      resolve(s, t, c, work.arg === "retain" ? "offerRefused" : "cancelled");
    }
  }
}

function spawnHourly(s: GameState): void {
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    const { skill } = profileStats(c.profile);
    for (const kind of ["howTo", "billing", "abuse"] as const) {
      const rate = (kind === "abuse" && c.profile === "gamer" ? GAMER_ABUSE_RATE : MONTHLY_RATES[kind][skill] * (kind === "howTo" ? howToFactor(s, c.id) : 1)) * (kind === "abuse" && c.shady ? SHADY_ABUSE : 1) * (kind === "abuse" ? phpAbuse(s, c.id) : 1);
      if (chance(s.rng, rate / HOURS_PER_MONTH)) createTicket(s, c, kind);
    }
  }
}

// A suspended customer knows why their services are off: suspension brings one billing ticket instead.
// An outage hurts only in hours that count on the customer's clock, once it has outlasted their tolerance; they may write in at that moment.
function outages(s: GameState, customer: (id: string) => Customer): void {
  const down = s.services.filter((v) => v.endedAt === null && !serviceOnline(s, v.id) && !isSuspended(s, v.customerId) && !takenDown(s, v.id));
  const since: Record<string, number> = {};
  for (const v of down) {
    since[v.id] = s.downSince[v.id] ?? s.hour;
    const c = customer(v.customerId), p = profileStats(c.profile), { hours, clock } = p.tolerance;
    const elapsed = hoursOn(clock, since[v.id], s.hour);
    if (!counts(clock, s.hour) || elapsed < hours) continue;
    bump(c, -p.outagePenalty);
    if (elapsed > hours || !chance(s.rng, OUTAGE_WRITE_CHANCE[p.budget])) continue;
    for (let i = 0; i < (p.budget === "high" ? 3 : 1); i++) createTicket(s, c, "outage", v.id);
  }
  s.downSince = since;
}

// economy.md, Happiness and churn: a cancellation left open is processed at the next monthly billing date.
// ponytail: every customer rolls monthly churn; yearly contracts rolling 12x at renewal needs billing's renewal dates.
function monthly(s: GameState): void {
  for (const c of s.customers) if (c.churnedAt === null) c.history = [...c.history, c.happiness].slice(-HISTORY_MONTHS);
  overpricing(s);
  for (const t of s.tickets) {
    if (t.kind !== "cancellation" || isFinal(t) || t.createdAt >= s.hour) continue;
    const c = s.customers.find((x) => x.id === t.customerId)!;
    cancelCustomer(s, c);
    Object.assign(t, { status: "closed", updatedAt: s.hour, outcome: "cancelled", work: null });
  }
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    const p = profileStats(c.profile);
    const cancels = c.happiness < 15 || chance(s.rng, p.churn + 0.5 * Math.max(0, (50 - c.happiness) / 50));
    if (cancels && !s.tickets.some((t) => t.customerId === c.id && t.kind === "cancellation" && !isFinal(t))) createTicket(s, c, "cancellation", null);
    else if (chance(s.rng, UPGRADE_CHANCE[p.budget])) createTicket(s, c, "upgrade");
  }
}

export function supportTick(s: GameState): SimEvent[] {
  if (!s.customers.length) return [];
  s.customers = s.customers.map((c) => ({ ...c }));
  s.tickets = s.tickets.map((t) => ({ ...t }));
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  const customer = (id: string) => byId.get(id)!;
  const before = new Set(s.tickets.map((t) => t.id));

  const events: SimEvent[] = [];
  finishWork(s, customer, events);
  for (const t of s.tickets) {
    const c = customer(t.customerId);
    // The customer does not wait on a notice or legal request about them, and an order has no customer yet.
    if (t.notice || t.kind === "order") continue;
    if (t.status === "waiting" && s.hour - t.updatedAt >= WAITING_CLOSE_HOURS) resolve(s, t, c);
    else if (t.status === "escalated" && (!t.serviceId || serviceOnline(s, t.serviceId))) resolve(s, t, c);
    else if (t.status === "open" && c.churnedAt === null && s.hour > t.dueAt) {
      const p = profileStats(c.profile);
      if (counts(p.reply.clock, s.hour)) bump(c, -p.waitPenalty);
    }
  }
  outages(s, customer);
  spawnHourly(s);
  if (isMonthStart(s.hour)) monthly(s);

  const fresh = s.tickets.filter((t) => !before.has(t.id));
  if (fresh.length > 1) return [...events, { app: "Support", key: "event.tickets", params: { count: fresh.length } }];
  if (!fresh.length) return events;
  const t = fresh[0], service = s.services.find((v) => v.id === t.serviceId);
  return [...events, { app: "Support", key: "event.ticket", params: { name: customer(t.customerId).name, subject: `ticket.${t.kind}.${t.topic}.subject`, service: service?.label ?? "" } }];
}
