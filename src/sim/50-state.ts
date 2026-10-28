import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";
import { componentKinds, modelById, type ComponentKind } from "./10-catalog/hardware";
import { STARTER_APPS } from "./10-catalog/store";
import { DEFAULT_HOME_LINE, seedDcs } from "./20-world/datacenters";
import { t } from "../i18n/en";
import type { Customer, Service } from "./30-customers/customers";
import type { BillingRules, Invoice, Loan } from "./45-billing/billing";
import type { Ticket } from "./40-support/tickets";
import type { Policy } from "./46-finance/finance";
import { applications, type Candidate, type Employee } from "./47-staff/staff";
import type { TechOp, TechRules } from "./47-staff/technicians";
import { newMarketing, type Marketing } from "./80-business/marketing";
import type { Cluster, Workload } from "./60-infra/cluster";
import { newNetwork, type Network } from "./60-infra/network";
import { newOps, type Ops } from "./60-infra/ops";
import { newSecurity, type Security } from "./60-infra/security";
import { newSales, type Sales } from "./30-market/market";
import type { FairBooking } from "./80-business/fairs";
import type { LossReport } from "./85-products/products";

export const SAVE_VERSION = 2;

export type BondMode = "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber";

export type SpaceKind = "basement" | "share" | "positions" | "cage" | "suite";
// Each location is an availability zone (az, like fra2) in the region of its city.
export interface Location { id: string; dc: string | null; city: string; az: string; name: string; space: SpaceKind; positions: number; readyAt: number; extraCircuit: boolean }
// share-N racks belong to the provider of a rack share and hold N units.
export type RackModel = "rack-24" | "rack-42" | "rack-47" | "share-5" | "share-10" | "share-21" | "share-42";
// arriveAt is the hour a moving rack arrives; null when it is in place. A moving rack already holds its target location and position.
export interface Rack { id: string; model: RackModel; locationId: string; position: number; name: string; arriveAt: number | null; price: number; boughtAt: number; provided: boolean; feedB: boolean; highDensity: boolean }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
// A gateway sits on its location's carrier panel: rackId null, panel = location id. A stored unit has store = its zone's location id;
// a shipped unit has store null and transitTo/arriveAt set until it arrives.
export interface Device { id: string; model: string; brand: string; rackId: string | null; slot: number; panel: string | null; name: string; bond: BondMode; groups: number[][]; price: number; boughtAt: number; lease: string | null; store: string | null; transitTo: string | null; arriveAt: number | null;
  components: Component[]; on: boolean; label: string | null; raid: RaidLevel; rebuildRate: RebuildRate;
  rebuild: { componentId: string; doneAt: number } | null; maintenance: { componentId: string; partId: string; doneAt: number } | null;
  // The hour the device's data was lost, if it ever was.
  dataLost: number | null;
  // The hour a device switched on finishes booting.
  bootUntil?: number;
}
// paid counts the monthly payments made so far; the lease ends after months payments.
export interface Lease { id: string; lessor: string; monthly: number; months: number; startedAt: number; paid: number; devices: string[] }
// A waitlist entry gets heldUntil once its space is free; the space is then reserved until that hour.
export interface WaitlistEntry { id: string; dc: string; space: "share" | "positions" | "cage" | "suite"; size: number; since: number; heldUntil: number | null }
export interface End { device: string; port: number }
export interface Cable { id: string; a: End; b: End; kind: CableKind; color: string | null }
// failedAt is the hour the component broke; null while it works.
export interface Component { id: string; kind: ComponentKind; installedAt: number; failedAt: number | null }
export type RaidLevel = "none" | "1" | "5" | "6" | "10";
export type RebuildRate = "low" | "medium" | "high";
// A desktop document; x and y are its icon position on the desktop in pixels.
export interface Doc { id: string; kind: "guide" | "note"; title: string; body: string; x: number; y: number }
export interface Company { name: string; logo: string; color: string }
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
  // Support: tickets, the minute the player's queued replies finish, and services seen offline last hour.
  tickets: Ticket[];
  playerBusyUntil: number;
  servicesDown: string[];
  // The basement's internet line (HOME_LINES id) and a switch to another line that goes live at hour at.
  homeLine: { id: string; next: { id: string; at: number } | null };
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
  // Operations queued for technicians, oldest first, and the repairs they queue by themselves.
  techOps: TechOp[];
  techRules: TechRules;
  marketing: Marketing;
  fairs: FairBooking[];
  clusters: Cluster[];
  workloads: Workload[];
  // Sales requests and lost sales (30-market).
  sales: Sales;
  // Hours each service has been down since the last monthly invoice.
  downHours: Record<string, number>;
  network: Network;
  // Incidents, seized servers, dark locations and taken-down services.
  ops: Ops;
  // Incident reports of lost disks.
  lossReports: LossReport[];
  // PHP security advisories and the nodes patched, offline or compromised.
  security: Security;
}

