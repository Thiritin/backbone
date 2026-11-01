// GDD, Support: abuse and copyright notices, legal requests, refunds after outages; numbers in economy.md, Notices and legal requests.
import { vendorParams } from "../80-business/lexwear";
import { hashRng, rand, type Rng } from "../00-core/rng";
import { activeServices, type Customer } from "../30-customers/customers";
import { serviceFqdn } from "../30-customers/hostnames";
import type { GameState } from "../50-state";
import { serverOf, type Workload } from "../60-infra/cluster";
import { breachOf, decideBreach } from "../60-infra/breach";
import { gridTick, maybeReview, returnSeized, seize } from "../60-infra/incidents";
import type { SimEvent } from "../88-tick/tick";
import { maintParams } from "../60-infra/maintenance";
import { askedIp } from "../60-infra/netsvc-dns";
import { sponsorParams } from "../80-business/community";
import { bump, cancelCustomer, credit, HOURS_PER_MONTH, monthlyValue, type Notice, type Ticket } from "./tickets";

export interface Sender { id: string; name: string; domain: string; topics: string[]; agency: boolean }
export const SENDERS: Sender[] = [
  { id: "warner", name: "Warner Bras.", domain: "warnerbras.com", topics: ["movie"], agency: false },
  { id: "universal", name: "Universal Pickchers", domain: "universalpickchers.com", topics: ["movie"], agency: false },
  { id: "pear", name: "Pear Records", domain: "pear-records.com", topics: ["music"], agency: false },
  { id: "sonny", name: "Sonny Musick", domain: "sonnymusick.com", topics: ["music"], agency: false },
  { id: "timo", name: "TechTimo", domain: "youtubbe.com", topics: ["youtuber"], agency: false },
  { id: "spamhouse", name: "Spamhouse", domain: "spamhouse.org", topics: ["spam"], agency: false },
  { id: "baenk", name: "Deutsche Bänk", domain: "deutsche-baenk.de", topics: ["phishing"], agency: false },
  { id: "bsi", name: "Bundesamt für Sicherheit in der Informationstechnick", domain: "bsi-technick.bund.de", topics: ["data", "takedown"], agency: true },
  { id: "europoll", name: "Europoll", domain: "europoll.europa.eu", topics: ["data", "takedown"], agency: true },
  { id: "fbi", name: "Federal Bureau of Inspection", domain: "fbinspection.gov", topics: ["data", "takedown"], agency: true },
  { id: "lockbitt", name: "Lockbitt Crew", domain: "lockbitt.onion", topics: ["extortion"], agency: false },
];
export const senderById = (id: string): Sender => SENDERS.find((x) => x.id === id)!;

// Notices per customer per month; a shady customer draws far more real ones and legal requests.
export const NOTICE_RATES = { real: 0.01, fake: 0.01, legal: 0.002, shadyReal: 0.3, shadyLegal: 0.06, stray: 0.2 };
export const NOTICE_DAYS = 7;
export const LEGAL_DAYS = [5, 14] as const;
export const COURT_ORDER_DAYS = 3;
export const FOLLOW_DAYS = [3, 7] as const;
export const OBJECT_FOLLOW_UP = { normal: 0.25, shady: 0.5 };
export const TAKEDOWN_HOURS = 48;
export const HAPPINESS = { takedownReal: -5, takedownFake: -25, forwardFake: -2, comply: -15, refund: 20, refuseOutage: -10 };

const PATHS: Record<string, string[]> = {
  movie: ["/downloads/jurassic-parking-1080p.zip", "/stream/the-matrixx.mkv", "/files/lord-of-the-rinks-extended.avi"],
  music: ["/mp3/abbey-rode-full-album.zip", "/music/greatest-hits-2005.rar"],
  youtuber: ["/blog/the-worst-unboxing-video-ever", "/reviews/techtimo-is-overrated"],
  phishing: ["/secure/deutsche-baenk/login.php", "/banking/verify-account.html"],
  spam: ["/newsletter/send.php", "/mailer/bulk.php"],
};
const STRAY_DOMAINS = ["warez-palace.net", "free-movies24.biz", "mp3-heaven.info", "lucky-downloads.org", "cheap-watches-online.com"];
const REAL_TOPICS = ["movie", "music", "phishing", "spam"], FAKE_TOPICS = ["movie", "music", "youtuber"];

