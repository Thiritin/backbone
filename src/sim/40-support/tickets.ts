import { chance, rand } from "../00-core/rng";
import { addHoursOn } from "../00-core/workhours";
import { CLEAN_MINUTES } from "../10-catalog/apps";
import { PRODUCTS } from "../10-catalog/products";
import { PROFILES, type Budget, type Profile as ProfileStats } from "../10-catalog/economy";
import { activeServices, type Customer, type Product, type Profile, type Service } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { serviceOnline } from "./status";

export type TicketKind = "outage" | "howTo" | "billing" | "upgrade" | "cancellation" | "abuse" | "appeal" | "notice" | "legal" | "refund" | "order" | "extortion" | "migration" | "maintenance" | "sponsor" | "pear" | "mail";
// open: waits for the player. waiting: answered, waits on the customer. escalated: waits for a technician.
export type TicketStatus = "open" | "waiting" | "escalated" | "resolved" | "closed";
export type TicketAction = "credit" | "cancel" | "unsuspend" | "keep" | "forward" | "takedown" | "reject" | "comply" | "object" | "refund" | "accept" | "revert"
  | "offerOnce" | "offerManaged" | "free" | "clean" | "noBackup" | "pay" | "refuse";
// by names the employee who answered; the player otherwise. key and params give the email as sent (replies.ts); older replies show the template.
export interface Reply { hour: number; template: string; right: boolean; by?: string; key?: string; params?: Record<string, string | number> }
// doneAt is in game minutes; the reply or action takes effect on the first tick at or after it.
export interface Work { op: "reply" | "resolve" | "escalate"; arg: string; doneAt: number; by?: string }
// A notice or legal request comes from a sender, not the customer; customerId is "" when no customer uses the domain.
// real is hidden from the player. followAt is the hour the next, angrier step arrives.
export interface Notice { sender: string; from: string; url: string; video: string | null; real: boolean; round: number; followAt: number | null }
// A move offered to the customer: the workload, the target the migrate actions take and its name. windowAt is the hour the
// accepted move starts (null until the customer answers); from is the cluster it ran on when offered; log holds the customer's answers.
export interface Move { workloadId: string; to: string; name: string; from?: string; windowAt: number | null; log: { hour: number; key: string; params: Record<string, number> }[] }
export interface Ticket {
  id: string; customerId: string; serviceId: string | null; kind: TicketKind; topic: string; status: TicketStatus;
  createdAt: number; dueAt: number; updatedAt: number; unread: boolean; replies: Reply[];
  outcome: "credit" | "retained" | "cancelled" | "unsuspended" | "kept" | "forwarded" | "takenDown" | "rejected" | "ignored" | "withdrawn" | "complied" | "objected"
    | "seized" | "refunded" | "refused" | "accepted" | "declined" | "failed" | "offerRefused" | "fixFailed" | "reverted" | "cleaned" | "noBackup" | "updated" | "updateSold" | "managedSold" | "ransomPaid" | "ransomRefused" | "moved" | "moveDeclined" | "sponsored" | "sponsorDeclined" | "domainKept" | null;
  work: Work | null; notice?: Notice; move?: Move;
  // The domain a leaving customer asks to transfer away.
  domain?: string;
  // The maintenance window a maintenance email is about.
  maint?: { windowId: string; from: number; hours: number };
  // The support agent (an employee id) who takes the ticket before anyone else.
  assignee: string | null;
  // An email from a company (bank, supplier) that asks for no reply: who sent it and what fills its text.
  mail?: { from: string; params: Record<string, string | number> };
}

export const HOURS_PER_MONTH = 730;
// Hours a waiting ticket stays open before the customer's silence counts as solved.
export const WAITING_CLOSE_HOURS = 48;

