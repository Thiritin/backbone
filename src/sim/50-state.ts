import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";
import { componentParts, modelById, type ComponentKind, type FormFactor, type PartSpec } from "./10-catalog/hardware";
import { STARTER_APPS } from "./10-catalog/store";
import { seedDcs } from "./20-world/datacenters";
import { t } from "../i18n/en";
import type { Customer, Product, Service } from "./30-customers/customers";
import type { BillingRules, Invoice, Loan } from "./45-billing/billing";
import type { Ticket } from "./40-support/tickets";
import type { Policy } from "./46-finance/finance";
import { applications, type Candidate, type Employee } from "./47-staff/staff";
import type { OnCall } from "./47-staff/oncall";
import type { TechOp, TechRules } from "./47-staff/technicians";
import type { ActivityEntry } from "./47-staff/activity";
import { newMarketing, type Marketing } from "./80-business/marketing";
import type { Cluster, Workload } from "./60-infra/cluster";
import { newNetwork, type Network } from "./60-infra/network";
import { newOps, type Ops } from "./60-infra/ops";
import { newSites, type Sites } from "./60-infra/apps";
import type { Breach } from "./60-infra/breach";
import { newSecurity, type Security } from "./60-infra/security";
import { newSales, type Sales } from "./30-market/market";
import type { FairBooking } from "./80-business/fairs";
import type { LossReport } from "./85-products/products";
import type { Rates } from "./10-catalog/products";
import type { Domain } from "./30-customers/registry";
import { newChadUsage, type ChadUsage } from "./47-staff/chad";
import { newIps, type Ips } from "./60-infra/addresses";
import type { CompanyMail } from "./80-business/mail";
import type { Registrar } from "./30-customers/registrar";
import { firstHostNo } from "./30-customers/hostnames";

// 3: GPU line servers carry their preset cards.
export const SAVE_VERSION = 3;

export type BondMode = "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber";

export type SpaceKind = "basement" | "share" | "positions" | "cage" | "suite";
// Each location is an availability zone (az, like fra2) in the region of its city.
export interface Location { id: string; dc: string | null; city: string; az: string; name: string; space: SpaceKind; positions: number; readyAt: number; extraCircuit: boolean;
  // Places on the shelf for towers; only the basement has one.
  shelf: number }
// share-N racks belong to the provider of a rack share and hold N units.
export type RackModel = "rack-24" | "rack-42" | "rack-47" | "share-5" | "share-10" | "share-21" | "share-42";
// arriveAt is the hour a moving rack arrives; null when it is in place. A moving rack already holds its target location and position.
export interface Rack { id: string; model: RackModel; locationId: string; position: number; name: string; arriveAt: number | null; price: number; boughtAt: number; provided: boolean; feedB: boolean; highDensity: boolean }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
// A gateway sits on its location's carrier panel: rackId null, panel = location id. A stored unit has store = its zone's location id;
// a shipped unit has store null and transitTo/arriveAt set until it arrives.
export interface Device { id: string; model: string; brand: string; rackId: string | null; slot: number; panel: string | null; name: string; bond: BondMode; groups: number[][]; price: number; boughtAt: number; lease: string | null; store: string | null; transitTo: string | null; arriveAt: number | null;
  components: Component[]; on: boolean; label: string | null; raid: RaidLevel; rebuildRate: RebuildRate;
  rebuild: { componentId: string; doneAt: number } | null; maintenance: { componentId: string; partId: string; doneAt: number; spec?: PartSpec } | null;
  // The hour the device's data was lost, if it ever was.
  dataLost: number | null;
  // The hour a device switched on finishes booting.
  bootUntil?: number;
  // The operating system froze (hung) or the management controller did (bmcHung); log is the device's last 20 events.
  hung: boolean; bmcHung: boolean; log: { hour: number; key: string }[];
  // A hand task waiting for someone on site: pulling the plug or resetting the management controller.
  hands?: { kind: "pull" | "bmcreset"; doneAt: number } | null;
  // What a spare part in storage is (size and form factor); spares without it fit any slot of their kind.
  part?: PartSpec;
  // nodeNNN, set on servers.
  hostname?: string;
}
// paid counts the monthly payments made so far; the lease ends after months payments.
export interface Lease { id: string; lessor: string; monthly: number; months: number; startedAt: number; paid: number; devices: string[] }
// A waitlist entry gets heldUntil once its space is free; the space is then reserved until that hour.
export interface WaitlistEntry { id: string; dc: string; space: "share" | "positions" | "cage" | "suite"; size: number; since: number; heldUntil: number | null }
export interface End { device: string; port: number }
export interface Cable { id: string; a: End; b: End; kind: CableKind; color: string | null }
// failedAt is the hour the component broke; null while it works. A power supply is plugged in unless plugged is false.
// size is GB for RAM sticks and drives, cores for CPUs; ff is the form factor of a drive.
export interface Component { id: string; kind: ComponentKind; installedAt: number; failedAt: number | null; plugged?: boolean; size?: number; ff?: FormFactor }
export type RaidLevel = "none" | "1" | "5" | "6" | "10";
export type RebuildRate = "low" | "medium" | "high";
// A desktop document; x and y are its icon position on the desktop in pixels.
export interface Doc { id: string; kind: "guide" | "note"; title: string; body: string; x: number; y: number }
// domain is the company's own domain once registered; mail is its email service.
export interface Company { name: string; logo: string; color: string; domain: string | null; mail: CompanyMail; tagline: string }
export interface LedgerEntry { hour: number; category: string; key: string; params: Record<string, string | number>; amount: number }

