import { hashRng, rand } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { candidate, CANDIDATE_DAYS, marketSalary } from "../47-staff/staff";
import { isFinal, type Ticket } from "../40-support/tickets";
import { metrics } from "../metrics";
import {
  EVENTS, eventById, FAIL_AWARENESS, FAIL_REVIEWS, LEADS, MAX_DOWN_HOURS, OFFER_HOURS, RECOMMEND_CHANCE, RECOMMEND_SKILL, REQUEST_DAYS, REVIEW_CHANCE,
  type CommunityEvent, type SponsorReward, type Sponsorship,
} from "./community";
import { addAwareness, addReview } from "./marketing";
import { listed } from "./website";
import { lineOffered } from "../60-infra/cluster";

const DAY = 24;
const cents = (v: number) => Math.round(v * 100) / 100;
const patch = (s: GameState, id: string, f: (x: Sponsorship) => Partial<Sponsorship>) => {
  s.sponsorships = s.sponsorships.map((x) => (x.id === id ? { ...x, ...f(x) } : x));
};
const closeTicket = (s: GameState, id: string, outcome: Ticket["outcome"]) => {
  s.tickets = s.tickets.map((t) => (t.id === id && !isFinal(t) ? { ...t, status: "closed", outcome, updatedAt: s.hour, unread: false, work: null } : t));
};

// A request about every 4 to 8 weeks, drawn from the events open at the company's level that want a line the company sells.
function request(s: GameState, events: SimEvent[]): void {
  const last = s.sponsorships.reduce((m, x) => Math.max(m, x.offeredAt), 0), r = hashRng(s.seed, s.sponsorships.length, 21);
  const [lo, hi] = REQUEST_DAYS;
  if (s.hour < last + (lo + Math.floor(rand(r) * (hi - lo + 1))) * DAY) return;
  const level = metrics(s).level.level, pool = EVENTS.filter((e) => e.level <= level && lineOffered(s, e.product) && listed(s, e.product));
  if (!pool.length) return;
  const ev = pool[Math.floor(rand(r) * pool.length)];
  const ticket: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "sponsor", topic: ev.id, status: "open",
    createdAt: s.hour, dueAt: s.hour + OFFER_HOURS, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, ticket];
  s.sponsorships = [...s.sponsorships, {
    id: `spn${s.nextId++}`, event: ev.id, ticketId: ticket.id, offeredAt: s.hour, status: "offered", customerId: null, serviceIds: [],
    startedAt: 0, endsAt: 0, endedAt: null, down: {}, seen: {}, reward: null,
  }];
  events.push({ app: "Support", key: "event.sponsorRequest", params: { event: ev.name } });
}

// Awareness, know-how, a review and leads, or two bad reviews and lost awareness when a service was down too long.
function settle(s: GameState, sp: Sponsorship, ev: CommunityEvent, events: SimEvent[]): void {
  const worst = Math.max(0, ...Object.values(sp.down));
  if (worst > MAX_DOWN_HOURS) {
    for (let i = 0; i < FAIL_REVIEWS; i++) addReview(s, sp.customerId!, 1, "sponsor");
    s.marketing.awareness = { ...s.marketing.awareness, ...Object.fromEntries(ev.audience.map((p) => [p, s.marketing.awareness[p] * FAIL_AWARENESS])) };
    patch(s, sp.id, () => ({ reward: null }));
    events.push({ app: "Marketing", key: "event.sponsorFailed", params: { event: ev.name, hours: Math.ceil(worst) } });
    return;
  }
  const r = hashRng(s.seed, Number(sp.id.slice(3)), 22);
  const reward: SponsorReward = { knowHow: ev.knowHow, awareness: ev.awareness, stars: null, recommendation: false, leads: 0 };
  if (ev.kind === "tech") {
    s.knowHow = cents(s.knowHow + ev.knowHow);
    if (rand(r) < RECOMMEND_CHANCE) {
      const c = candidate(r, `cand${s.nextId++}`, "technician", s.hour);
      const skill = Math.min(95, c.skill + RECOMMEND_SKILL);
      s.candidates = [...s.candidates, { ...c, skill, talent: Math.max(c.talent, skill + 5), salary: marketSalary({ role: c.role, skill }, s.hour), leaveAt: s.hour + CANDIDATE_DAYS * DAY }];
      reward.recommendation = true;
    }
  } else {
    for (const p of ev.audience) addAwareness(s, p, ev.awareness);
    if (rand(r) < REVIEW_CHANCE) {
      addReview(s, sp.customerId!, 5, "sponsor");
      reward.stars = 5;
    }
    reward.leads = LEADS[0] + Math.floor(rand(r) * (LEADS[1] - LEADS[0] + 1));
  }
  patch(s, sp.id, () => ({ reward }));
  events.push({ app: "Marketing", key: "event.sponsorDone", params: { event: ev.name, knowHow: reward.knowHow, awareness: Math.round(ev.awareness * 100), stars: reward.stars ?? 0, recommendation: reward.recommendation ? 1 : 0, leads: reward.leads } });
}

// Counts each running event's hours down per service, and ends the ones whose time is up.
function running(s: GameState, events: SimEvent[]): void {
  for (const sp of s.sponsorships.filter((x) => x.status === "running")) {
    const down = { ...sp.down }, seen: Record<string, number> = {};
    for (const id of sp.serviceIds) {
      const cur = s.downHours[id] ?? 0, before = sp.seen[id] ?? 0;
      down[id] = (down[id] ?? 0) + (cur >= before ? cur - before : cur);
      // The month's billing run clears downHours in this hour.
      seen[id] = isMonthStart(s.hour) ? 0 : cur;
    }
    patch(s, sp.id, () => ({ down, seen }));
    const alive = s.services.some((v) => sp.serviceIds.includes(v.id) && v.endedAt === null);
    if (s.hour < sp.endsAt && alive) continue;
    s.services = s.services.map((v) => (sp.serviceIds.includes(v.id) && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
    s.tickets = s.tickets.map((t) => (t.customerId === sp.customerId && !isFinal(t) ? { ...t, status: "closed", updatedAt: s.hour, unread: false, work: null } : t));
    patch(s, sp.id, () => ({ status: "done", endedAt: s.hour }));
    settle(s, { ...sp, down }, eventById(sp.event)!, events);
  }
}

// An unanswered request lapses after two weeks without penalty.
function lapse(s: GameState): void {
  for (const sp of s.sponsorships.filter((x) => x.status === "offered" && s.hour - x.offeredAt >= OFFER_HOURS)) {
    closeTicket(s, sp.ticketId, "ignored");
    patch(s, sp.id, () => ({ status: "declined" }));
  }
}

// Hourly, before billing: requests, downtime counting, rewards.
export function communityTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  lapse(s);
  running(s, events);
  request(s, events);
  return events;
}