// economy.md, Tickets and work rates.
export const MINUTES: Record<TicketKind, number> = { outage: 10, howTo: 20, billing: 15, upgrade: 20, cancellation: 15, abuse: 30, appeal: 15, notice: 15, legal: 30, refund: 10, order: 10, extortion: 10, migration: 10, maintenance: 10, sponsor: 10, pear: 0, mail: 0 };
export const MONTHLY_RATES: Record<"howTo" | "billing" | "abuse", Record<Budget, number>> = {
  howTo: { low: 0.09, medium: 0.03, high: 0.01 },
  billing: { low: 0.02, medium: 0.02, high: 0.01 },
  abuse: { low: 0.0025, medium: 0.0025, high: 0.01 },
};
// Customers ask most while they set up and rarely once settled: ×2.5 at signup, ×0.85 per month, never below ×0.15.
export const tenureFactor = (s: GameState, c: Customer): number => Math.max(0.15, 2.5 * 0.85 ** ((s.hour - c.since) / HOURS_PER_MONTH));
export const GAMER_ABUSE_RATE = 0.01;
export const UPGRADE_CHANCE: Record<Budget, number> = { low: 0.02, medium: 0.03, high: 0.04 };
export const OUTAGE_WRITE_CHANCE: Record<Budget, number> = { low: 0.3, medium: 0.6, high: 0.9 };

// How-to questions by the services the customer runs and their months with us: newcomers ask how to set things up,
// long-standing customers ask about what changes over the years. basic: answered by a Knowledge base article.
// elsewhere: asked only about a domain registered at another registrar, since ours already uses our nameservers.
export interface HowTo { on: Product[]; without?: Product; minMonths?: number; maxMonths?: number; basic?: true; elsewhere?: true }
const SERVERS: Product[] = ["vps", "dedicated", "cloud", "gpu"];
export const HOW_TO: Record<string, HowTo> = {
  upload: { on: ["webHosting"], maxMonths: 6, basic: true },
  email: { on: ["webHosting"], maxMonths: 12, basic: true },
  dns: { on: ["webHosting"], maxMonths: 3, basic: true, elsewhere: true },
  ssl: { on: ["webHosting"], without: "ssl", basic: true },
  ssh: { on: SERVERS, maxMonths: 6, basic: true },
  panel: { on: ["webHosting", ...SERVERS] },
  phone: { on: ["webHosting"], minMonths: 12, basic: true },
  addon: { on: ["webHosting"], minMonths: 12 },
  php: { on: ["webHosting"], minMonths: 24 },
};
export const KNOWLEDGE_BASE = "Knowledge base";
// Share of basic questions a customer answers from the Knowledge base instead of writing in.
export const KB_DEFLECT = 0.3;

// The question a customer would ask now and the service it is about, drawn among the topics that fit them; null when none does.
export function pickHowTo(s: GameState, c: Customer): { topic: string; serviceId: string } | null {
  const services = activeServices(s.services, c.id), months = (s.hour - c.since) / HOURS_PER_MONTH;
  const fits = Object.entries(HOW_TO).flatMap(([topic, h]) => {
    if (months < (h.minMonths ?? 0) || months >= (h.maxMonths ?? Infinity) || (h.without && services.some((v) => v.product === h.without))) return [];
    const on = services.filter((v) => h.on.includes(v.product) && !(h.elsewhere && s.domains.some((d) => d.name === v.domain && !d.lapsed)));
    return on.length ? [{ topic, on }] : [];
  });
  if (!fits.length) return null;
  const { topic, on } = fits[Math.floor(rand(s.rng) * fits.length)];
  return { topic, serviceId: on[Math.floor(rand(s.rng) * on.length)].id };
}

