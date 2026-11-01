// economy.md, Security advisories, Customer applications: the apps web hosting customers run, how they get hacked, updated and cleaned.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import {
  APP_NAME, ASK_SHARE, CLEAN_MINUTES, CMS, HACKS_TO_LEAVE, NOTIFY_BATCH, NOTIFY_MINUTES, SELF_CLEAN, SELF_CLEAN_DAYS, SELF_UPDATE_DAYS, selfUpdateShare,
  updatePrice, WISH, type App, type Wish,
} from "../10-catalog/apps";
import { reprice } from "../30-customers/pricing";
import type { Customer, Service } from "../30-customers/customers";
import { cancelCustomer, bump, createTicket, isFinal, profileStats, type Ticket, type TicketAction } from "../40-support/tickets";
import { serviceOnline } from "../40-support/status";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "../90-actions/hardware";
import { vmOf } from "./cluster";
import { REBUILT } from "./security";
import { HOURS_PER_YEAR } from "./status";
import { affects, exposureDays, instanceRisk, rank, vulnsFor, type OpenVuln, type Vulnerability } from "./vulns";

// defaced holds the services whose site is defaced until cleaned up, hacks the hours each was defaced in the last year, and
// notified the "service|vulnerability" pairs the player wrote to.
export interface Sites { defaced: string[]; hacks: Record<string, number[]>; notified: string[] }
export const newSites = (): Sites => ({ defaced: [], hacks: {}, notified: [] });

export const APP_ACTIONS: TicketAction[] = ["offerOnce", "offerManaged", "free", "clean", "noBackup"];

// Only a backup of the site, or of the panel VM it lives in, lets the player restore it after a defacement.
export function hasBackup(s: GameState, serviceId: string | null): boolean {
  const w = s.workloads.find((x) => x.serviceId === serviceId);
  return !!w && (w.backupAt !== null || (vmOf(s, w)?.backupAt ?? null) !== null);
}

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const vulnNo = (v: Vulnerability): number => Number(v.id.split("-").pop());
const keyOf = (service: Service, v: Vulnerability, salt: number) => hashRng(idNum(service.id), CMS.indexOf(v.family as App), v.year, vulnNo(v), salt);

// The CMS a running web hosting service uses, or null for a static site and every other service.
export const cmsOf = (v: Service): App | null => (v.product === "webHosting" && v.endedAt === null && v.spec.app && v.spec.app !== "static" ? v.spec.app : null);

const release = (v: Service) => ({ version: v.spec.appVersion ?? 0, updatedAt: v.spec.appUpdatedAt ?? 0 });
const skillOf = (s: GameState, v: Service) => {
  const c = s.customers.find((x) => x.id === v.customerId);
  return c ? profileStats(c.profile).skill : "low";
};

// The patched vulnerabilities a service's app is open to at an hour, worst first.
export function appVulns(s: GameState, v: Service, hour: number = s.hour): OpenVuln[] {
  const app = cmsOf(v);
  if (!app) return [];
  const open: OpenVuln[] = [];
  for (let y = release(v).version; y <= yearOf(hour); y++) {
    for (const x of vulnsFor(app, y, s.seed)) if (x.patchedAt <= hour && affects(release(v), x)) open.push({ ...x, days: exposureDays(release(v), x, hour) });
  }
  return open.sort((a, b) => rank(b.severity) - rank(a.severity) || b.days - a.days);
}

// The hour the customer updates by themselves after the patch, or null when they never would (economy.md, Customer applications).
export function selfUpdateAt(s: GameState, v: Service, vuln: Vulnerability): number | null {
  const r = keyOf(v, vuln, 95);
  if (rand(r) >= selfUpdateShare(vuln.family as App, skillOf(s, v), vuln.year)) return null;
  return vuln.patchedAt + Math.floor(rand(r) * SELF_UPDATE_DAYS) * 24;
}

// Whether a notified customer who would not update by themselves asks for help.
export const asksForHelp = (v: Service, vuln: Vulnerability): boolean => rand(keyOf(v, vuln, 96)) < ASK_SHARE;

// What a customer asking for help would pay for, by their budget; fixed per ticket.
export function wishOf(s: GameState, c: Customer, t: Ticket): Wish {
  const { once, managed } = WISH[profileStats(c.profile).budget], r = rand(hashRng(s.seed, idNum(t.id), 97));
  return r < once ? "once" : r < once + managed ? "managed" : "refuse";
}

function updateApps(s: GameState, ids: Set<string>): void {
  if (ids.size) s.services = s.services.map((v) => (ids.has(v.id) ? { ...v, spec: { ...v.spec, appVersion: yearOf(s.hour), appUpdatedAt: s.hour } } : v));
}

