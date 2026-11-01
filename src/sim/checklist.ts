import { isOfficeRouter, modelById } from "./10-catalog/hardware";
import { DEFAULT_HOME_LINE, MOMS_DSL } from "./20-world/datacenters";
import type { GameState } from "./50-state";
import { isDrive, jacked, linkStatus, locationOf } from "./60-infra/status";
import { lineActive } from "./60-infra/addresses";
import { clusterReachable, hasHosts } from "./60-infra/cluster";
import { siteBuilt } from "./80-business/website";

const onlineServers = (s: GameState) =>
  s.devices.filter((d) => modelById(d.model).kind === "server" && linkStatus(s, d.id).online);
const booked = (s: GameState, key: string) => s.ledger.some((e) => e.key === key);
const rented = (s: GameState) => s.locations.filter((l) => l.dc !== null);

// Checklist goals the game detects from state. Goals without an entry are ticked by hand.
export const CHECKS: Record<string, (s: GameState) => boolean> = {
  bank: (s) => !!s.bank,
  register: (s) => !!s.registration,
  books: (s) => s.books.vendor !== null,
  buyServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server"),
  mountServer: (s) => s.devices.some((d) => modelById(d.model).kind === "server" && d.rackId && d.on),
  mountRouter: (s) => s.devices.some((d) => !!d.rackId && isOfficeRouter(modelById(d.model)) && jacked(s, d.id)),
  internet: (s) => lineActive(s),
  domain: (s) => !!s.registrar && !!s.company.domain,
  website: siteBuilt,
  launch: (s) => s.marketing.launched && s.marketing.lines.length > 0,
  email: (s) => s.company.mail.kind !== "free",
  loan: (s) => booked(s, "ledger.loanTaken"),
  firstServer: (s) => onlineServers(s).length >= 1,
  setup: (s) => s.clusters.some((c) => c.platform || c.panel),
  // The web host has a Web server share on the basement router, or an address of its own.
  shareWeb: (s) => s.clusters.some((c) => (c.platform || c.panel) && hasHosts(c) && clusterReachable(s, c)),
  secondServer: (s) => onlineServers(s).length >= 2,
  homeLine: (s) => lineActive(s) && s.homeLine.id !== DEFAULT_HOME_LINE && s.homeLine.id !== MOMS_DSL.id,
  firstCustomer: (s) => s.customers.some((c) => c.habit !== "friend"),
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
};

export const tracked = (id: string): boolean => id in CHECKS;
export const checkDone = (s: GameState, id: string): boolean => CHECKS[id]?.(s) || s.checklist.includes(id);

// The Getting started tutorial: each step is a checklist goal, done in this order. company is ticked by any change in Settings under Company.
export const TUTORIAL = ["bank", "register", "company", "books", "buyServer", "mountServer", "mountRouter", "internet", "setup", "findAddress", "shareWeb", "website", "domain", "launch", "email", "firstCustomer"] as const;

// The steps after the tutorial belong to apps that arrive later (80-business/walk.ts); each shows once its app is installed.
export const GUIDE = [...TUTORIAL, "loan", "tenCustomers", "research", "patch", "hire", "study"] as const;
const AFTER: Partial<Record<(typeof GUIDE)[number], string>> = {
  website: "Marketing", launch: "Marketing", loan: "Finance", tenCustomers: "Customers", research: "Research", patch: "Security", hire: "Staff", study: "Market",
};
export const guideSteps = (s: GameState) => GUIDE.filter((id) => !AFTER[id] || s.installed.includes(AFTER[id]!));
