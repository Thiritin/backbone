// economy.md, Security advisories, Breaches and ransom: a critical vulnerability left open for a month lets attackers steal
// the customer data on a host. They demand a ransom; unpaid, or paid to a liar, the data is sold and the press and the data
// protection authority follow.
import { chance, hashRng, rand, type Rng } from "../00-core/rng";
import { hourOf, yearOf } from "../00-core/time";
import { bump, cancelCustomer, monthlyValue, type Ticket } from "../40-support/tickets";
import type { Customer } from "../30-customers/customers";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { addReview } from "../80-business/marketing";
import type { Cluster } from "./cluster";
import type { OpenVuln } from "./vulns";

export type Decision = "pay" | "refuse";
// decision stays null until the ransom is paid or refused. fine is null until the authority decides, then 0 or the sum.
export interface Breach {
  hour: number; hostId: string; ticketId: string; ransom: number; decision: Decision | null; sold: boolean;
  fineAt: number | null; fine: number | null;
}

// Share of the exploitation rolls on a host with a critical vulnerability open this many days that turn into a breach.
export const BREACH_CHANCE = 0.25;
export const BREACH_DAYS = 30;
export const EXTORTION_HOURS = 72;
// Ransom: months of the host customers' revenue, kept between the bounds, then multiplied from the year on.
export const RANSOM = { months: 2, min: 500, max: 50_000, eras: [[2020, 5], [2013, 3]] as [year: number, factor: number][] };
export const PAID_SOLD = 0.1;
export const SALE = { happiness: -40, churn: 0.3, review: 0.2, awareness: 0.8 };
export const FINE_DAYS = 30;
export const GDPR_AT = hourOf(new Date(Date.UTC(2018, 4, 25)));
export const FINE = {
  old: { chance: 0.2, min: 2_000, max: 25_000 },
  gdpr: { chance: 0.5, share: 0.02, min: 2_000, max: 200_000 },
};
export const SENDER = "lockbitt";
const YEAR_HOURS = 8760;

const cents = (v: number) => Math.round(v * 100) / 100;

export const breachOf = (s: GameState, ticketId: string): Breach | undefined => s.breaches.find((b) => b.ticketId === ticketId);

// The customers whose data a host holds: those with a workload on it; a mail server holds every customer's mailbox.
export function customersOn(s: GameState, host: Cluster | undefined): Customer[] {
  if (!host) return [];
  const live = s.customers.filter((c) => c.churnedAt === null);
  if (host.kind === "mail") return live;
  const ids = new Set(s.workloads.filter((w) => w.clusterId === host.id && w.serviceId).map((w) => s.services.find((v) => v.id === w.serviceId)?.customerId));
  return live.filter((c) => ids.has(c.id));
}

// A critical vulnerability open more than a month, on a host with no ransom still undecided.
export const breachEligible = (s: GameState, hostId: string, open: OpenVuln[]): boolean =>
  open.some((v) => v.severity === "critical" && v.days > BREACH_DAYS) && !s.breaches.some((b) => b.hostId === hostId && b.decision === null);

export function ransomFor(s: GameState, customers: Customer[]): number {
  const revenue = customers.reduce((n, c) => n + monthlyValue(s.services, c.id), 0);
  const base = Math.min(RANSOM.max, Math.max(RANSOM.min, RANSOM.months * revenue)), year = yearOf(s.hour);
  return Math.round(base * (RANSOM.eras.find(([from]) => year >= from)?.[1] ?? 1));
}

// Opens the extortion ticket for a breach of this host and returns it with the alert event.
export function startBreach(s: GameState, host: Cluster, events: SimEvent[]): void {
  const customers = customersOn(s, host), ransom = ransomFor(s, customers);
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "extortion", topic: "data", status: "open", createdAt: s.hour,
    dueAt: s.hour + EXTORTION_HOURS, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
    notice: { sender: SENDER, from: "sales@lockbitt.onion", url: "https://lockbitt.onion/listing", video: null, real: true, round: 1, followAt: null },
  };
  s.tickets = [...s.tickets, t];
  s.breaches = [...s.breaches, { hour: s.hour, hostId: host.id, ticketId: t.id, ransom, decision: null, sold: false, fineAt: null, fine: null }];
  events.push({ app: "Support", key: "event.breach", params: { host: host.name, ransom, customers: customers.length, hours: EXTORTION_HOURS } });
}