// Brings one site to this year's release, which closes every open vulnerability, and ends the update ticket the customer opened.
export function updateSite(s: GameState, serviceId: string): void {
  updateApps(s, new Set([serviceId]));
  settle(s, serviceId, "update", "resolve");
}

// Ends the open ticket of the topic on a service; the player's own ticket is resolved, a customer who sorted it out withdraws theirs.
function settle(s: GameState, serviceId: string, topic: string, how: "withdraw" | "resolve"): void {
  const done: Partial<Ticket> = how === "resolve" ? { status: "resolved", outcome: "cleaned" } : { status: "closed", outcome: "withdrawn" };
  s.tickets = s.tickets.map((t) => (t.serviceId === serviceId && t.kind === "howTo" && t.topic === topic && !isFinal(t) && !t.work ? { ...t, ...done, updatedAt: s.hour, unread: false } : t));
}

function clearDefacement(s: GameState, serviceId: string): void {
  s.sites = { ...s.sites, defaced: s.sites.defaced.filter((id) => id !== serviceId) };
}

// The player restores a defaced site from its backup: 30 minutes of their time, and the customer's ticket is resolved.
export function cleanSite(s: GameState, serviceId: string): ActionResult {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || !s.sites.defaced.includes(serviceId)) return { ok: false, error: "error.notDefaced" };
  if (!hasBackup(s, serviceId)) return { ok: false, error: "error.noBackup" };
  s.playerBusyUntil = Math.max(s.playerBusyUntil, s.hour * 60) + CLEAN_MINUTES;
  clearDefacement(s, serviceId);
  s.customers = s.customers.map((c) => (c.id === v.customerId ? { ...c } : c));
  const c = s.customers.find((x) => x.id === v.customerId);
  if (c && s.tickets.some((t) => t.serviceId === serviceId && t.topic === "hacked" && !isFinal(t))) bump(c, 5);
  settle(s, serviceId, "hacked", "resolve");
  return { ok: true, id: serviceId };
}

function deface(s: GameState, v: Service, events: SimEvent[]): void {
  const hacks = [...(s.sites.hacks[v.id] ?? []), s.hour].filter((h) => s.hour - h < HOURS_PER_YEAR);
  s.sites = { ...s.sites, hacks: { ...s.sites.hacks, [v.id]: hacks }, defaced: [...s.sites.defaced, v.id] };
  s.customers = s.customers.map((c) => (c.id === v.customerId ? { ...c } : c));
  const c = s.customers.find((x) => x.id === v.customerId)!, params = { customer: c.name, site: v.label, software: APP_NAME[v.spec.app!] };
  if (hacks.length >= HACKS_TO_LEAVE) {
    s.tickets = s.tickets.map((t) => ({ ...t }));
    cancelCustomer(s, c);
    clearDefacement(s, v.id);
    events.push({ app: "Security", key: "event.siteLeft", params });
    return;
  }
  createTicket(s, c, "howTo", v.id, "hacked");
  events.push({ app: "Security", key: "event.siteHacked", params });
}

// Daily: customers and managed updates close vulnerabilities, defaced sites get cleaned by customers who can, and open
// vulnerabilities risk a defacement at the same chances as the company's own software.
export function appsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.hour % 24 !== 0) return events;
  const updating = new Set<string>();
  for (const v of s.services) {
    const open = appVulns(s, v);
    if (open.length && (v.spec.managedUpdates || open.some((x) => (selfUpdateAt(s, v, x) ?? Infinity) <= s.hour))) updating.add(v.id);
  }
  updateApps(s, updating);
  for (const id of updating) settle(s, id, "update", "withdraw");
  for (const id of s.sites.defaced) {
    const v = s.services.find((x) => x.id === id), last = s.sites.hacks[id]?.at(-1);
    if (!v || last === undefined || skillOf(s, v) === "low") continue;
    const r = hashRng(s.seed, idNum(id), last, 93);
    if (rand(r) < SELF_CLEAN && s.hour >= last + (1 + Math.floor(rand(r) * SELF_CLEAN_DAYS)) * 24) {
      clearDefacement(s, id);
      settle(s, id, "hacked", "withdraw");
    }
  }
  s.sites = { ...s.sites, defaced: s.sites.defaced.filter((id) => s.services.some((x) => x.id === id && x.endedAt === null)) };
  for (const v of s.services.filter(cmsOf)) {
    const risk = instanceRisk(appVulns(s, v));
    if (risk > 0 && !s.sites.defaced.includes(v.id) && serviceOnline(s, v.id) && rand(hashRng(s.seed, idNum(v.id), s.hour / 24, 92)) < risk) deface(s, v, events);
  }
  return events;
}

