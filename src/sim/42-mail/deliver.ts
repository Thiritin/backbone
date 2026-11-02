// The delivery pipeline: the only way a message enters a mailbox (docs/design/plans/mail-core.md, Routing, Filters, Junk).
import { binomial, chance, hashRng, rand } from "../00-core/rng";
import { nowMinutes, yearOf } from "../00-core/time";
import { companyDomain } from "../30-customers/domains";
import { mailServerDown } from "../80-business/mail";
import { FREEMAIL_DOMAINS } from "../30-customers/addresses";
import { NOTARY_MAIL, OFFICE_MAIL } from "../80-business/paperwork";
import { deskOf, tenantHost } from "../10-catalog/desks";
import { SENDERS } from "../10-catalog/mail-senders";
import { JUNK_CAP_PER_DAY, JUNK_TOPICS, SELF_TRAINED_CATCH, catchOf, falseJunkOf, junkFloor, spamShare } from "../10-catalog/mail-senders";
import type { GameState } from "../50-state";
import { roleAccount, roleAddress, vacationOn } from "./accounts";
import { CONTACTS, mailSend, SOURCE_KIND, type MailFrom } from "./sources";
import { capsOf, mailHooks, mxTarget, selfHostCaps } from "./caps";
import { accountByAddress, MAIL_KEEP, SYS_FOLDERS, tenantOf, view } from "./model";
import { GMIX_DOMAIN } from "./new";
import type { Ticket } from "../40-support/tickets";
import type { Attachment, DeskChannel, MailAccount, MailCond, MailGroup, MailKind, MailParams, MailTenant, Message, Queued, TraceEntry } from "./types";

export interface Inbound {
  to: string; from: string; kind: MailKind; topic?: string; p?: MailParams; own?: { subject: string; text: string };
  ticket?: string; att?: Attachment[]; cc?: string[]; auto?: true; re?: string; thread?: string; kb?: number; foot?: string;
  hops?: number;  // forwards and auto-replies this message has passed through
}
export interface Delivery { result: TraceEntry["result"]; why: string; account: string | null; id?: string }

export const MAIL_HOPS = 10;
const FORWARD_HOPS = 3;
const QUEUE_CAP = 200, QUEUE_HOURS = 120;
const TRACE_CAP = 200, TRACE_MIN = 7 * 24 * 60;
const PURGE_MIN = 30 * 24 * 60;
const JUNK_SAMPLES = 30;
const CRITICAL: MailKind[] = ["bank", "notice", "authority"];
const OPEN_TICKET = ["open", "waiting", "escalated"];

const KB: Partial<Record<MailKind, number>> = {
  order: 60, support: 40, notice: 80, invoice: 120, promotion: 45, newsletter: 30, spam: 25, bank: 12, authority: 15,
  licence: 8, registrar: 6, host: 6, staff: 5, alert: 3, bounce: 4, system: 3, reply: 4,
};
const ATT_KB: Record<Attachment["k"], number> = { key: 2, doc: 50, invoice: 60, file: 0 };
// Mail grows heavier over the years.
export const kbOf = (kind: MailKind, year: number, att: Attachment[] = [], own = false): number =>
  Math.round(((own ? 4 : KB[kind] ?? 5) + att.reduce((n, a) => n + (a.k === "file" ? a.kb : ATT_KB[a.k]), 0)) * (1 + 0.12 * (year - 2005)));

const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const live = (s: GameState, t: MailTenant | undefined): t is MailTenant => !!t && (t.endsAt === null || t.endsAt > s.hour);
const closed = (s: GameState, a: MailAccount): boolean => { const t = tenantOf(s, a); return a.closedAt !== null || !live(s, t) || !!t.locked; };
const patchBox = (s: GameState, id: string, p: Partial<MailAccount>): void => {
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === id ? { ...a, ...p } : a)) };
};
const boxById = (s: GameState, id: string) => s.mail.accounts.find((a) => a.id === id);

