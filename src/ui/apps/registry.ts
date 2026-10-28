import {
  BookOpen, ChartLine, ChartPie, Contact, FileText, Globe, Landmark, GraduationCap, LifeBuoy, ListChecks, Megaphone, Package, Receipt, Server, Settings, ShoppingCart, Users,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { BankApp } from "./bank/BankApp";
import { BillingApp } from "./billing/BillingApp";
import { ChecklistApp } from "./checklist/ChecklistApp";
import { FinanceApp } from "./finance/FinanceApp";
import type { GameState } from "../../sim/50-state";
import { CustomersApp } from "./customers/CustomersApp";
import { SupportApp } from "./support/SupportApp";
import { ResearchApp } from "./research/ResearchApp";
import { isFinal } from "../../sim/40-support/tickets";
import { isUnpaid } from "../../sim/45-billing/billing";
import { deviceHealth } from "../../sim/60-infra/status";

export interface AppDef {
  name: string;
  icon: LucideIcon;
  tile: string;
  about: string;
  hidden?: boolean;
  body?: ComponentType;
  // The red count on the dock tile, shown once the Dock badges upgrade is bought.
  badge?: (s: GameState) => number;
}

// Dock order; a divider follows every 4th app.
export const APPS: AppDef[] = [
  { name: "Locations", icon: Server, tile: "oklch(0.5 0.06 250)", about: "Shows your sites on a map, the racks inside them and every device front.",
    badge: (s) => s.devices.reduce((n, d) => n + deviceHealth(s, d.id).failed.length, 0) },
  { name: "Shop", icon: ShoppingCart, tile: "oklch(0.6 0.15 40)", about: "Sells servers, switches and patch panels into your storage." },
  { name: "Network", icon: Globe, tile: "oklch(0.58 0.12 210)", about: "Manages transit, peering and DDoS protection." },
  { name: "Products", icon: Package, tile: "oklch(0.55 0.17 295)", about: "Defines your product lines, plans, licenses and clusters." },
  { name: "Customers", icon: Users, tile: "oklch(0.52 0.17 268)", about: "Lists your customers with their contracts and happiness.", body: CustomersApp },
  { name: "Support", icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: "Collects tickets so you can answer them with templates and actions.", body: SupportApp,
    badge: (s) => s.tickets.filter((t) => !isFinal(t)).length },
  { name: "Billing", icon: Receipt, tile: "oklch(0.6 0.14 160)", about: "Sends invoices, reminders and dunning notices.", body: BillingApp,
    badge: (s) => s.invoices.filter(isUnpaid).length },
  { name: "Finance", icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: "Shows your profit and loss, cash flow, tax, insurance and the account statement with every booking.", body: FinanceApp },
  { name: "Bank", icon: Landmark, tile: "oklch(0.45 0.04 255)", about: "Offers loans up to your credit limit and lets you repay them early.", body: BankApp },
  { name: "Staff", icon: Contact, tile: "oklch(0.7 0.15 70)", about: "Hires people and assigns them to work queues." },
  { name: "Marketing", icon: Megaphone, tile: "oklch(0.62 0.19 350)", about: "Runs campaigns and manages reviews." },
  { name: "Market", icon: ChartPie, tile: "oklch(0.62 0.12 230)", about: "Shows demand, customer requirements and lost sales." },
  { name: "Research", icon: GraduationCap, tile: "oklch(0.72 0.15 95)", about: "Trains your company in new skills with the know-how it earns.", body: ResearchApp },
  { name: "Getting started", icon: BookOpen, tile: "oklch(0.55 0.15 255)", about: "Explains the controls and how the game saves.", hidden: true },
  { name: "Notes", icon: FileText, tile: "oklch(0.7 0.13 85)", about: "Edits the notes on your desktop.", hidden: true },
  { name: "Checklist", icon: ListChecks, tile: "oklch(0.58 0.14 150)", about: "Lists the goals from your first server to your own datacenter and marks the ones you reach.", body: ChecklistApp },
  { name: "Settings", icon: Settings, tile: "oklch(0.55 0.01 260)", about: "Sets your company name and logo, the theme and which apps may send notifications." },
];

export const appByName = (name: string): AppDef => APPS.find((a) => a.name === name) ?? APPS[0];
