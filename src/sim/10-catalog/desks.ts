import { START_YEAR, yearOf } from "../00-core/time";
import type { TicketKind, TicketStatus } from "../40-support/tickets";
import type { GameState } from "../50-state";

// Values from docs/design/economy.md, section "Pear One subscriptions", and the feature years from
// docs/design/software-versions.md, Support desks. The desk replaces the inbox of the app whose id stays "Support".
export type DeskFeature = "filters" | "search" | "assign" | "templates" | "slaTimers" | "customerSidebar" | "reports" | "merge" | "departments" | "rules" | "portal" | "ai";
export type DeskAi = "suggestedArticles" | "answerBot" | "autoAnswer" | "drafting";
export type DeskId = "ostickit" | "zendusk" | "freshdusk" | "freescoot";

export interface Desk {
  id: DeskId; name: string; from: number; monthly: number;
  hosting: "hosted" | "self";
  // The vendor's site, and for a hosted desk the address every tenant gets on the day it signs up.
  hosts: { vendor: string; tenant?: string };
  // How the desk numbers tickets and the token it puts in the subject of every outgoing mail; <n> is the number.
  ref: { kind: "random" | "sequential"; digits?: number; token: string | null };
  // Self-hosted desks only: each release and its year.
  releases?: { version: string; year: number }[];
  // When each feature starts: a year for a hosted desk, the release that introduced it for a self-hosted one.
  features: Partial<Record<DeskFeature, number | string>>;
  aiFrom: Partial<Record<DeskAi, number>>;
}

export const DESKS: Desk[] = [
  {
    id: "ostickit", name: "OsTickit", from: START_YEAR, monthly: 0, hosting: "self",
    hosts: { vendor: "ostickit.com" }, ref: { kind: "random", digits: 6, token: "[#<n>]" },
    releases: [
      { version: "1.3", year: 2005 }, { version: "1.6", year: 2010 }, { version: "1.7", year: 2013 }, { version: "1.9", year: 2014 },
      { version: "1.10", year: 2016 }, { version: "1.12", year: 2019 }, { version: "1.14", year: 2019 }, { version: "1.15", year: 2020 },
      { version: "1.16", year: 2022 }, { version: "1.17", year: 2022 }, { version: "1.18", year: 2023 },
    ],
    features: { filters: "1.3", search: "1.3", assign: "1.3", templates: "1.3", departments: "1.3", portal: "1.3", slaTimers: "1.7", reports: "1.7", rules: "1.7", customerSidebar: "1.9", merge: "1.14" },
    aiFrom: {},
  },
  {
    id: "zendusk", name: "Zendusk", from: 2007, monthly: 49, hosting: "hosted",
    hosts: { vendor: "zendusk.com", tenant: "<tenant>.zendusk.com" }, ref: { kind: "sequential", token: "[Request #<n>]" },
    features: { filters: 2007, search: 2007, assign: 2007, templates: 2007, customerSidebar: 2007, departments: 2007, rules: 2007, portal: 2007, reports: 2007, merge: 2010, slaTimers: 2013, ai: 2013 },
    aiFrom: { suggestedArticles: 2013, answerBot: 2017, autoAnswer: 2023, drafting: 2023 },
  },
  {
    id: "freshdusk", name: "Freshdusk", from: 2011, monthly: 15, hosting: "hosted",
    hosts: { vendor: "freshdusk.com", tenant: "<tenant>.freshdusk.com" }, ref: { kind: "sequential", token: "[#<n>]" },
    features: { filters: 2011, search: 2011, assign: 2011, templates: 2011, slaTimers: 2011, customerSidebar: 2011, reports: 2011, merge: 2011, departments: 2011, rules: 2011, portal: 2011, ai: 2011 },
    aiFrom: { suggestedArticles: 2011, answerBot: 2018, autoAnswer: 2023, drafting: 2023 },
  },
  {
    // Saved replies, reports, workflows, the end-user portal and the knowledge base are paid modules of the real product.
    id: "freescoot", name: "FreeScoot", from: 2018, monthly: 0, hosting: "self",
    hosts: { vendor: "freescoot.net" }, ref: { kind: "sequential", token: null },
    releases: [{ version: "1.0", year: 2018 }, { version: "1.6", year: 2020 }, { version: "1.8", year: 2022 }],
    features: { filters: "1.0", search: "1.0", assign: "1.0", customerSidebar: "1.0", merge: "1.6" },
    aiFrom: {},
  },
];