// Domains the world knows: freemail, customers', system senders' and the offices'. Mail elsewhere bounces.
function knownDomain(s: GameState, domain: string): boolean {
  const of = (address: string) => address.split("@")[1];
  return FREEMAIL_DOMAINS.includes(domain) || [OFFICE_MAIL, NOTARY_MAIL, ...Object.values(SENDERS)].some((x) => of(x) === domain) ||
    s.customers.some((c) => of(c.address.email) === domain) || hostedDesk(s) === domain;
}

// The domain a hosted desk takes mail on, so a forward rule can reach it.
function hostedDesk(s: GameState): string | null {
  const d = deskOf(s);
  return d?.hosting === "hosted" && s.desk!.tenant ? tenantHost(d, s.desk!.tenant) : null;
}
export const hostedDeskAddress = (s: GameState): string | null => { const h = hostedDesk(s); return h && `support@${h}`; };

type Resolved = { accounts: MailAccount[]; group?: MailGroup } | { why: "unknown" | "closed" | "stale" | "external" };

// Which mailboxes an address reaches: a GMix box, a box, alias or group of the tenant the MX names, or the catch-all.
function resolve(s: GameState, address: string): Resolved {
  const addr = address.trim().toLowerCase(), [local, domain, ...rest] = addr.split("@");
  if (!local || !domain || rest.length) return { why: "unknown" };
  const stale = s.mail.retired.some((r) => r.address === addr && r.until > s.hour) ? "stale" : "unknown";
  const one = (a: MailAccount | undefined): Resolved => (!a ? { why: stale } : closed(s, a) ? { why: "closed" } : { accounts: [a] });
  if (domain === GMIX_DOMAIN) return one(accountByAddress(s, addr));
  if (domain !== companyDomain(s)) return knownDomain(s, domain) ? { why: "external" } : { why: "unknown" };
  const t = mxTarget(s);
  if (!t || !t.verified) return { why: "unknown" };
  const a = accountByAddress(s, addr, t.id);
  if (a) return one(a);
  const g = s.mail.groups.find((x) => x.tenant === t.id && x.local === local);
  if (g) return t.locked ? { why: "closed" } : { accounts: g.members.map((id) => boxById(s, id)!).filter((m) => m && !closed(s, m)), group: g };
  const c = s.mail.catchAll ? boxById(s, s.mail.catchAll) : undefined;
  return c && c.tenant === t.id && capsOf(s, c).catchAll ? one(c) : { why: stale };
}

function trace(s: GameState, m: Message, result: TraceEntry["result"], why: string, account: string | null): void {
  const now = nowMinutes(s), e: TraceEntry = { at: now, from: m.from, to: m.to, kind: m.kind, topic: m.topic, result, why, account };
  s.mail = { ...s.mail, trace: [...s.mail.trace.filter((x) => x.at > now - TRACE_MIN), e].slice(-TRACE_CAP) };
}

// Newest first, filtered as Lookout 365 Message trace asks.
export function deliveryTrace(s: GameState, q: { address?: string; from?: string; result?: TraceEntry["result"]; sinceHours?: number } = {}): TraceEntry[] {
  const since = q.sinceHours === undefined ? -Infinity : nowMinutes(s) - q.sinceHours * 60;
  return s.mail.trace.filter((e) => e.at >= since && (!q.address || e.to === q.address) && (!q.from || e.from === q.from) && (!q.result || e.result === q.result)).reverse();
}

// Adds a message to a box without checks, counts its size and folds the oldest mail past MAIL_KEEP.
export function store(s: GameState, a: MailAccount, m: Message): void {
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [a.id]: [...(s.mail.msgs[a.id] ?? []), m] } };
  patchBox(s, a.id, { usedKb: a.usedKb + m.kb });
  if ((s.mail.msgs[a.id]?.length ?? 0) > MAIL_KEEP) retain(s, a.id);
}