const vulnById = (s: GameState, family: App, id: string): Vulnerability | undefined =>
  vulnsFor(family, Number(id.split("-")[1]), s.seed).find((x) => x.id === id);

// The running sites of a CMS open to a patched vulnerability.
export const openSites = (s: GameState, vuln: Vulnerability): Service[] =>
  vuln.patchedAt > s.hour ? [] : s.services.filter((v) => cmsOf(v) === vuln.family && affects(release(v), vuln));

export const notifiedPair = (v: Service, vuln: Vulnerability): string => `${v.id}|${vuln.id}`;
const unnotified = (s: GameState, vuln: Vulnerability): Service[] => openSites(s, vuln).filter((v) => !s.sites.notified.includes(notifiedPair(v, vuln)));

// Hand task: writes to every customer running the CMS who is open to the vulnerability, 30 minutes per 10 customers. Of those
// who would not update by themselves, half ask for help in a ticket.
export function notifyCustomers(s: GameState, family: App, vulnId: string): ActionResult {
  const vuln = (CMS as string[]).includes(family) ? vulnById(s, family, vulnId) : undefined;
  if (!vuln || vuln.patchedAt > s.hour) return { ok: false, error: "error.unknownVulnerability" };
  const sites = unnotified(s, vuln);
  if (!sites.length) return { ok: false, error: "error.nobodyToNotify" };
  s.playerBusyUntil = Math.max(s.playerBusyUntil, s.hour * 60) + Math.ceil(sites.length / NOTIFY_BATCH) * NOTIFY_MINUTES;
  s.sites = { ...s.sites, notified: [...s.sites.notified, ...sites.map((v) => notifiedPair(v, vuln))] };
  for (const v of sites) {
    const c = s.customers.find((x) => x.id === v.customerId);
    if (c && c.churnedAt === null && selfUpdateAt(s, v, vuln) === null && asksForHelp(v, vuln) && !s.tickets.some((t) => t.serviceId === v.id && t.topic === "update" && !isFinal(t))) createTicket(s, c, "howTo", v.id, "update");
  }
  return { ok: true, id: vuln.id };
}

// One row of the customer side of Monitoring: a CMS and a vulnerability its sites are open to, or the CMS alone when all are up to date.
export interface AppRow { app: App; vuln: Vulnerability | null; sites: number; days: number; unnotified: number }

export function appMonitoring(s: GameState): AppRow[] {
  const rows: AppRow[] = [];
  for (const app of CMS) {
    const sites = s.services.filter((v) => cmsOf(v) === app);
    if (!sites.length) continue;
    const seen = new Map<string, Vulnerability>();
    for (const v of sites) for (const x of appVulns(s, v)) seen.set(x.id, x);
    if (!seen.size) rows.push({ app, vuln: null, sites: sites.length, days: 0, unnotified: 0 });
    for (const x of seen.values()) {
      const open = openSites(s, x);
      rows.push({ app, vuln: x, sites: open.length, days: Math.max(...open.map((v) => exposureDays(release(v), x, s.hour))), unnotified: unnotified(s, x).length });
    }
  }
  return rows.sort((a, b) => (b.vuln ? rank(b.vuln.severity) : -1) - (a.vuln ? rank(a.vuln.severity) : -1) || b.days - a.days);
}

// Applies a ticket action of the app topics once the player's time has passed; the outcome, or null when the customer declines the offer.
export function applyAppWork(s: GameState, t: Ticket, c: Customer, action: string): Ticket["outcome"] | null {
  const v = s.services.find((x) => x.id === t.serviceId);
  if (!v || v.endedAt !== null) return "updated";
  if (action === "clean" && hasBackup(s, v.id)) {
    clearDefacement(s, v.id);
    return "cleaned";
  }
  // Without a backup the customer has to rebuild the site themselves.
  if (action === "clean" || action === "noBackup") {
    clearDefacement(s, v.id);
    bump(c, REBUILT);
    return "noBackup";
  }
  if (action === "free") {
    updateApps(s, new Set([v.id]));
    return "updated";
  }
  const wish = wishOf(s, c, t);
  if (action === "offerOnce" ? wish !== "once" : wish !== "managed") return null;
  updateApps(s, new Set([v.id]));
  if (action === "offerOnce") {
    const amount = updatePrice(s.rates.webHosting, "updateOnce");
    s.cash = Math.round((s.cash + amount) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.appUpdate", params: { customer: c.name, site: v.label }, amount }];
    return "updateSold";
  }
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec: { ...x.spec, managedUpdates: true } } : x));
  const sold = s.services.find((x) => x.id === v.id)!;
  reprice(s, sold, sold.price * 730 + updatePrice(s.rates.webHosting, "updates"), true);
  return "managedSold";
}
