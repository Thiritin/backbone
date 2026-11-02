import type { Product } from "../30-customers/customers";
import { textFields } from "../00-core/text";
import { START_YEAR, yearOf } from "../00-core/time";
import type { GameState, LedgerEntry } from "../50-state";
import { seats, type Desk } from "./desks";

// Values from docs/design/economy.md, section "Pear One subscriptions". The skill each item needs is in research.ts.

// Apps every new game has in the dock, free of charge. Getting started and Notes are desktop documents and never sit in the dock.
// Books comes with the bookkeeping program the player buys in the Pear Store.
export const STARTER_APPS = ["Applications", "Locations", "Shop", "Browser", "Terminal", "Support", "Settings", "Marketing", "Security", "Research"];

// id is the app name for apps; monthly is the 2005 price, charged once per seat when perSeat is set.
export interface StoreItem { id: string; kind: "app" | "upgrade" | "bot" | "desk"; name: string; monthly: number; perSeat?: boolean }

export const WIDGETS: [string, string, number][] = [
  ["widgetCalendar", "Calendar widget", 1], ["widgetTickets", "Open tickets widget", 1], ["widgetCash", "Cash widget", 1],
  ["widgetRevenue", "Monthly revenue widget", 2], ["widgetCustomers", "Customers widget", 1], ["widgetLevel", "Level widget", 2],
];

export const STORE: StoreItem[] = [
  { id: "Network", kind: "app", name: "Network", monthly: 0 },
  { id: "Terminal", kind: "app", name: "Terminal", monthly: 0 },
  { id: "Staff", kind: "app", name: "Staff", monthly: 20 },
  // Preinstalled for the company domain; the Marketing campaigns skill opens the rest of the app.
  { id: "Marketing", kind: "app", name: "Marketing", monthly: 0 },
  { id: "Market", kind: "app", name: "Market", monthly: 15 },
  { id: "Nagiosaurus", kind: "app", name: "Nagiosaurus", monthly: 15 },
  { id: "Knowledge base", kind: "app", name: "Knowledge base", monthly: 10 },
  { id: "searchlight", kind: "upgrade", name: "Searchlight", monthly: 2 },
  { id: "keepassive", kind: "upgrade", name: "KeePassive", monthly: 3 },
  ...WIDGETS.map(([id, name, monthly]): StoreItem => ({ id, kind: "upgrade", name, monthly })),
  // One subscription is one bot; what each bot does is in 47-staff/staff.ts.
  { id: "chadGpt", kind: "bot", name: "ChadGPT Support", monthly: 50 },
  { id: "clipsy", kind: "bot", name: "Clipsy Reminders", monthly: 100 },
];
textFields("sim.store", STORE.filter((i) => i.id.startsWith("widget") || i.id === "Knowledge base"), ["name"]);

export const storeItem = (id: string): StoreItem | undefined => STORE.find((i) => i.id === id);
// A desk billed per seat: a hosted subscription from its vendor's site, or a legacy desk from the Pear Store.
export const deskItem = (d: Desk): StoreItem => ({ id: d.id, kind: "desk", name: d.name, monthly: d.monthly, perSeat: true });

export const PRICE_RISE = 0.08;
// ponytail: base price only; the per-device or per-customer extras and Pear's surprise price adjustments come with the modules that need them.
export const subscriptionPrice = (item: StoreItem, year: number): number =>
  Math.round(item.monthly * (1 + PRICE_RISE) ** Math.max(0, year - START_YEAR) * 100) / 100;

// What the item costs this month: per-seat items count the owner and every support employee.
export const monthlyCharge = (s: GameState, item: StoreItem): number =>
  Math.round(subscriptionPrice(item, yearOf(s.hour)) * (item.perSeat ? seats(s) : 1) * 100) / 100;

export const subscriptionEntry = (s: GameState, item: StoreItem): LedgerEntry => item.perSeat
  ? { hour: s.hour, category: "subscriptions", key: "ledger.subscriptionSeats", params: { name: item.name, seats: seats(s) }, amount: -monthlyCharge(s, item) }
  : { hour: s.hour, category: "subscriptions", key: "ledger.subscription", params: { name: item.name }, amount: -monthlyCharge(s, item) };

// Know-how each active contract earns per month; DNS counts like a domain.
export const KNOW_HOW: Record<Product, number> = {
  domain: 0.2, ssl: 0.2, dns: 0.2, webHosting: 1, vpn: 1, gameServer: 1.5, vps: 2, storage: 3, cloud: 4, dedicated: 5, colocation: 6, gpu: 8, reseller: 2,
};