export interface GameState {
  version: number;
  seed: number;
  rng: Rng;
  hour: number;
  cash: number;
  nextId: number;
  locations: Location[];
  racks: Rack[];
  devices: Device[];
  cables: Cable[];
  ledger: LedgerEntry[];
  leases: Lease[];
  // Power drawn since the last monthly bill, in euros.
  powerDue: number;
  customers: Customer[];
  services: Service[];
  // Billing and bank.
  invoices: Invoice[];
  // Hour up to which each yearly service is invoiced.
  yearlyBilledUntil: Record<string, number>;
  loans: Loan[];
  // A missed repayment blocks new loans until this hour.
  loansBlockedUntil: number;
  billingRules: BillingRules;
  // Customers whose services the player holds offline.
  heldCustomers: string[];
  // Support: tickets, the minute the player's queued replies finish, and the hour each offline service went down.
  tickets: Ticket[];
  playerBusyUntil: number;
  downSince: Record<string, number>;
  // Cluster nodes frozen because their RAM in use exceeds the installed RAM.
  frozen: string[];
  // The basement's internet line (HOME_LINES id, "" before the first one), a switch to another line that goes live at hour at, and whether this line ran full.
  homeLine: { id: string; next: { id: string; at: number } | null; full?: boolean };
  docs: Doc[];
  // Positions rented by competitors in each datacenter.
  dcs: Record<string, { others: number }>;
  waitlist: WaitlistEntry[];
  // Learned research skills (SKILLS ids).
  unlocks: string[];
  // The skill in training and the hour it is learned.
  training: { id: string; doneAt: number } | null;
  // Know-how points to spend on research.
  knowHow: number;
  // Apps in the dock and bought Pear Store upgrades; every Pear Store item here is billed monthly.
  installed: string[];
  // Checklist goals the player ticked by hand.
  checklist: string[];
  company: Company;
  // Finance: loss carried to the next tax year, insurance policies, the hour cash went below zero and the hour of bankruptcy.
  taxLoss: number;
  insurance: Policy[];
  brokeSince: number | null;
  gameOver: number | null;
  // Employees and the job market.
  staff: Employee[];
  candidates: Candidate[];
  // What staff and the player did for each customer, oldest first.
  activity: ActivityEntry[];
  // Operations queued for technicians, oldest first, and the repairs they queue by themselves.
  techOps: TechOp[];
  techRules: TechRules;
  onCall: OnCall;
  marketing: Marketing;
  fairs: FairBooking[];
  clusters: Cluster[];
  workloads: Workload[];
  // Sales requests and lost sales (30-market).
  sales: Sales;
  // The player's price per resource unit by line (Products app); unset units charge the market rate.
  rates: Partial<Record<Product, Rates>>;
  // Hours each service has been down since the last monthly invoice.
  downHours: Record<string, number>;
  network: Network;
  // Incidents, seized servers, dark locations and taken-down services.
  ops: Ops;
  // Incident reports of lost disks.
  lossReports: LossReport[];
  // PHP security advisories and the nodes patched, offline or compromised.
  security: Security;
  // Customer data stolen from a host, the ransom decision and the fine that follows a sale (60-infra/breach.ts).
  breaches: Breach[];
  // Customer sites defaced, their hacks and the customers written to (60-infra/apps.ts).
  sites: Sites;
  // Domains registered or transferred for customers (30-customers/registry.ts).
  domains: Domain[];
  // The registrar partner under contract (30-customers/registrar.ts); null before the first contract.
  registrar: Registrar | null;
  // ChadGPT replies this month, billed at the next month start.
  chadUsage: ChadUsage;
  // Public addresses, the LIR membership and its blocks (60-infra/addresses.ts).
  ips: Ips;
  // News already published, as "<id>@<hour>" (80-business/news.ts).
  news: string[];
  // Next server number, next own-VM number and next service number (30-customers/hostnames.ts).
  nextNode: number;
  nextVm: number;
  nextHostNo: number;
}