// Folds the oldest mail into `older`, read mail first, never flagged mail, custom folders, drafts or open requests.
export function retain(s: GameState, accountId: string): void {
  const box = s.mail.msgs[accountId] ?? [], a = boxById(s, accountId);
  if (!a || box.length <= MAIL_KEEP) return;
  const tickets = new Map(s.tickets.map((t) => [t.id, t]));
  const folds = (m: Message) => !m.flag && !m.star && !m.draft && (SYS_FOLDERS as string[]).includes(m.folder) &&
    !(m.ticket && OPEN_TICKET.includes(tickets.get(m.ticket)?.status ?? ""));
  const read = (m: Message) => { const t = m.ticket ? tickets.get(m.ticket) : undefined; return t ? !t.unread : !!m.read; };
  const gone = new Set<string>();
  for (const pass of [true, false]) for (const m of box) {
    if (box.length - gone.size <= MAIL_KEEP) break;
    if (folds(m) && read(m) === pass) gone.add(m.id);
  }
  const kb = box.reduce((n, m) => n + (gone.has(m.id) ? m.kb : 0), 0);
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [accountId]: box.filter((m) => !gone.has(m.id)) } };
  patchBox(s, accountId, { older: { n: a.older.n + gone.size, kb: a.older.kb + kb } });
}

// The Mailer-Daemon notice in the mailbox that sent a message that could not be delivered.
function bounceBack(s: GameState, m: Message, why: string): void {
  const sender = m.from.startsWith("acct:") ? boxById(s, m.from.slice(5)) : undefined;
  if (!sender) return;
  const topic = why === "full" ? "bounceFull" : why === "closed" ? "bounceClosed" : why === "loop" ? "bounceLoop" : "bounceUser";
  const id = `msg${s.nextId++}`;
  store(s, sender, { id, thread: m.thread, folder: "inbox", from: "daemon", to: `${sender.local}@${sender.domain}`, kind: "bounce", topic, p: { address: m.to }, at: nowMinutes(s), kb: kbOf("bounce", yearOf(s.hour)), re: m.id });
}

function bounce(s: GameState, m: Message, why: string, account: string | null = null): Delivery {
  trace(s, m, "bounced", why, account);
  bounceBack(s, m, why);
  return { result: "bounced", why, account };
}

export function deliver(s: GameState, inb: Inbound, o: { junkChecked?: boolean } = {}): Delivery {
  const year = yearOf(s.hour), id = `msg${s.nextId++}`;
  const m: Message = {
    id, thread: inb.thread ?? inb.ticket ?? id, folder: "inbox", from: inb.from, to: inb.to.trim().toLowerCase(), kind: inb.kind, topic: inb.topic ?? "",
    ...(inb.p && { p: inb.p }), ...(inb.own && { own: inb.own }), ...(inb.ticket && { ticket: inb.ticket }), ...(inb.att?.length && { att: inb.att }),
    ...(inb.cc?.length && { cc: inb.cc }), ...(inb.auto && { auto: true as const }), ...(inb.re && { re: inb.re }), ...(inb.foot && { foot: inb.foot }),
    at: nowMinutes(s), kb: inb.kb ?? kbOf(inb.kind, year, inb.att, !!inb.own),
  };
  const hops = inb.hops ?? 0;
  if (hops > MAIL_HOPS) return bounce(s, m, "loop");
  const r = resolve(s, m.to);
  if ("why" in r) {
    if (r.why !== "external") return bounce(s, m, r.why);
    trace(s, m, "accepted", "ok", null);
    if (m.to === hostedDeskAddress(s)) mailHooks.deskInbound(s, m);
    return { result: "accepted", why: "ok", account: null };
  }
  let first: Delivery | null = null;
  r.accounts.forEach((a, i) => {
    const copy = i === 0 ? m : { ...m, id: `msg${s.nextId++}` };
    const label = r.group?.label ? s.mail.folders.find((f) => f.accountId === a.id && f.label && f.name === r.group!.label) : undefined;
    const d = into(s, a, label ? { ...copy, labels: [label.id] } : copy, hops, !!o.junkChecked);
    first ??= d;
  });
  return first ?? bounce(s, m, "unknown");
}

const selfDown = (s: GameState, t: MailTenant | undefined): boolean => t?.host === "self" && mailServerDown(s, t.clusterId);
const fits = (s: GameState, a: MailAccount, kb: number): boolean => a.usedKb + kb <= capsOf(s, a).quotaMb * 1024;

