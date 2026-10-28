import {
  BookOpen, ChartLine, ChartPie, Contact, Globe, Landmark, LifeBuoy, Lightbulb, Megaphone, Package, Receipt, Server, Settings, Users,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import type { GameState } from "../../sim/50-state";
import { CustomersApp } from "./customers/CustomersApp";
import { SupportApp } from "./support/SupportApp";

export interface AppDef {
  name: string;
  icon: LucideIcon;
  tile: string;
  about: string;
  hidden?: boolean;
  body?: ComponentType;
  // The red count on the dock tile.
  badge?: (s: GameState) => number;
}

// Dock order; dividers fall after the 4th and 8th app.
export const APPS: AppDef[] = [
  { name: "Locations", icon: Server, tile: "oklch(0.5 0.06 250)", about: "Shows your sites on a map, the racks inside them and every device front." },
  { name: "Network", icon: Globe, tile: "oklch(0.58 0.12 210)", about: "Manages transit, peering and DDoS protection on a map of Europe." },
  { name: "Products", icon: Package, tile: "oklch(0.55 0.17 295)", about: "Defines your product lines, plans, licenses and clusters." },
  { name: "Customers", icon: Users, tile: "oklch(0.52 0.17 268)", about: "Lists your customers with their contracts and happiness.", body: CustomersApp },
  { name: "Support", icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: "Collects tickets so you can answer them with templates and actions.", body: SupportApp,
    badge: (s) => s.tickets.filter((t) => t.status === "open").length },
  { name: "Billing", icon: Receipt, tile: "oklch(0.6 0.14 160)", about: "Sends invoices, reminders and dunning notices." },
  { name: "Finance", icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: "Reports profit and loss, cash flow, recurring revenue and churn." },
  { name: "Bank", icon: Landmark, tile: "oklch(0.45 0.04 255)", about: "Arranges loans and tracks their repayments." },
  { name: "Staff", icon: Contact, tile: "oklch(0.7 0.15 70)", about: "Hires people and assigns them to work queues." },
  { name: "Marketing", icon: Megaphone, tile: "oklch(0.62 0.19 350)", about: "Runs campaigns and manages reviews." },
  { name: "Market", icon: ChartPie, tile: "oklch(0.62 0.12 230)", about: "Shows demand, customer requirements and lost sales." },
  { name: "Unlocks", icon: Lightbulb, tile: "oklch(0.72 0.15 95)", about: "Spends know-how on new products, hardware and tools." },
  { name: "Getting started", icon: BookOpen, tile: "oklch(0.55 0.15 255)", about: "Explains the controls and how the game saves.", hidden: true },
  { name: "Settings", icon: Settings, tile: "oklch(0.55 0.01 260)", about: "Sets which apps may send notifications and how they appear." },
];

export const appByName = (name: string): AppDef => APPS.find((a) => a.name === name) ?? APPS[0];