// Fields every new device starts with: fresh components installed at hour `at` (the model's parts unless partList says otherwise), powered on, RAID 1 with two or more drives.
export function deviceDefaults(modelId: string, at: number, partList?: PartSpec[]) {
  const parts = partList ?? componentParts(modelById(modelId));
  const drives = parts.filter((p) => p.kind === "hdd" || p.kind === "ssd" || p.kind === "nvme").length;
  return {
    components: parts.map((p, i): Component => ({ id: `c${i + 1}`, ...p, installedAt: at, failedAt: null })),
    on: true, label: null, raid: (drives >= 2 ? "1" : "none") as RaidLevel, rebuildRate: "medium" as RebuildRate,
    rebuild: null, maintenance: null, dataLost: null,
    hung: false, bmcHung: false, log: [] as { hour: number; key: string }[],
  };
}

// Sizes for components saved before parts had them: the nth component of a kind takes the nth part of that kind in the model's preset.
export function fillSizes(modelId: string, components: Component[]): Component[] {
  const preset = componentParts(modelById(modelId)), seen: Partial<Record<ComponentKind, number>> = {};
  return components.map((c) => {
    const p = preset.filter((x) => x.kind === c.kind)[seen[c.kind] = (seen[c.kind] ?? -1) + 1];
    return c.size === undefined && p?.size !== undefined ? { ...c, size: p.size, ...(p.ff ? { ff: p.ff } : {}) } : c;
  });
}

// GPU line servers saved before cards were parts get their preset's cards, installed with the device's oldest part.
export function fillCards(modelId: string, components: Component[]): Component[] {
  const cards = componentParts(modelById(modelId)).filter((p) => p.kind === "gpu");
  if (!cards.length || components.some((c) => c.kind === "gpu")) return components;
  const top = Math.max(0, ...components.map((c) => Number(c.id.slice(1)) || 0)), at = Math.min(...components.map((c) => c.installedAt));
  return [...components, ...cards.map((p, i): Component => ({ id: `c${top + i + 1}`, ...p, installedAt: Number.isFinite(at) ? at : 0, failedAt: null }))];
}

export const device = (id: string, model: string, brand: string, rackId: string | null, slot: number, panel: string | null, name: string, price: number): Device =>
  ({ id, model, brand, rackId, slot, panel, name, bond: "failover", groups: [], price, boughtAt: 0, lease: null, store: null, transitTo: null, arriveAt: null, ...deviceDefaults(model, 0) });

// Starting infrastructure: an empty 24U basement rack and the home router. The player buys, mounts and cables the first server.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH, nextId: 8,
  locations: [{ id: "loc1", dc: null, city: "Frankfurt", az: "fra1", name: "Basement", space: "basement", positions: 1, readyAt: 0, extraCircuit: false, shelf: 4 }],
  racks: [{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0, provided: false, feedB: false, highDensity: false }],
  devices: [device("dev5", "home-router", "Sysko", null, 0, "loc1", "fra1-gw-01", 0)],
  cables: [],
  ledger: [], leases: [], powerDue: 0, docs: [guideDoc()], dcs: seedDcs(seed, 2005), waitlist: [], unlocks: [], training: null, knowHow: 0, installed: [...STARTER_APPS], checklist: [],
  customers: [], services: [], clusters: [], workloads: [], downHours: {}, lossReports: [],
  invoices: [], yearlyBilledUntil: {}, loans: [], loansBlockedUntil: 0,
  billingRules: { autoRemind: false, autoSuspendDays: 0, autoCollectDays: 0 },
  heldCustomers: [],
  tickets: [], playerBusyUntil: 0, downSince: {}, frozen: [],
  company: { name: "Basement Hosting", logo: "server", color: "oklch(0.55 0.15 255)", domain: null, mail: { kind: "none" }, tagline: "" },
  homeLine: { id: "", next: null },
  taxLoss: 0, insurance: [], brokeSince: null, gameOver: null,
  staff: [], candidates: applications(seed, 0), activity: [], techOps: [], techRules: { failed: true, worn: false, blackhole: true, updates: false }, onCall: { roster: [], lastCall: {}, month: {} },
  marketing: newMarketing(), fairs: [],
  network: newNetwork(),
  ops: newOps(),
  security: newSecurity(),
  breaches: [],
  sites: newSites(),
  sales: newSales(),
  rates: {},
  domains: [],
  registrar: null,
  chadUsage: newChadUsage(),
  ips: newIps(),
  news: [],
  nextNode: 1, nextVm: 1, nextHostNo: firstHostNo(seed),
});

export const guideDoc = (): Doc => ({ id: "guide", kind: "guide", title: t("doc.guide"), body: "", x: 16, y: 46 });