function queue(s: GameState, a: MailAccount, m: Message, why: Queued["why"]): Delivery {
  if (s.mail.queue.length >= QUEUE_CAP) {
    patchBox(s, a.id, { dropped: a.dropped + 1 });
    return bounce(s, m, why, a.id);
  }
  s.mail = { ...s.mail, queue: [...s.mail.queue, { accountId: a.id, msg: m, until: s.hour + QUEUE_HOURS, why }] };
  trace(s, m, "queued", why, a.id);
  return { result: "queued", why, account: a.id, id: m.id };
}

function into(s: GameState, a: MailAccount, m: Message, hops: number, junkChecked: boolean): Delivery {
  if (selfDown(s, tenantOf(s, a))) return queue(s, a, m, "down");
  if (!fits(s, a, m.kb)) return queue(s, a, m, "full");
  return accept(s, a, m, hops, junkChecked);
}

// The chance the host's filter catches a junk message for this mailbox.
export function catchRate(s: GameState, a: MailAccount): number {
  const t = tenantOf(s, a)!, pref = a.prefs?.spam;
  if (pref === "off") return 0;
  let c = catchOf(t.host, t.plan);
  if (t.host === "self") c = Math.max(c, Math.min(SELF_TRAINED_CATCH, c + a.trained * 0.01)) + selfHostCaps(s).junkBonus;
  return Math.min(0.999, c + (pref === "strict" ? 0.05 : 0));
}

const protectedHost = (s: GameState, t: MailTenant): boolean =>
  t.host === "goggle" || t.host === "lookout" || (t.host === "self" && s.company.mail.kind === "self" && s.company.mail.software === "mailpig");

// Filters, forwarder, junk, desk channel and vacation reply for a message the box has room for.
function accept(s: GameState, a: MailAccount, m: Message, hops: number, junkChecked: boolean): Delivery {
  const caps = capsOf(s, a), forwards: string[] = [];
  let result: TraceEntry["result"] = "accepted", why = "ok", notJunk = false;
  if (caps.serverFilters !== "none") for (const f of s.mail.filters) {
    if (f.accountId !== a.id || !f.on || !matchesConditions(s, m, f.match, f.conds)) continue;
    result = "filtered"; why = "filter";
    let stop = false;
    for (const act of f.acts) {
      if (act.do === "move") m.folder = act.folder;
      else if (act.do === "label" && caps.labels) m.labels = [...new Set([...(m.labels ?? []), act.label])];
      else if (act.do === "star") m.star = true;
      else if (act.do === "read") m.read = true;
      else if (act.do === "forward") forwards.push(act.to);
      else if (act.do === "trash") { m.prev = m.folder; m.folder = "trash"; }
      else if (act.do === "junk") m.folder = "junk";
      else if (act.do === "notJunk") notJunk = true;
      else if (act.do === "stop") stop = true;
    }
    if (stop) break;
  }
  const fwd = a.forward, onward = hops < FORWARD_HOPS;
  if (fwd) forwards.push(fwd.to);
  // At the hop limit the forward stops and the message stays here.
  const keep = !fwd || fwd.keep || !onward;
  // The webmail's allowed and blocked senders: comma lists of addresses in prefs.
  const sender = m.folder === "inbox" ? view(s, m).fromAddress.toLowerCase() : "";
  const listed = (k: string) => !!sender && String(a.prefs?.[k] ?? "").split(",").some((x) => x.trim().toLowerCase() === sender);
  if (listed("allow")) notJunk = true;
  else if (listed("block")) { m.folder = "junk"; result = "quarantined"; why = "junk"; }
  if (m.folder === "inbox" && !notJunk && !junkChecked && a.prefs?.spam !== "off") {
    const strict = a.prefs?.spam === "strict" ? 2 : 1;
    // Hashed draws, so mail never shifts the game's other random events.
    const r = hashRng(s.seed, num(m.id), num(a.id), 7331);
    const caught = m.kind === "spam" ? chance(r, catchRate(s, a)) : !CRITICAL.includes(m.kind) && chance(r, falseJunkOf(tenantOf(s, a)!.host) * strict);
    if (caught) { m.folder = "junk"; result = "quarantined"; why = "junk"; }
  }
  if (keep && !(m.folder === "junk" && m.kind === "spam" && a.prefs?.spamAction === "delete")) {
    store(s, a, m);
  }
  trace(s, m, result, why, a.id);
  if (onward) for (const to of forwards) deliver(s, { ...m, to, hops: hops + 1 }, { junkChecked: true });
  if (keep && m.folder === "inbox") vacationReply(s, boxById(s, a.id)!, m, hops);
  return { result, why, account: a.id, id: m.id };
}