export const TOPICS: Record<TicketKind, string[]> = {
  outage: ["down"], howTo: Object.keys(HOW_TO), billing: ["charge", "copy", "delay"],
  upgrade: ["grow"], cancellation: ["leave"], abuse: ["spam", "attack"], appeal: ["forgot", "boss", "access", "onWay"],
  notice: ["movie", "music", "youtuber", "phishing", "spam"], legal: ["data", "takedown"], refund: ["outage", "dataLoss"], order: [], extortion: ["data"], migration: ["offer"], maintenance: ["notice", "moved", "move", "declined"], sponsor: [], pear: [], mail: [],
};
export const TEMPLATES: Record<TicketKind, string[]> = {
  outage: ["ack", "back", "askDetails"], howTo: ["ftp", "mail", "dns", "ssl", "ssh", "panel", "addon", "php", "askDetails"],
  billing: ["explain", "resend", "extension", "newPrice", "foundPayment", "askDetails"], upgrade: [], cancellation: [], abuse: ["warn", "askDetails"],
  appeal: ["awaitPayment", "askDetails"], notice: [], legal: [], refund: [], order: [], extortion: [], migration: [], maintenance: [], sponsor: [], pear: [], mail: [],
};
export const ACTIONS: Record<TicketKind, TicketAction[]> = {
  outage: ["credit"], howTo: [], billing: ["credit", "revert"], upgrade: [], cancellation: ["cancel"], abuse: [], appeal: ["unsuspend", "keep"],
  notice: ["forward", "takedown", "reject"], legal: ["comply", "object"], refund: ["refund", "credit", "reject"], order: ["accept", "reject"], extortion: ["pay", "refuse"], migration: [], maintenance: [], sponsor: [], pear: [], mail: [],
};
// Actions only tickets of one topic offer: the customer asks for help with an outdated site, or a defaced site waits for clean-up.
export const TOPIC_ACTIONS: Record<string, TicketAction[]> = { "howTo.update": ["offerOnce", "offerManaged", "free"], "howTo.hacked": ["clean", "noBackup"] };
// Topics with replies of their own and no actions: a suspended customer only needs the invoice to pay it. A transfer
// request is answered with the auth code or refused (90-actions/registrar.ts).
export const TOPIC_TEMPLATES: Record<string, string[]> = { "billing.suspended": ["resend", "askDetails"], "billing.domainOut": [] };
export const ACTION_MINUTES: Partial<Record<TicketAction, number>> = { clean: CLEAN_MINUTES };
export const actionsOf = (t: Pick<Ticket, "kind" | "topic">): TicketAction[] => (`${t.kind}.${t.topic}` in TOPIC_TEMPLATES ? [] : [...ACTIONS[t.kind], ...(TOPIC_ACTIONS[`${t.kind}.${t.topic}`] ?? [])]);
// Tickets with their own actions have no reply templates.
export const templatesOf = (t: Pick<Ticket, "kind" | "topic">): string[] => TOPIC_TEMPLATES[`${t.kind}.${t.topic}`] ?? (`${t.kind}.${t.topic}` in TOPIC_ACTIONS ? [] : TEMPLATES[t.kind]);
// A service that can grow in place: it runs on hardware and bills by the hour. Upgrade requests are only about these.
export const expandable = (v: Service): boolean => PRODUCTS[v.product].runsOn !== "none" && PRODUCTS[v.product].period === "hour";
export const canEscalate = (kind: TicketKind): boolean => kind === "outage";
export const SHORT_REPLIES = 3;
// A desk without the templates feature lists only a few replies; the one that settles the ticket stays in.
export function shownTemplates(s: GameState, t: Ticket, all: boolean): string[] {
  const list = templatesOf(t);
  if (all || list.length <= SHORT_REPLIES) return list;
  const keep = list.slice(0, SHORT_REPLIES), right = rightTemplate(s, t);
  if (!keep.includes(right) && list.includes(right)) keep[keep.length - 1] = right;
  return list.filter((id) => keep.includes(id));
}
// A customer who cannot pay yet (boss, access) has no right reply: only unsuspending or keeping the suspension settles it.
const RIGHT: Record<string, string> = {
  gameVersion: "panel", suspended: "resend", upload: "ftp", email: "mail", phone: "mail", dns: "dns", ssl: "ssl", ssh: "ssh", panel: "panel", addon: "addon", php: "php", charge: "explain", alreadyPaid: "foundPayment", copy: "resend", delay: "extension", price: "newPrice", grow: "offer", disk: "offer", cpu: "offer", full: "offer", more: "offer",
  spam: "warn", attack: "warn", forgot: "awaitPayment", onWay: "awaitPayment", bounce: "mail", mailFull: "offer", quotaFull: "offer", dnsChange: "dns", certLost: "offer", bucketPublic: "offer", linkExpired: "offer", phpBroken: "php", licence: "panel", certExpired: "ssl", lockedOut: "panel", updateBroke: "php", transferFailed: "php",
};

