import { isOfficeRouter, modelById } from "./10-catalog/hardware";
import { DEFAULT_HOME_LINE, MOMS_DSL } from "./20-world/datacenters";
import type { GameState } from "./50-state";
import { cabledOut, isDrive, jacked, linkStatus, locationOf } from "./60-infra/status";
import { lineActive } from "./60-infra/addresses";
import { clusterReachable, hasHosts } from "./60-infra/cluster";
import { CONSEQUENCES } from "./46-finance/payables";
import { stepsDone, type OrderStep } from "./30-market/manual";
import { siteBuilt } from "./80-business/website";

const onlineServers = (s: GameState) =>
  s.devices.filter((d) => modelById(d.model).kind === "server" && linkStatus(s, d.id).online);
const booked = (s: GameState, key: string) => s.ledger.some((e) => e.key === key);
// Each first-install step also counts when a later one is done, so a step never unticks.
const installed = (s: GameState) => s.devices.some((d) => modelById(d.model).kind === "server" && !!d.os);
const booted = (s: GameState) => installed(s) || s.devices.some((d) => d.bootFrom === "usb");
const plugged = (s: GameState) => booted(s) || s.media.stick.in !== null;
const written = (s: GameState) => plugged(s) || s.media.stick.os !== null;
// A customer order not lost reached this step; a lost order does not count and shop orders run by themselves.
const orderStep = (step: OrderStep) => (s: GameState) => s.sales.requests.some((r) => r.kind === "order" && !r.shop && r.status !== "lost" && r.status !== "declined" && stepsDone(s, r)[step]);
const rented = (s: GameState) => s.locations.filter((l) => l.dc !== null);

// Pay bills shows once a supplier that cuts services sends its first invoice.
const suppliersBilling = (s: GameState) => s.payables.some((p) => (p.doc ?? "invoice") === "invoice" && CONSEQUENCES[p.supplier].length > 0);

// Checklist goals the game detects from state. Goals without an entry are ticked by hand.
export const CHECKS: Record<string, (s: GameState) => boolean> = {
  bank: (s) => !!s.bank,
  register: (s) => !!s.registration,
  // Sent counts: the transfer reaches the supplier a day or two later. A receipt, credit or order confirmation settles at
  // once and is no bill the player paid.
  payBill: (s) => s.payables.some((p) => (p.doc ?? "invoice") === "invoice" && (p.paidAt !== null || p.sent >= p.amount - 0.005)),
  books: (s) => s.books.vendor !== null,
  // No supplier bill is open; a transfer on its way counts as paid.
  payBills: (s) => suppliersBilling(s) && !s.payables.some((p) => p.paidAt === null && p.sent < p.amount - 0.005),
  buyServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server"),
  mountServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server" && d.rackId && d.on),
  mountRouter: (s) => s.devices.some((d) => !!d.rackId && isOfficeRouter(modelById(d.model)) && jacked(s, d.id)),
  serverLinked: (s) => s.devices.some((d) => modelById(d.model).kind === "server" && !!d.rackId && cabledOut(s, d.id) === null),
  domain: (s) => !!s.registrar && !!s.company.domain,
  website: siteBuilt,
  launch: (s) => s.marketing.launched && s.marketing.lines.length > 0,
  email: (s) => !!s.company.domain && s.mail.accounts.some((a) => a.domain === s.company.domain && a.closedAt === null),
  loan: (s) => booked(s, "ledger.loanTaken"),
  firstServer: (s) => onlineServers(s).length >= 1,
  downloadIso: (s) => written(s) || s.media.images.length > 0,
  writeStick: written,
  plugStick: plugged,
  bootUsb: booted,
  installOs: installed,
  setup: (s) => s.clusters.some((c) => c.platform || c.panel),
  // The web host has a Web server share on the basement router, or an address of its own.
  shareWeb: (s) => s.clusters.some((c) => (c.platform || c.panel) && hasHosts(c) && clusterReachable(s, c)),
  secondServer: (s) => onlineServers(s).length >= 2,
  homeLine: (s) => lineActive(s) && s.homeLine.id !== DEFAULT_HOME_LINE && s.homeLine.id !== MOMS_DSL.id,
  firstCustomer: (s) => s.customers.some((c) => c.habit !== "friend"),
  orderAccount: orderStep("account"),
  orderDomain: orderStep("domain"),
  orderProvision: orderStep("provision"),
  orderAccess: orderStep("access"),
  // The order's first invoice or a monthly one has left the draft state.
  sendInvoice: (s) => s.invoices.some((i) => i.status !== "draft"),
  ticket: (s) => s.tickets.some((t) => t.replies.length > 0),
  payment: (s) => s.invoices.some((i) => i.status === "paid"),
  reminder: (s) => s.invoices.some((i) => i.reminders.length > 0),
  datacenter: (s) => rented(s).length > 0,
  dcServer: (s) => onlineServers(s).some((d) => locationOf(s, d)?.dc != null),
  dcCluster: (s) => s.clusters.some((c) => (c.platform || c.panel) && c.nodes.length > 0 && rented(s).some((l) => l.az === c.az)),
  feedB: (s) => s.racks.some((r) => r.feedB),
  drive: (s) => s.devices.some((d) => d.components.some((c) => isDrive(c) && c.installedAt > d.boughtAt)),
  lease: (s) => s.leases.length > 0 || s.ledger.some((e) => e.category === "leasing"),
  tenCustomers: (s) => s.customers.length >= 10,
  autoRemind: (s) => s.billingRules.autoRemind,
  secondCity: (s) => new Set(rented(s).map((l) => l.city)).size >= 2,
  cage: (s) => s.locations.some((l) => l.space === "cage" || l.space === "suite"),
  research: (s) => s.unlocks.length > 0,
  patch: (s) => s.security.patched.length > 0,
  hire: (s) => s.staff.some((e) => !e.bot),
  study: (s) => s.marketing.studies.length > 0,
  suite: (s) => s.locations.some((l) => l.space === "suite"),
  mail: (s) => s.pearMail.accounts.length > 0,
  hosttoast: (s) => s.hosttoast.tier !== null,
  flyers: (s) => s.marketing.flyers.length > 0,
};

