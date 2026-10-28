import { chance } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import type { Customer } from "../30-customers/customers";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { serviceOnline } from "./status";
import {
  bump, cancelCustomer, createTicket, credit, GAMER_ABUSE_RATE, HOURS_PER_MONTH, isFinal, MONTHLY_RATES, OUTAGE_WRITE_CHANCE,
  profileStats, rightTemplate, UPGRADE_CHANCE, WAITING_CLOSE_HOURS, type Ticket,
} from "./tickets";

const RIGHT_ANSWER = 5, WRONG_ANSWER = -10;

function resolve(s: GameState, t: Ticket, c: Customer, outcome: Ticket["outcome"] = null): void {
  Object.assign(t, { status: "resolved", updatedAt: s.hour, outcome });
  if (outcome !== "cancelled") bump(c, RIGHT_ANSWER);
}

// Player work queued by the support actions takes effect once its time has passed.
function finishWork(s: GameState, customer: (id: string) => Customer): void {
  const due = s.tickets.filter((t) => t.work && t.work.doneAt <= s.hour * 60).sort((a, b) => a.work!.doneAt - b.work!.doneAt);
  for (const t of due) {
    // An earlier retention loss in this batch may have closed the customer's other tickets.
    if (!t.work) continue;
    const work = t.work, c = customer(t.customerId);
    t.work = null;
    if (work.op === "escalate") Object.assign(t, { status: "escalated", updatedAt: s.hour });
    else if (work.op === "reply") {
      const right = work.arg === rightTemplate(s, t);
      t.replies = [...t.replies, { hour: s.hour, template: work.arg, right }];
      t.updatedAt = s.hour;
      if (right) t.status = "waiting";
      else {
        // A wrong answer brings a follow-up in the same thread with a fresh response time.
        bump(c, WRONG_ANSWER);
        Object.assign(t, { status: "open", unread: true, dueAt: s.hour + profileStats(c.profile).promisedHours });
      }
    } else if (work.arg === "credit") {
      credit(s, c, 0.1);
      resolve(s, t, c, "credit");
    } else if (work.arg === "retain" && chance(s.rng, c.happiness >= 30 ? 0.3 : 0.1)) {
      credit(s, c, 1);
      resolve(s, t, c, "retained");
    } else {
      cancelCustomer(s, c);
      resolve(s, t, c, "cancelled");
    }
  }
}

function spawnHourly(s: GameState): void {
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    const { skill } = profileStats(c.profile);
    for (const kind of ["howTo", "billing", "abuse"] as const) {
      const rate = kind === "abuse" && c.profile === "gamer" ? GAMER_ABUSE_RATE : MONTHLY_RATES[kind][skill];
      if (chance(s.rng, rate / HOURS_PER_MONTH)) createTicket(s, c, kind);
    }
  }
}

function outages(s: GameState, customer: (id: string) => Customer): void {
  const down = s.services.filter((v) => v.endedAt === null && !serviceOnline(s, v.id));
  for (const v of down) {
    const c = customer(v.customerId), p = profileStats(c.profile);
    bump(c, -p.outagePenalty);
    if (s.servicesDown.includes(v.id) || !chance(s.rng, OUTAGE_WRITE_CHANCE[p.budget])) continue;
    for (let i = 0; i < (p.budget === "high" ? 3 : 1); i++) createTicket(s, c, "outage", v.id);
  }
  s.servicesDown = down.map((v) => v.id);
}

// economy.md, Happiness and churn: a cancellation left open is processed at the next monthly billing date.
// ponytail: every customer rolls monthly churn; yearly contracts rolling 12x at renewal needs billing's renewal dates.
function monthly(s: GameState): void {
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

  finishWork(s, customer);
  for (const t of s.tickets) {
    const c = customer(t.customerId);
    if (t.status === "waiting" && s.hour - t.updatedAt >= WAITING_CLOSE_HOURS) resolve(s, t, c);
    else if (t.status === "escalated" && (!t.serviceId || serviceOnline(s, t.serviceId))) resolve(s, t, c);
    else if (t.status === "open" && c.churnedAt === null && s.hour > t.dueAt) bump(c, -profileStats(c.profile).waitPenalty);
  }
  outages(s, customer);
  spawnHourly(s);
  if (isMonthStart(s.hour)) monthly(s);

  const fresh = s.tickets.filter((t) => !before.has(t.id));
  if (fresh.length > 1) return [{ app: "Support", key: "event.tickets", params: { count: fresh.length } }];
  if (!fresh.length) return [];
  const t = fresh[0], service = s.services.find((v) => v.id === t.serviceId);
  return [{ app: "Support", key: "event.ticket", params: { name: customer(t.customerId).name, subject: `ticket.${t.kind}.${t.topic}.subject`, service: service?.label ?? "" } }];
}
