// docs/design/web-hosting.md, Customer behaviour on top of it: customers ask for panel tasks, ask for an upgrade at a package
// limit and report broken sites. Rates in economy/tickets-and-work-rates.md.
import { hashRng, rand } from "../00-core/rng";
import type { GameState } from "../50-state";
import { appState, webspaceOf, type Webspace } from "../60-infra/webspace";
import { createTicket, isFinal, type Ticket, type WebTask } from "./tickets";

// Per web space and month: wishes for a new database, a new mailbox and an FTP login for someone else.
export const WISH_RATES = { database: 0.02, mailbox: 0.02, ftp: 0.015 };
// Per hour a broken site stays broken, the chance a visitor tells the owner, who writes in.
export const BROKEN_VISIT_CHANCE = 0.25;
// Upgrade asks at a package limit; the sales thread keeps these topics.
export const LIMIT_TOPICS = ["dbLimit", "mailLimit"];
const DB_NAMES = ["shop", "blog", "forum", "wiki", "test"], MAILBOXES = ["shop", "office", "billing", "jobs", "news"], FTP_USERS = ["webdesign", "designer", "agency", "upload"];

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const pick = (list: string[], x: number): string => list[Math.floor(x * list.length)];

// Whether the web space now has what the ticket asked for; a database also needs a user with privileges on it.
export function taskDone(s: GameState, task: WebTask): boolean {
  const ws = webspaceOf(s, task.workloadId);
  if (!ws) return false;
  if (task.part === "app") return appState(ws) === "installed";
  if (task.part === "databases") return !!ws.databases[task.key] && Object.values(ws.dbUsers).some((u) => u.grants[task.key]?.length);
  return !!ws[task.part][task.key];
}

const openOn = (s: GameState, serviceId: string, test: (t: Ticket) => boolean) => s.tickets.some((t) => t.serviceId === serviceId && !isFinal(t) && test(t));
const ask = (s: GameState, customerId: string, serviceId: string, topic: string, task: WebTask): void => {
  const c = s.customers.find((x) => x.id === customerId)!;
  createTicket(s, c, "howTo", serviceId, topic).task = task;
};

// The overlay of a customer web space whose workload or service has ended is dropped.
function dropEnded(s: GameState): void {
  const gone = Object.keys(s.webspaces).filter((id) => {
    if (s.ownWebspaces.some((x) => x.id === id)) return false;
    const w = s.workloads.find((x) => x.id === id);
    return !w || (!!w.serviceId && !s.services.some((v) => v.id === w.serviceId && v.endedAt === null));
  });
  if (!gone.length) return;
  const next = { ...s.webspaces };
  for (const id of gone) delete next[id];
  s.webspaces = next;
}

// Derived contents always run, so only a web space the player changed can be broken.
function brokenSites(s: GameState): void {
  for (const id of Object.keys(s.webspaces)) {
    const w = s.workloads.find((x) => x.id === id), v = w && s.services.find((x) => x.id === w.serviceId);
    const c = v && s.customers.find((x) => x.id === v.customerId && x.churnedAt === null);
    if (!v || !c || openOn(s, v.id, (t) => t.task?.part === "app")) continue;
    const ws = webspaceOf(s, id);
    if (!ws?.app || appState(ws) !== "broken" || rand(hashRng(s.seed, s.hour, idNum(id), 331)) >= BROKEN_VISIT_CHANCE) continue;
    ask(s, c.id, v.id, ws.databases[ws.app.db] ? "appSetup" : "dbError", { workloadId: id, part: "app", key: ws.app.id });
  }
}

// One wish: a howTo ticket naming the task, or an upgrade ask when the package has no room left.
function wish(s: GameState, ws: Webspace, customerId: string, serviceId: string, kind: keyof typeof WISH_RATES, x: number): void {
  const c = s.customers.find((y) => y.id === customerId)!, at = { workloadId: ws.workloadId };
  if (kind === "database") {
    if (ws.usage.databases >= ws.limits.databases) { createTicket(s, c, "upgrade", serviceId, "dbLimit"); return; }
    const key = ws.prefix + pick(DB_NAMES, x);
    if (!ws.databases[key]) ask(s, customerId, serviceId, "dbCreate", { ...at, part: "databases", key });
  } else if (kind === "mailbox") {
    if (ws.usage.mailboxes >= ws.limits.mailboxes) { createTicket(s, c, "upgrade", serviceId, "mailLimit"); return; }
    const key = `${pick(MAILBOXES, x)}@${ws.domain}`;
    if (!ws.mailboxes[key]) ask(s, customerId, serviceId, "mailboxCreate", { ...at, part: "mailboxes", key });
  } else {
    const key = `${pick(FTP_USERS, x)}@${ws.domain}`;
    if (ws.usage.ftpAccounts < ws.limits.ftpAccounts && !ws.ftp[key]) ask(s, customerId, serviceId, "ftpLogin", { ...at, part: "ftp", key });
  }
}

// Daily, one roll per web hosting service; a service with an open task or upgrade ticket asks for nothing more.
function wishes(s: GameState): void {
  const kinds = Object.keys(WISH_RATES) as (keyof typeof WISH_RATES)[];
  for (const v of s.services) {
    if (v.product !== "webHosting" || v.endedAt !== null) continue;
    const r = hashRng(s.seed, s.hour, idNum(v.id), 332);
    let roll = rand(r) * 30;
    const kind = kinds.find((k) => (roll -= WISH_RATES[k]) < 0);
    if (!kind || !s.customers.some((c) => c.id === v.customerId && c.churnedAt === null) || openOn(s, v.id, (t) => !!t.task || t.kind === "upgrade")) continue;
    const w = s.workloads.find((x) => x.serviceId === v.id), ws = w && webspaceOf(s, w.id);
    if (ws) wish(s, ws, v.customerId, v.id, kind, rand(r));
  }
}

// Hourly inside the support tick, after the customers' own tickets.
export function webspaceTickets(s: GameState): void {
  dropEnded(s);
  brokenSites(s);
  if (s.hour % 24 === 0) wishes(s);
}