export const tracked = (id: string): boolean => id in CHECKS;
export const checkDone = (s: GameState, id: string): boolean => CHECKS[id]?.(s) || s.checklist.includes(id);

// Chapter one: ten cards, each a list of the goals above. A card is done when all its goals are.
export const CHAPTER1 = [
  { id: "bank", goals: ["bank"] },
  { id: "register", goals: ["register"] },
  { id: "domain", goals: ["domain"] },
  { id: "website", goals: ["website"] },
  { id: "payBill", goals: ["payBill"] },
  { id: "buyServer", goals: ["buyServer"] },
  { id: "mountServer", goals: ["mountServer", "mountRouter", "serverLinked"] },
  { id: "installOs", goals: ["downloadIso", "writeStick", "plugStick", "bootUsb", "installOs"] },
  { id: "hosting", goals: ["setup", "shareWeb", "launch"] },
  { id: "firstOrder", goals: ["firstCustomer", "orderAccount", "orderDomain", "orderProvision", "orderAccess", "books", "sendInvoice"] },
] as const;
export type Chapter1Id = (typeof CHAPTER1)[number]["id"];

// Goals of the later chapter; each is its own card once chapter one is done.
export const LATER = ["mail", "email", "hosttoast", "flyers", "payBills", "loan", "tenCustomers", "research", "patch", "hire", "study"] as const;

export type Goal = (typeof CHAPTER1)[number]["goals"][number] | (typeof LATER)[number];
// The Getting started tutorial: the goals of the chapter-one cards in order.
export const TUTORIAL: readonly Goal[] = CHAPTER1.flatMap((c) => c.goals);

// A step that belongs to an app shows once that app is installed.
export const GUIDE: readonly Goal[] = [...TUTORIAL, ...LATER];
const AFTER: Partial<Record<Goal, string>> = {
  research: "Research", patch: "Security", hire: "Staff", study: "Market",
};
export const guideSteps = (s: GameState): Goal[] => GUIDE.filter((id) => (!AFTER[id] || s.installed.includes(AFTER[id]!)) && (id !== "payBills" || suppliersBilling(s)));

export interface Card { id: string; goals: readonly Goal[]; chapter: 1 | 2 }

// Time-bound cards wait on the clock, not on the player: the bill's letter in the post, the site build, the first order.
export function waiting(s: GameState, id: string): boolean {
  switch (id) {
    case "payBill": return !!s.registration && !s.payables.some((p) => (p.doc ?? "invoice") === "invoice");
    case "website": return s.marketing.siteReady !== null && !siteBuilt(s);
    // The last goal of the card needs the finished site.
    case "hosting": return checkDone(s, "setup") && checkDone(s, "shareWeb") && !checkDone(s, "launch") && s.marketing.siteReady !== null && !siteBuilt(s);
    case "firstOrder": return s.webOpenedAt !== null && !checkDone(s, "firstCustomer") && !s.sales.requests.some((r) => r.kind === "order");
    default: return false;
  }
}

export interface Board { cards: Card[]; done: boolean[]; wait: boolean[]; current?: Card }

// The cards on show: chapter one until all ten are done, then one card per remaining later goal.
export function cardBoard(s: GameState): Board {
  const first: Card[] = CHAPTER1.map((c) => ({ ...c, chapter: 1 }));
  const shown = new Set(guideSteps(s));
  const over = first.every((c) => c.goals.every((g) => checkDone(s, g)));
  const cards = over ? LATER.filter((g) => shown.has(g)).map((g): Card => ({ id: g, goals: [g], chapter: 2 })) : first;
  const done = cards.map((c) => c.goals.every((g) => checkDone(s, g)));
  const wait = cards.map((c, i) => !done[i] && waiting(s, c.id));
  // The first order needs web hosting online, so it is not offered while that card is unfinished.
  const hosting = cards.findIndex((c) => c.id === "hosting");
  const blocked = (c: Card) => c.id === "firstOrder" && !done[hosting];
  return { cards, done, wait, current: cards.find((c, i) => !done[i] && !wait[i] && !blocked(c)) };
}

// The first goal of a card that is not ticked yet; the card's button opens that goal's screen.
export const nextGoal = (s: GameState, c: Card): Goal => c.goals.find((g) => !checkDone(s, g)) ?? c.goals[0];