// Fields every new device starts with: fresh components installed at hour `at`, powered on, RAID 1 with two or more drives.
export function deviceDefaults(modelId: string, at: number) {
  const kinds = componentKinds(modelById(modelId));
  const drives = kinds.filter((k) => k === "hdd" || k === "ssd" || k === "nvme").length;
  return {
    components: kinds.map((kind, i): Component => ({ id: `c${i + 1}`, kind, installedAt: at, failedAt: null })),
    on: true, label: null, raid: (drives >= 2 ? "1" : "none") as RaidLevel, rebuildRate: "medium" as RebuildRate,
    rebuild: null, maintenance: null, dataLost: null,
  };
}

const device = (id: string, model: string, brand: string, rackId: string | null, slot: number, panel: string | null, name: string, price: number): Device =>
  ({ id, model, brand, rackId, slot, panel, name, bond: "failover", groups: [], price, boughtAt: 0, lease: null, store: null, transitTo: null, arriveAt: null, ...deviceDefaults(model, 0) });

// Starting infrastructure: a 24U basement rack with a server and a switch, cabled to the home router so the server starts online.
// startGame in 90-actions/start.ts adds the starting customers.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH, nextId: 8,
  locations: [{ id: "loc1", dc: null, city: "Frankfurt", az: "fra1", name: "Basement", space: "basement", positions: 1, readyAt: 0, extraCircuit: false }],
  racks: [{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0, provided: false, feedB: false, highDensity: false }],
  devices: [
    device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500),
    device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60),
    device("dev5", "home-router", "Sysko", null, 0, "loc1", "fra1-gw-01", 0),
  ],
  cables: [
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper", color: null },
  ],
  ledger: [], leases: [], powerDue: 0, docs: [guideDoc()], dcs: seedDcs(seed, 2005), waitlist: [], unlocks: [], training: null, knowHow: 0, installed: [...STARTER_APPS], checklist: [],
  customers: [], services: [], clusters: [], workloads: [], downHours: {}, lossReports: [],
  invoices: [], yearlyBilledUntil: {}, loans: [], loansBlockedUntil: 0,
  billingRules: { autoRemind: false, autoSuspendDays: 0, autoCollectDays: 0 },
  tickets: [], playerBusyUntil: 0, servicesDown: [],
  company: { name: "Basement Hosting", logo: "server", color: "oklch(0.55 0.15 255)" },
  homeLine: { id: DEFAULT_HOME_LINE, next: null },
  taxLoss: 0, insurance: [], brokeSince: null, gameOver: null,
  staff: [], candidates: applications(seed, 0), techOps: [], techRules: { failed: true, worn: false },
  marketing: newMarketing(), fairs: [],
  network: newNetwork(),
  ops: newOps(),
  security: newSecurity(),
  sales: newSales(),
});

export const guideDoc = (): Doc => ({ id: "guide", kind: "guide", title: t("doc.guide"), body: "", x: 16, y: 46 });