const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];
const between = (r: Rng, [lo, hi]: readonly [number, number]) => lo + rand(r) * (hi - lo);
const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The domain a notice names: a service labelled with a domain, otherwise one made from the customer's name.
export function domainOf(s: GameState, c: Customer): { domain: string; serviceId: string } | null {
  const services = activeServices(s.services, c.id);
  if (!services.length) return null;
  const v = services.find((x) => x.domain) ?? services.find((x) => x.label.includes(".") && !x.label.includes(" ")) ?? services[0];
  return { domain: v.domain ?? (v.label.includes(".") && !v.label.includes(" ") ? v.label : `${slug(c.name)}.de`), serviceId: v.id };
}

function addTicket(s: GameState, kind: "notice" | "legal", topic: string, c: Customer | null, serviceId: string | null, notice: Notice, dueHours: number): Ticket {
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId: c?.id ?? "", serviceId, kind, topic, status: "open", createdAt: s.hour, dueAt: s.hour + dueHours,
    updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null, notice,
  };
  s.tickets = [...s.tickets, t];
  return t;
}

// A fake notice writes from a free mail address; the YouTuber always does.
const fromOf = (sender: Sender, real: boolean) =>
  sender.agency ? `requests@${sender.domain}` : real ? `legal@${sender.domain}` : `${sender.id}.legal@gmale.com`;

export function spawnNotice(s: GameState, c: Customer | null, real: boolean, r: Rng, topic = pick(r, real ? REAL_TOPICS : FAKE_TOPICS), round = 1): Ticket {
  const sender = pick(r, SENDERS.filter((x) => x.topics.includes(topic)));
  const target = c && domainOf(s, c);
  const domain = target ? target.domain : pick(r, STRAY_DOMAINS);
  const video = topic === "youtuber" ? `https://youtubbe.com/watch?v=${Math.floor(rand(r) * 36 ** 6).toString(36).padStart(6, "x")}` : null;
  const notice: Notice = { sender: sender.id, from: fromOf(sender, real && topic !== "youtuber"), url: `https://${domain}${pick(r, PATHS[topic])}`, video, real: real && topic !== "youtuber", round, followAt: null };
  return addTicket(s, "notice", topic, target ? c : null, target?.serviceId ?? null, notice, NOTICE_DAYS * 24);
}

export function spawnLegal(s: GameState, c: Customer, r: Rng, round = 1, url?: string): Ticket | null {
  const target = domainOf(s, c);
  if (!target) return null;
  const sender = pick(r, SENDERS.filter((x) => x.agency));
  const days = round > 1 ? COURT_ORDER_DAYS : Math.round(between(r, LEGAL_DAYS));
  const notice: Notice = { sender: sender.id, from: fromOf(sender, true), url: url ?? `https://${target.domain}/`, video: null, real: true, round, followAt: null };
  return addTicket(s, "legal", pick(r, ["data", "takedown"]), c, target.serviceId, notice, days * 24);
}

const setNotice = (t: Ticket, patch: Partial<Notice>) => Object.assign(t, { notice: { ...t.notice!, ...patch } });
const followIn = (s: GameState, r: Rng, days: readonly [number, number]) => s.hour + Math.round(between(r, days) * 24);

// A notice the player took no action on: a real one comes back angrier.
export function ignoreNotice(s: GameState, t: Ticket, r: Rng): void {
  Object.assign(t, { status: "closed", outcome: "ignored", updatedAt: s.hour, work: null, unread: false });
  if (t.notice!.real && t.customerId) setNotice(t, { followAt: followIn(s, r, FOLLOW_DAYS) });
}