const idOf = (t: Ticket) => Number(t.id.slice(3)) || 0;
const patch = (s: GameState, b: Breach, p: Partial<Breach>) => { s.breaches = s.breaches.map((x) => (x === b ? { ...x, ...p } : x)); };

// The data is sold: customers lose trust and leave, the press reports it and awareness falls.
function sell(s: GameState, host: Cluster | undefined, r: Rng, events: SimEvent[]): number {
  const customers = customersOn(s, host);
  for (const c of customers) {
    bump(c, SALE.happiness);
    if (chance(r, SALE.churn)) cancelCustomer(s, c);
    if (chance(r, SALE.review)) addReview(s, c.id, 1, "dataLoss");
  }
  s.marketing = { ...s.marketing, awareness: Object.fromEntries(Object.entries(s.marketing.awareness).map(([p, a]) => [p, a * SALE.awareness])) as typeof s.marketing.awareness };
  events.push({ app: "Security", key: "event.breachPress", params: { host: host?.name ?? "", customers: customers.length } });
  return customers.length;
}

// Applies the player's decision, or the refusal the deadline stands for; the caller holds copies of customers and tickets.
export function decideBreach(s: GameState, t: Ticket, decision: Decision, events: SimEvent[]): void {
  const b = breachOf(s, t.id);
  if (!b || b.decision) return;
  const host = s.clusters.find((c) => c.id === b.hostId), r = hashRng(s.seed, b.hour, idOf(t), 98);
  if (decision === "pay") {
    s.cash = cents(s.cash - b.ransom);
    s.ledger = [...s.ledger, { hour: s.hour, category: "fees", key: "ledger.ransom", params: { host: host?.name ?? "" }, amount: -b.ransom }];
  }
  const sold = decision === "refuse" || chance(r, PAID_SOLD);
  Object.assign(t, { status: "resolved", updatedAt: s.hour, work: null, unread: false, outcome: decision === "pay" ? "ransomPaid" : "ransomRefused" });
  patch(s, b, { decision, sold, fine: sold ? null : 0, fineAt: sold ? s.hour + FINE_DAYS * 24 : null });
  if (sold) sell(s, host, r, events);
}

// Twelve months of customer payments up to an hour.
const revenueBefore = (s: GameState, hour: number): number =>
  s.ledger.filter((e) => (e.category === "payments" || e.category === "setup") && e.hour >= hour - YEAR_HOURS && e.hour < hour).reduce((n, e) => n + e.amount, 0);

// The fine for a sale made at an hour, 0 when the authority lets it go.
export function drawFine(s: GameState, soldAt: number, hour: number, r: Rng): number {
  if (soldAt < GDPR_AT) {
    const { chance: p, min, max } = FINE.old;
    return rand(r) < p ? Math.round(min * (max / min) ** rand(r)) : 0;
  }
  const { chance: p, share, min, max } = FINE.gdpr;
  return rand(r) < p ? Math.round(Math.min(max, Math.max(min, share * revenueBefore(s, hour)))) : 0;
}

// Hourly: sales that are a month old meet the data protection authority.
export function breachTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const b of s.breaches) {
    if (!b.sold || b.fine !== null || b.fineAt === null || s.hour < b.fineAt) continue;
    const fine = drawFine(s, b.fineAt - FINE_DAYS * 24, s.hour, hashRng(s.seed, b.hour, Number(b.ticketId.slice(3)) || 0, 99));
    patch(s, b, { fine });
    if (!fine) continue;
    const host = s.clusters.find((c) => c.id === b.hostId)?.name ?? "";
    s.cash = cents(s.cash - fine);
    s.ledger = [...s.ledger, { hour: s.hour, category: "fees", key: "ledger.fine", params: { host }, amount: -fine }];
    events.push({ app: "Security", key: "event.breachFine", params: { host, amount: fine } });
  }
  return events;
}
