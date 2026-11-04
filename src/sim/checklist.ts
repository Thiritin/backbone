import { isOfficeRouter, modelById } from "./10-catalog/hardware";
import { DEFAULT_HOME_LINE, MOMS_DSL } from "./20-world/datacenters";
import type { GameState } from "./50-state";
import { isDrive, jacked, linkStatus, locationOf } from "./60-infra/status";
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
const suppliersBilling = (s: GameState) => s.payables.some((p) => CONSEQUENCES[p.supplier].length > 0);

// Checklist goals the game detects from state. Goals without an entry are ticked by hand.
export const CHECKS: Record<string, (s: GameState) => boolean> = {
  bank: (s) => !!s.bank,
  register: (s) => !!s.registration,
  // Sent counts: the transfer reaches the supplier a day or two later.
  payBill: (s) => s.payables.some((p) => p.paidAt !== null || p.sent >= p.amount - 0.005),
  books: (s) => s.books.vendor !== null,
  // No supplier bill is open; a transfer on its way counts as paid.
  payBills: (s) => suppliersBilling(s) && !s.payables.some((p) => p.paidAt === null && p.sent < p.amount - 0.005),
  buyServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server"),
  mountServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server" && d.rackId && d.on),
  mountRouter: (s) => s.devices.some((d) => !!d.rackId && isOfficeRouter(modelById(d.model)) && jacked(s, d.id)),
  internet: (s) => lineActive(s),
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
  pearMail: (s) => s.pearMail.accounts.length > 0,
  hosttoast: (s) => s.hosttoast.tier !== null,
  flyers: (s) => s.marketing.flyers.length > 0,
};

export const tracked = (id: string): boolean => id in CHECKS;
export const checkDone = (s: GameState, id: string): boolean => CHECKS[id]?.(s) || s.checklist.includes(id);

// The Getting started tutorial: each step is a checklist goal, done in this order.
export const TUTORIAL = ["bank", "register", "payBill", "books", "buyServer", "mountServer", "mountRouter", "internet", "downloadIso", "writeStick", "plugStick", "bootUsb", "installOs", "setup", "findAddress", "shareWeb", "website", "domain", "email", "launch", "hosttoast", "flyers", "firstCustomer", "orderAccount", "orderDomain", "orderProvision", "orderAccess", "sendInvoice"] as const;

// A step that belongs to an app shows once that app is installed.
export const GUIDE = [...TUTORIAL, "payBills", "pearMail", "loan", "tenCustomers", "research", "patch", "hire", "study"] as const;
const AFTER: Partial<Record<(typeof GUIDE)[number], string>> = {
  website: "Marketing", launch: "Marketing", pearMail: "Pear Mail", research: "Research", patch: "Security", hire: "Staff", study: "Market",
};
export const guideSteps = (s: GameState) => GUIDE.filter((id) => (!AFTER[id] || s.installed.includes(AFTER[id]!)) && (id !== "payBills" || suppliersBilling(s)));