// Applies a queued notice, legal or refund action; finishWork in the support tick calls it.
export function applyNoticeWork(s: GameState, t: Ticket, c: Customer | undefined, action: string): void {
  const r = hashRng(s.seed, s.hour, Number(t.id.slice(3)) || 0, 95);
  const done = (outcome: Ticket["outcome"]) => Object.assign(t, { status: "resolved", updatedAt: s.hour, outcome });
  const real = !!t.notice?.real;
  if (t.kind === "notice") {
    if (action === "forward") {
      done("forwarded");
      if (c && !real) bump(c, HAPPINESS.forwardFake);
      // A shady customer leaves the content up.
      if (c && real && c.shady) setNotice(t, { followAt: followIn(s, r, FOLLOW_DAYS) });
    } else if (action === "takedown") {
      done("takenDown");
      if (t.serviceId) s.ops = { ...s.ops, takedowns: { ...s.ops.takedowns, [t.serviceId]: s.hour + TAKEDOWN_HOURS } };
      if (c) bump(c, real ? HAPPINESS.takedownReal : HAPPINESS.takedownFake);
    } else {
      done("rejected");
      if (real && c) setNotice(t, { followAt: followIn(s, r, FOLLOW_DAYS) });
    }
  } else if (t.kind === "legal") {
    if (action === "comply") {
      done("complied");
      if (c) bump(c, HAPPINESS.comply);
    } else {
      done("objected");
      if (t.notice!.round === 1 && c && rand(r) < (c.shady ? OBJECT_FOLLOW_UP.shady : OBJECT_FOLLOW_UP.normal)) setNotice(t, { followAt: followIn(s, r, [2, 5]) });
    }
  } else if (c) {
    if (action === "refund") {
      const amount = Math.round(monthlyValue(s.services, c.id) * 100) / 100;
      bump(c, HAPPINESS.refund);
      if (amount > 0) {
        s.cash = Math.round((s.cash - amount) * 100) / 100;
        s.ledger = [...s.ledger, { hour: s.hour, category: "credit", key: "ledger.refund", params: { customer: c.name }, amount: -amount }];
      }
      done("refunded");
      // economy.md, Reviews: a customer refunded after a data loss gives 3 stars 60% of the time.
      if (t.topic === "dataLoss") maybeReview(s, c, "dataLoss", r, [], rand(r) < 0.6 ? 3 : undefined);
    } else if (action === "credit") {
      credit(s, c, 0.1);
      done("credit");
    } else if (t.topic === "dataLoss") {
      cancelCustomer(s, c);
      done("cancelled");
    } else {
      bump(c, HAPPINESS.refuseOutage);
      done("refused");
    }
  }
}

const answeredInTime = (t: Ticket) => !!t.work && t.work.doneAt <= t.dueAt * 60;

function deadlines(s: GameState, r: Rng, events: SimEvent[]): void {
  for (const t of s.tickets) {
    if (!t.notice || s.hour < t.dueAt || answeredInTime(t)) continue;
    if (t.kind === "extortion") { if (t.status === "open") decideBreach(s, t, "refuse", events); continue; }
    if (t.kind === "notice" && t.status === "open") ignoreNotice(s, t, r);
    else if (t.kind === "legal" && (t.outcome === null || t.outcome === "ignored")) {
      Object.assign(t, { status: "closed", outcome: "seized", updatedAt: s.hour, work: null });
      const at = (w: Workload) => { const id = serverOf(s, w); return id && s.devices.some((d) => d.id === id) ? id : null; };
      const deviceId = s.workloads.filter((w) => w.serviceId === t.serviceId).map(at).find((id) => id)
        ?? s.workloads.filter((w) => s.services.find((v) => v.id === w.serviceId)?.customerId === t.customerId).map(at).find((id) => id);
      if (deviceId) seize(s, deviceId, senderById(t.notice.sender).name, r, events);
    }
  }
}

