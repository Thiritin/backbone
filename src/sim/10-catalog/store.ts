import type { Product } from "../30-customers/customers";
import { START_YEAR } from "../00-core/time";

// Values from docs/design/economy.md, sections "Pear One subscriptions" and "Know-how and unlock costs".

// Apps every new game has in the dock, free of charge. Getting started and Notes are desktop documents and never sit in the dock.
export const STARTER_APPS = ["Locations", "Shop", "Customers", "Support", "Billing", "Finance", "Bank", "Unlocks", "Checklist", "Settings"];

// id is the app name for apps; monthly is the 2005 price.
export interface StoreItem { id: string; kind: "app" | "upgrade"; name: string; knowHow: number; monthly: number }

// Desktop widgets need no research.
export const WIDGETS: [string, string, number][] = [
  ["widgetCalendar", "Calendar widget", 1], ["widgetTickets", "Open tickets widget", 1], ["widgetCash", "Cash widget", 1],
  ["widgetRevenue", "Monthly revenue widget", 2], ["widgetCustomers", "Customers widget", 1], ["widgetLevel", "Level widget", 2],
];

export const STORE: StoreItem[] = [
  { id: "Network", kind: "app", name: "Network", knowHow: 300, monthly: 25 },
  { id: "Products", kind: "app", name: "Products", knowHow: 200, monthly: 15 },
  { id: "Staff", kind: "app", name: "Staff", knowHow: 100, monthly: 20 },
  { id: "Marketing", kind: "app", name: "Marketing", knowHow: 300, monthly: 20 },
  { id: "Market", kind: "app", name: "Market", knowHow: 800, monthly: 15 },
  { id: "dockBadges", kind: "upgrade", name: "Dock badges", knowHow: 50, monthly: 5 },
  ...WIDGETS.map(([id, name, monthly]): StoreItem => ({ id, kind: "upgrade", name, knowHow: 0, monthly })),
];

export const needsResearch = (item: StoreItem, unlocks: string[]): boolean => item.knowHow > 0 && !unlocks.includes(item.id);

export const storeItem = (id: string): StoreItem | undefined => STORE.find((i) => i.id === id);

export const PRICE_RISE = 0.08;
// ponytail: base price only; the per-device or per-customer extras and Pear's surprise price adjustments come with the modules that need them.
export const subscriptionPrice = (item: StoreItem, year: number): number =>
  Math.round(item.monthly * (1 + PRICE_RISE) ** Math.max(0, year - START_YEAR) * 100) / 100;

// Know-how each active contract earns per month; DNS counts like a domain.
export const KNOW_HOW: Record<Product, number> = {
  domain: 0.2, ssl: 0.2, dns: 0.2, webHosting: 1, vpn: 1, gameServer: 1.5, vps: 2, storage: 3, cloud: 4, dedicated: 5, colocation: 6,
};
