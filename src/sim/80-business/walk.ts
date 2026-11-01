// docs/design/plans/billing-by-hand.md, lane walk: each app arrives when its problem does, with a Pear email and a News line.
import { isAvailable } from "../10-catalog/research";
import { STORE } from "../10-catalog/store";
import type { Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { appParams } from "./news";

// Research comes last, since the Staff and Market offers point to it.
export const WALK = ["Customers", "Marketing", "Security", "Staff", "Market", "Research"] as const;
// Paid Pear Store apps: the email offers them and the player buys them in the Shop.
export const OFFERS: string[] = ["Staff", "Market"];
export const WALK_HOUR = 9;
export const RESEARCH_DAYS = 7;
export const TICKETS_FOR_STAFF = 10;

// What the last 30 days cost, without hardware bought once.
const runningCosts = (s: GameState) =>
  s.ledger.filter((e) => e.amount < 0 && e.category !== "hardware" && e.hour > s.hour - 730).reduce((sum, e) => sum - e.amount, 0);
export const lockedInStore = (s: GameState): boolean => STORE.some((i) => !isAvailable(i.id, s.unlocks));

const TRIGGERS: Record<(typeof WALK)[number], (s: GameState) => boolean> = {
  Customers: (s) => s.customers.length >= 5,
  Marketing: (s) => s.clusters.some((c) => c.platform || c.panel),
  Security: (s) => s.tickets.some((t) => t.kind === "abuse") || s.security.vuln !== null || s.security.seen.length > 0,
  Staff: (s) => s.tickets.filter((t) => t.status === "open" && t.customerId).length > TICKETS_FOR_STAFF,
  Market: (s) => s.sales.lost.length > 0,
  Research: (s) => lockedInStore(s) && (s.hour - s.registration!.hour >= RESEARCH_DAYS * 24 || OFFERS.some((id) => s.arrived.includes(id))),
};

// The Pear mail about the bank's overdraft, sent once when cash runs low.
export const OVERDRAFT = "overdraft";

const pearMail = (s: GameState, topic: string): void => {
  const mail: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "pear", topic, status: "open",
    createdAt: s.hour, dueAt: s.hour + 7 * 24, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, mail];
};

// Installs a free app or offers a paid one, once; an app already in the dock stays as it is.
export function arrive(s: GameState, app: string): SimEvent[] {
  if (s.arrived.includes(app) || s.installed.includes(app)) return [];
  s.arrived = [...s.arrived, app];
  if (!OFFERS.includes(app)) s.installed = [...s.installed, app];
  pearMail(s, app);
  s.news = [...s.news, `app.${app}@${s.hour}`];
  return [{ app: "News", key: "event.news.app", params: appParams(app) }];
}

export function walkTick(s: GameState): SimEvent[] {
  if (!s.registration || s.hour % 24 !== WALK_HOUR) return [];
  if (!s.arrived.includes(OVERDRAFT) && s.cash < 2 * runningCosts(s)) {
    s.arrived = [...s.arrived, OVERDRAFT];
    pearMail(s, OVERDRAFT);
  }
  return WALK.filter((app) => !s.arrived.includes(app) && !s.installed.includes(app) && TRIGGERS[app](s)).flatMap((app) => arrive(s, app));
}