// What a desk channel does with a message it imported: keep and read leave a copy, move files it, delete sends it to Trash.
export function applyAfter(s: GameState, ch: DeskChannel, id: string): void {
  if (ch.after === "keep") return;
  const box = s.mail.msgs[ch.accountId] ?? [];
  const patch = (m: Message): Message => ch.after === "read" ? { ...m, read: true } : ch.after === "move" && ch.folder ? { ...m, folder: ch.folder }
    : ch.after === "delete" ? { ...m, prev: m.folder, folder: "trash" } : m;
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [ch.accountId]: box.map((m) => (m.id === id ? patch(m) : m)) } };
}

// The Sent copy of a ticket reply in the mailbox it went out from, with the desk's number token when it has one.
export function sentCopy(s: GameState, t: Ticket, reply: number, accountId: string, token = ""): void {
  const a = boxById(s, accountId);
  if (!a) return;
  const to = s.customers.find((c) => c.id === t.customerId)?.address.email ?? "";
  const m: Message = {
    id: `msg${s.nextId++}`, thread: t.id, folder: "sent", from: `acct:${a.id}`, to, kind: "reply", topic: "", ticket: t.id, reply,
    ...(token && { p: { token } }), at: nowMinutes(s), kb: kbOf("reply", yearOf(s.hour)), read: true,
  };
  store(s, a, m);
}

// Out-of-office: only to the company's own boxes and addresses the player wrote to. Hosts with loop protection answer a
// sender once a week and never answer an auto-reply; the others loop until the hop limit.
function vacationReply(s: GameState, a: MailAccount, m: Message, hops: number): void {
  if (!vacationOn(a, s.hour) || !(m.from.startsWith("acct:") || m.from.startsWith("ext:"))) return;
  const to = view(s, m).fromAddress, t = tenantOf(s, a)!, now = nowMinutes(s);
  if (!to || m.from === `acct:${a.id}`) return;
  if (protectedHost(s, t) && (m.auto || (s.mail.msgs[a.id] ?? []).some((x) => x.auto && x.folder === "sent" && x.to === to && x.at > now - 7 * 24 * 60))) return;
  const own = { subject: a.vacation!.subject, text: a.vacation!.text };
  const sent: Message = { id: `msg${s.nextId++}`, thread: m.thread, folder: "sent", from: `acct:${a.id}`, to, kind: "reply", topic: "", own, auto: true, re: m.id, at: now, kb: kbOf("reply", yearOf(s.hour), [], true) };
  store(s, a, sent);
  deliver(s, { to, from: `acct:${a.id}`, kind: "reply", own, auto: true, re: m.id, thread: m.thread, hops: hops + 1 });
}

const textOf = (s: GameState, m: Message, field: MailCond["field"]): string[] => {
  if (field === "from") { const v = view(s, m); return [v.fromAddress, v.fromName]; }
  if (field === "to") return [m.to, ...(m.cc ?? [])];
  if (field === "subject") return [view(s, m).subject];
  if (field === "kind") return [m.kind];
  if (field === "attachment") return (m.att ?? []).map((x) => (x.k === "file" ? x.name : x.k));
  return [String(m.kb)];
};

// The evaluator server filters and client rules share, so a rule means the same in both places.
export function matchesConditions(s: GameState, m: Message, match: "all" | "any", conds: MailCond[]): boolean {
  if (!conds.length) return false;
  const one = (c: MailCond): boolean => {
    if (c.op === "over") return (c.field === "size" ? m.kb : Number(textOf(s, m, c.field)[0])) > Number(c.value);
    const v = String(c.value).toLowerCase();
    return textOf(s, m, c.field).some((x) => {
      const t = x.toLowerCase();
      return c.op === "is" ? t === v : c.op === "starts" ? t.startsWith(v) : c.op === "ends" ? t.endsWith(v) : t.includes(v);
    });
  };
  return match === "all" ? conds.every(one) : conds.some(one);
}