export function rightTemplate(s: GameState, t: Ticket): string {
  if (t.kind === "outage") return t.serviceId && !serviceOnline(s, t.serviceId) ? "ack" : "back";
  return RIGHT[t.topic];
}

const CATALOG_ID: Record<Profile, string> = {
  private: "private", gamer: "gamer", hobbyDev: "hobby", soleProp: "sole", smallBiz: "small",
  agency: "agency", office: "office", onlineShop: "shop", enterprise: "enterprise", reseller: "agency",
};
export const profileStats = (p: Profile): ProfileStats => PROFILES.find((x) => x.id === CATALOG_ID[p])!;

export const serviceMonthly = (v: Service): number => (v.period === "hour" ? v.price * HOURS_PER_MONTH : v.price / 12);
export const monthlyValue = (services: Service[], customerId: string): number =>
  activeServices(services, customerId).reduce((sum, v) => sum + serviceMonthly(v), 0);

export const isFinal = (t: Ticket): boolean => t.status === "resolved" || t.status === "closed";
export const hoursLeft = (t: Ticket, hour: number): number => t.dueAt - hour;

// The hour a reply is due, counted on the customer's clock.
export const replyDue = (c: Customer, hour: number): number => {
  const { hours, clock } = profileStats(c.profile).reply;
  return addHoursOn(clock, hour, hours);
};

// scripts/happiness.ts sets this to attribute every change to its caller.
export const bumpProbe: { fn: ((c: Customer, delta: number) => void) | null } = { fn: null };

export const bump = (c: Customer, delta: number): void => {
  const next = Math.max(0, Math.min(100, c.happiness + delta));
  bumpProbe.fn?.(c, next - c.happiness);
  c.happiness = next;
};

// economy.md, Usage: per hour a slowed service costs SLOW_PENALTY × the share of performance lost, and some write in.
export const SLOW_PENALTY = 0.1;
export const SLOW_TICKET_CHANCE = 0.1;
export function slowed(s: GameState, c: Customer, serviceId: string, lost: number): void {
  bump(c, -SLOW_PENALTY * lost);
  if (s.tickets.some((t) => t.serviceId === serviceId && !isFinal(t)) || !chance(s.rng, SLOW_TICKET_CHANCE * lost)) return;
  createTicket(s, c, "outage", serviceId).topic = "slow";
}

// With both serviceId and topic given, no random number is drawn.
// Delivers a company's email to the inbox; it needs no reply, so it arrives closed.
export function deliverMail(s: GameState, from: string, topic: string, params: Record<string, string | number> = {}): Ticket {
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "mail", topic, status: "closed",
    createdAt: s.hour, dueAt: s.hour, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null, mail: { from, params },
  };
  s.tickets = [...s.tickets, t];
  return t;
}

export function createTicket(s: GameState, c: Customer, kind: TicketKind, serviceId?: string | null, topic?: string): Ticket {
  const services = activeServices(s.services, c.id);
  const topics = TOPICS[kind];
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: c.id,
    serviceId: serviceId !== undefined ? serviceId : services.length ? services[Math.floor(rand(s.rng) * services.length)].id : null,
    kind, topic: topic ?? topics[Math.floor(rand(s.rng) * topics.length)], status: "open",
    createdAt: s.hour, dueAt: replyDue(c, s.hour), updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, t];
  return t;
}

const cents = (v: number) => Math.round(v * 100) / 100;

// A credit of share × the monthly fee; economy.md gives +3 happiness per 10%.
export function credit(s: GameState, c: Customer, share: number): void {
  const amount = cents(share * monthlyValue(s.services, c.id));
  bump(c, 30 * share);
  if (amount <= 0) return;
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "credit", key: "ledger.credit", params: { customer: c.name }, amount: -amount }];
}

// The customer leaves: every service ends and their other tickets close.
export function cancelCustomer(s: GameState, c: Customer): void {
  c.churnedAt = s.hour;
  s.services = s.services.map((v) => (v.customerId === c.id && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  // Callers hold copies of the tickets (the tick copies them, actions clone the state), so they change in place.
  for (const t of s.tickets) if (t.customerId === c.id && !isFinal(t) && t.kind !== "cancellation") Object.assign(t, { status: "closed", updatedAt: s.hour, work: null });
}