function followUps(s: GameState, r: Rng): Ticket[] {
  const fresh: Ticket[] = [];
  for (const t of s.tickets) {
    if (!t.notice || t.notice.followAt === null || t.notice.followAt > s.hour) continue;
    const { round, url } = t.notice;
    setNotice(t, { followAt: null });
    const c = s.customers.find((x) => x.id === t.customerId);
    if (!c || c.churnedAt !== null) continue;
    const next = t.kind === "notice" && round === 1
      ? spawnNotice(s, c, true, r, t.topic, 2)
      : spawnLegal(s, c, r, t.kind === "legal" ? 2 : 1, url);
    if (next && t.kind === "notice" && round === 1) Object.assign(next.notice!, { sender: t.notice.sender, from: t.notice.from, url });
    if (next) fresh.push(next);
  }
  return fresh;
}

function spawn(s: GameState, r: Rng): Ticket[] {
  const fresh: Ticket[] = [];
  // A board sponsor who misuses the server is hidden but still draws notices.
  const live = s.customers.filter((c) => c.churnedAt === null || (c.sponsor && c.shady && !!domainOf(s, c)));
  for (const c of live) {
    const real = (c.shady ? NOTICE_RATES.shadyReal : NOTICE_RATES.real) / HOURS_PER_MONTH;
    const legal = (c.shady ? NOTICE_RATES.shadyLegal : NOTICE_RATES.legal) / HOURS_PER_MONTH;
    const roll = rand(r);
    if (roll >= real + NOTICE_RATES.fake / HOURS_PER_MONTH + legal || !domainOf(s, c)) continue;
    if (roll < real) fresh.push(spawnNotice(s, c, true, r));
    else if (roll < real + legal) { const t = spawnLegal(s, c, r); if (t) fresh.push(t); }
    else fresh.push(spawnNotice(s, c, false, r));
  }
  if (live.length && rand(r) < NOTICE_RATES.stray / HOURS_PER_MONTH) fresh.push(spawnNotice(s, null, rand(r) < 0.5, r));
  return fresh;
}

const breachParams = (s: GameState, t: Ticket) => {
  const b = breachOf(s, t.id);
  return { host: s.clusters.find((c) => c.id === b?.hostId)?.name ?? "", ransom: b?.ransom ?? 0 };
};

export const subjectParams = (s: GameState, t: Ticket): Record<string, string | number> => ({
  service: s.services.find((v) => v.id === t.serviceId)?.label ?? "", hostname: serviceFqdn(s, s.services.find((v) => v.id === t.serviceId)), domain: s.services.find((v) => v.id === t.serviceId)?.domain ?? s.sales.requests.find((r) => r.ticketId === t.id)?.domain ?? "", url: t.notice?.url ?? "", ip: t.topic === "dnsChange" ? askedIp(s, t.id) : "", video: t.notice?.video ?? "",
  target: t.move?.name ?? "", round: t.notice?.round ?? 1, sender: t.notice ? senderById(t.notice.sender).name : "",
  ...(t.kind === "extortion" && breachParams(s, t)),
  ...(t.maint && maintParams(t.maint)),
  ...(t.kind === "sponsor" && sponsorParams(s, t)),
  ...t.mail?.params,
  ...(t.kind === "mail" && t.topic.startsWith("lexwear.") && vendorParams(t.mail!.params)),
});

// Hourly, before the infrastructure and support ticks: grid outages, returned servers, notices, deadlines and seizures.
export function opsTick(s: GameState): SimEvent[] {
  s.customers = s.customers.map((c) => ({ ...c }));
  s.tickets = s.tickets.map((t) => ({ ...t }));
  const events = [...returnSeized(s), ...gridTick(s)];
  const r = hashRng(s.seed, s.hour, 0, 93);
  deadlines(s, r, events);
  const fresh = [...followUps(s, r), ...spawn(s, r)];
  for (const t of fresh) {
    events.push({ app: "Support", key: "event.ticket", params: { ...subjectParams(s, t), ticketId: t.id, name: senderById(t.notice!.sender).name, subject: `ticket.${t.kind}.${t.topic}.subject` } });
  }
  return events;
}