// Mailboxes that receive mail now: GMix boxes and the boxes of the tenant the MX names.
const receiving = (s: GameState): MailAccount[] => {
  const target = mxTarget(s);
  return s.mail.accounts.filter((a) => {
    const t = tenantOf(s, a);
    return !closed(s, a) && !a.shared && (t?.domain === GMIX_DOMAIN || (!!t && t.id === target?.id && t.verified));
  });
};

const published = (s: GameState, a: MailAccount): boolean =>
  a.id === s.mail.primary || (["sales", "support", "abuse"] as const).some((r) => roleAccount(s, r)?.id === a.id);

// Expected junk a day: the year's spam share of the box's real traffic, never below the year's floor, times exposure.
export function junkPerDay(s: GameState, a: MailAccount): number {
  const year = yearOf(s.hour), share = spamShare(year), since = nowMinutes(s) - 7 * 24 * 60;
  const legit = (s.mail.msgs[a.id] ?? []).filter((m) => m.at > since && m.kind !== "spam" && m.folder !== "sent" && m.folder !== "drafts").length / 7;
  const exposure = ((published(s, a) ? 1 : 0.3) + (s.mail.catchAll === a.id ? 4 : 0)) * (a.domain === GMIX_DOMAIN ? 1.2 : 1);
  return Math.min(JUNK_CAP_PER_DAY, Math.max(junkFloor(year), (legit * share) / (1 - share)) * exposure);
}

// Expected junk a day that gets past the host's filter into the Inbox; a desk reads it for its junk tickets.
export const junkPassPerDay = (s: GameState, accountId: string): number => {
  const a = boxById(s, accountId);
  return a && receiving(s).some((x) => x.id === a.id) ? junkPerDay(s, a) * (1 - catchRate(s, a)) : 0;
};

function junkDay(s: GameState, a: MailAccount): void {
  const r = hashRng(s.seed, s.hour, num(a.id), 9151), e = junkPerDay(s, a), n = Math.floor(e) + (chance(r, e % 1) ? 1 : 0);
  const caught = binomial(r, n, catchRate(s, a)), year = yearOf(s.hour);
  const topics = JUNK_TOPICS.filter((x) => x.since <= year);
  const junk = (): Inbound => { const j = topics[Math.floor(rand(r) * topics.length)]; return { to: `${a.local}@${a.domain}`, from: `n:${j.from}`, kind: "spam", topic: `junk.${j.id}` }; };
  patchBox(s, a.id, { junkCaught: Math.round((a.junkCaught * 29) / 30) + caught });
  // Caught junk is a count; the newest few are kept so the Junk folder shows what was caught.
  if (a.prefs?.spamAction !== "delete") for (let i = 0; i < Math.min(caught, JUNK_SAMPLES); i++) {
    const j = junk(), id = `msg${s.nextId++}`, m: Message = { id, thread: id, folder: "junk", from: j.from, to: j.to, kind: "spam", topic: j.topic!, at: nowMinutes(s), kb: kbOf("spam", year) };
    store(s, boxById(s, a.id)!, m);
    trace(s, m, "quarantined", "junk", a.id);
  }
  const box = s.mail.msgs[a.id] ?? [], samples = box.filter((m) => m.folder === "junk" && m.kind === "spam");
  if (samples.length > JUNK_SAMPLES) drop(s, a.id, new Set(samples.slice(0, samples.length - JUNK_SAMPLES).map((m) => m.id)));
  for (let i = 0; i < n - caught; i++) deliver(s, junk(), { junkChecked: true });
}

// Removes messages for good and frees their quota.
export function drop(s: GameState, accountId: string, ids: Set<string>): void {
  const box = s.mail.msgs[accountId] ?? [], a = boxById(s, accountId);
  if (!a) return;
  const kb = box.reduce((n, m) => n + (ids.has(m.id) ? m.kb : 0), 0);
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [accountId]: box.filter((m) => !ids.has(m.id)) } };
  patchBox(s, accountId, { usedKb: Math.max(0, a.usedKb - kb) });
}

