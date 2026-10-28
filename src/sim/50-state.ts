import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";
import { seedDcs } from "./20-world/datacenters";
import { t } from "../i18n/en";
import type { Customer, Service } from "./30-customers/customers";
import type { BillingRules, Invoice, Loan } from "./45-billing/billing";
import type { Ticket } from "./40-support/tickets";

export const SAVE_VERSION = 2;

export type BondMode = "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber";

export type SpaceKind = "basement" | "share" | "positions" | "cage" | "suite";
// Each location is an availability zone (az, like fra2) in the region of its city.
export interface Location { id: string; dc: string | null; city: string; az: string; name: string; space: SpaceKind; positions: number; readyAt: number }
// share-N racks belong to the provider of a rack share and hold N units.
export type RackModel = "rack-24" | "rack-42" | "rack-47" | "share-5" | "share-10" | "share-21" | "share-42";
// arriveAt is the hour a moving rack arrives; null when it is in place. A moving rack already holds its target location and position.
export interface Rack { id: string; model: RackModel; locationId: string; position: number; name: string; arriveAt: number | null; price: number; boughtAt: number; provided: boolean }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
// A gateway sits on its location's carrier panel: rackId null, panel = location id. A stored unit has store = its zone's location id;
// a shipped unit has store null and transitTo/arriveAt set until it arrives.
export interface Device { id: string; model: string; brand: string; rackId: string | null; slot: number; panel: string | null; name: string; bond: BondMode; groups: number[][]; price: number; boughtAt: number; lease: string | null; store: string | null; transitTo: string | null; arriveAt: number | null }
// paid counts the monthly payments made so far; the lease ends after months payments.
export interface Lease { id: string; lessor: string; monthly: number; months: number; startedAt: number; paid: number; devices: string[] }
// A waitlist entry gets heldUntil once its space is free; the space is then reserved until that hour.
export interface WaitlistEntry { id: string; dc: string; space: "share" | "positions" | "cage" | "suite"; size: number; since: number; heldUntil: number | null }
export interface End { device: string; port: number }
export interface Cable { id: string; a: End; b: End; kind: CableKind }
// A desktop document; x and y are its icon position on the desktop in pixels.
export interface Doc { id: string; kind: "guide" | "note"; title: string; body: string; x: number; y: number }
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
  docs: Doc[];
  // Positions rented by competitors in each datacenter.
  dcs: Record<string, { others: number }>;
  waitlist: WaitlistEntry[];
}

const device = (id: string, model: string, brand: string, rackId: string | null, slot: number, panel: string | null, name: string, price: number): Device =>
  ({ id, model, brand, rackId, slot, panel, name, bond: "failover", groups: [], price, boughtAt: 0, lease: null, store: null, transitTo: null, arriveAt: null });

// Starting state: a 24U basement rack with a server and a switch, cabled to the home router so the server starts online.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH, nextId: 8,
  locations: [{ id: "loc1", dc: null, city: "Frankfurt", az: "fra1", name: "Basement", space: "basement", positions: 1, readyAt: 0 }],
  racks: [{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0, provided: false }],
  devices: [
    device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500),
    device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60),
    device("dev5", "home-router", "Sysko", null, 0, "loc1", "fra1-gw-01", 0),
  ],
  cables: [
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper" },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper" },
  ],
  ledger: [], leases: [], powerDue: 0, docs: [guideDoc()], dcs: seedDcs(seed, 2005), waitlist: [],
  customers: [], services: [],
  invoices: [], yearlyBilledUntil: {}, loans: [], loansBlockedUntil: 0,
  billingRules: { autoRemind: false, autoSuspendDays: 0 },
  tickets: [], playerBusyUntil: 0, servicesDown: [],
});

export const guideDoc = (): Doc => ({ id: "guide", kind: "guide", title: t("doc.guide"), body: "", x: 16, y: 46 });
