import type { Product } from "../30-customers/customers";
import { START_YEAR } from "../00-core/time";

// Values from docs/design/economy.md, section "Pear One subscriptions". The skill each item needs is in research.ts.

// Apps every new game has in the dock, free of charge. Getting started and Notes are desktop documents and never sit in the dock.
export const STARTER_APPS = ["Locations", "Shop", "Website", "Customers", "Support", "Billing", "Finance", "Bank", "Research", "Checklist", "Settings"];

// id is the app name for apps; monthly is the 2005 price.
export interface StoreItem { id: string; kind: "app" | "upgrade" | "bot"; name: string; monthly: number }

export const WIDGETS: [string, string, number][] = [
  ["widgetCalendar", "Calendar widget", 1], ["widgetTickets", "Open tickets widget", 1], ["widgetCash", "Cash widget", 1],
  ["widgetRevenue", "Monthly revenue widget", 2], ["widgetCustomers", "Customers widget", 1], ["widgetLevel", "Level widget", 2],
];

export const STORE: StoreItem[] = [
  { id: "Network", kind: "app", name: "Network", monthly: 0 },
  { id: "Products", kind: "app", name: "Products", monthly: 15 },
  { id: "Virtual machines", kind: "app", name: "Virtual machines", monthly: 0 },
  { id: "Staff", kind: "app", name: "Staff", monthly: 20 },
  { id: "Marketing", kind: "app", name: "Marketing", monthly: 20 },
  { id: "Market", kind: "app", name: "Market", monthly: 15 },
  { id: "Nagiosaurus", kind: "app", name: "Nagiosaurus", monthly: 15 },
  { id: "dockBadges", kind: "upgrade", name: "Dock badges", monthly: 5 },
  ...WIDGETS.map(([id, name, monthly]): StoreItem => ({ id, kind: "upgrade", name, monthly })),
  // One subscription is one bot; what each bot does is in 47-staff/staff.ts.
  { id: "chadGpt", kind: "bot", name: "ChadGPT Support", monthly: 50 },
  { id: "clipsy", kind: "bot", name: "Clipsy Reminders", monthly: 100 },
];

export const storeItem = (id: string): StoreItem | undefined => STORE.find((i) => i.id === id);

export const PRICE_RISE = 0.08;
// ponytail: base price only; the per-device or per-customer extras and Pear's surprise price adjustments come with the modules that need them.
export const subscriptionPrice = (item: StoreItem, year: number): number =>
  Math.round(item.monthly * (1 + PRICE_RISE) ** Math.max(0, year - START_YEAR) * 100) / 100;

// Know-how each active contract earns per month; DNS counts like a domain.
export const KNOW_HOW: Record<Product, number> = {
  domain: 0.2, ssl: 0.2, dns: 0.2, webHosting: 1, vpn: 1, gameServer: 1.5, vps: 2, storage: 3, cloud: 4, dedicated: 5, colocation: 6,
};