// Retries queued mail like an MTA; after five days it goes to the primary mailbox if that has room, else it is rejected.
function flushQueue(s: GameState): void {
  if (!s.mail.queue.length) return;
  const q = s.mail.queue;
  s.mail = { ...s.mail, queue: [] };
  for (const e of q) {
    const a = boxById(s, e.accountId), m = { ...e.msg, late: true as const };
    if (!a || closed(s, a)) { bounce(s, m, "closed", e.accountId); continue; }
    if (!selfDown(s, tenantOf(s, a)) && fits(s, a, m.kb)) { accept(s, a, m, 0, false); continue; }
    if (e.until > s.hour) { s.mail = { ...s.mail, queue: [...s.mail.queue, e] }; continue; }
    const p = boxById(s, s.mail.primary);
    if (p && p.id !== a.id && !closed(s, p) && !selfDown(s, tenantOf(s, p)) && fits(s, p, m.kb)) { accept(s, p, m, 0, false); continue; }
    patchBox(s, a.id, { dropped: a.dropped + 1 });
    bounce(s, m, e.why, a.id);
  }
}

// Snoozed mail returns to the top of the Inbox as unread.
function wake(s: GameState): void {
  const due = s.mail.snoozed.filter((x) => x.until <= s.hour);
  if (!due.length) return;
  const now = nowMinutes(s);
  s.mail = { ...s.mail, snoozed: s.mail.snoozed.filter((x) => x.until > s.hour) };
  for (const d of due) {
    const box = s.mail.msgs[d.account] ?? [], m = box.find((x) => x.id === d.id);
    if (!m) continue;
    const { snooze: _s, read: _r, ...back } = m;
    s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [d.account]: [...box.filter((x) => x.id !== d.id), { ...back, folder: "inbox", at: now }] } };
  }
}

// Hourly: the queue and snoozed mail. At 03:00: junk, purge of Trash and Junk after 30 days, retention, expired retired addresses.
export function mailDeliveryTick(s: GameState): void {
  flushQueue(s);
  wake(s);
  if (s.hour % 24 !== 3) return;
  const before = nowMinutes(s) - PURGE_MIN;
  for (const a of receiving(s)) junkDay(s, a);
  for (const a of s.mail.accounts) {
    const old = (s.mail.msgs[a.id] ?? []).filter((m) => (m.folder === "trash" || m.folder === "junk") && m.at < before);
    if (old.length) drop(s, a.id, new Set(old.map((m) => m.id)));
    retain(s, a.id);
  }
  if (s.mail.retired.some((r) => r.until <= s.hour)) s.mail = { ...s.mail, retired: s.mail.retired.filter((r) => r.until > s.hour) };
}

export const groupMembers = (s: GameState, groupId: string): MailAccount[] =>
  (s.mail.groups.find((g) => g.id === groupId)?.members ?? []).map((id) => boxById(s, id)).filter((a): a is MailAccount => !!a);

const base = (source: string): string => source.split(":")[0];
Object.assign(mailSend, {
  contactAddress(s: GameState, source: string): string {
    const id = s.mail.contacts[source], a = id ? boxById(s, id) : undefined;
    if (a) return `${a.local}@${a.domain}`;
    const owner = roleAccount(s, "owner");
    if (!owner) return roleAddress(s, "owner");
    if (CONTACTS.includes(base(source))) s.mail = { ...s.mail, contacts: { ...s.mail.contacts, [source]: owner.id } };
    return `${owner.local}@${owner.domain}`;
  },
  deliverMail(s: GameState, from: string, topic: string, params: MailParams, o: MailFrom): string | null {
    const source = o.source ?? "", to = o.to ?? mailSend.contactAddress(s, source);
    return deliver(s, { to, from: `n:${from}`, kind: SOURCE_KIND[base(source)] ?? "system", topic, p: params, ...(o.att?.length && { att: o.att }) }).id ?? null;
  },
});