export const deskById = (id: string): Desk | undefined => DESKS.find((d) => d.id === id);
// The desk installed, or none: the app then runs as a plain inbox.
export const deskOf = (s: Pick<GameState, "installed">): Desk | undefined => DESKS.find((d) => s.installed.includes(d.id));
export const deskReady = (s: Pick<GameState, "hour">, id: string): boolean => yearOf(s.hour) >= (deskById(id)?.from ?? 0);

// The year a feature starts on a desk, or null when the desk never has it.
export function featureYear(d: Desk, f: DeskFeature): number | null {
  const at = d.features[f];
  if (at === undefined) return null;
  return typeof at === "number" ? at : d.releases?.find((r) => r.version === at)?.year ?? null;
}
// ponytail: a self-hosted desk counts as the latest release of the year until installs keep a version.
export const deskHas = (s: Pick<GameState, "installed" | "hour">, f: DeskFeature): boolean => {
  const d = deskOf(s), y = d && featureYear(d, f);
  return y != null && yearOf(s.hour) >= y;
};
export const featuresAt = (d: Desk, year: number): DeskFeature[] => (Object.keys(d.features) as DeskFeature[]).filter((f) => year >= (featureYear(d, f) ?? Infinity));
export const deskAiReady = (d: Desk, a: DeskAi, year: number): boolean => year >= (d.aiFrom[a] ?? Infinity);

// The subject token of a ticket number, empty for a desk that threads by mail headers.
export const refToken = (d: Desk, ref: string): string => (d.ref.token && ref ? d.ref.token.replace("<n>", ref) : "");

// The mailbox role a ticket kind arrives in, the desk department it routes to, and whether the desk lists it at all.
// The roles are the ones mail-core routes by. Kinds outside the desk stay in their mailbox.
export type DeskRole = "owner" | "sales" | "support" | "abuse";
export type DeskDept = "support" | "billing" | "sales" | "abuse";
export const DESK_ROUTE: Record<TicketKind, { role: DeskRole; dept: DeskDept | null }> = {
  outage: { role: "support", dept: "support" }, howTo: { role: "support", dept: "support" },
  billing: { role: "support", dept: "billing" }, appeal: { role: "support", dept: "billing" }, refund: { role: "support", dept: "billing" }, cancellation: { role: "support", dept: "billing" },
  upgrade: { role: "support", dept: "sales" },
  migration: { role: "support", dept: "support" }, maintenance: { role: "support", dept: "support" },
  abuse: { role: "abuse", dept: "abuse" }, notice: { role: "abuse", dept: "abuse" }, legal: { role: "abuse", dept: "abuse" },
  order: { role: "sales", dept: null }, sponsor: { role: "sales", dept: null },
  pear: { role: "owner", dept: null }, mail: { role: "owner", dept: null }, extortion: { role: "owner", dept: null },
};

// The label each desk gives a simulation status (ids of i18n keys under desk.status). "new" is an open ticket nobody read yet.
export type DeskStatus = TicketStatus | "new" | "spam";
export const STATUS_LABELS: Record<DeskId, Record<DeskStatus, string>> = {
  ostickit: { new: "open", open: "open", waiting: "answered", escalated: "withTechnician", resolved: "resolved", closed: "closed", spam: "banned" },
  zendusk: { new: "new", open: "open", waiting: "pending", escalated: "onHold", resolved: "solved", closed: "closed", spam: "suspended" },
  freshdusk: { new: "open", open: "open", waiting: "pending", escalated: "waitingOnThirdParty", resolved: "resolved", closed: "closed", spam: "spam" },
  freescoot: { new: "active", open: "active", waiting: "pending", escalated: "pendingNote", resolved: "closed", closed: "closed", spam: "spam" },
};

// One seat for the owner and one for every employee on the support desk.
export const seats = (s: Pick<GameState, "staff">): number => 1 + s.staff.filter((e) => e.role === "support").length;
