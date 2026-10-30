import {
  Activity, AppWindow, FolderOpen, Bug, BookOpen, Compass, ChartLine, ChartPie, Contact, FileText, Network, GraduationCap, LifeBuoy, Megaphone, Newspaper, Receipt, Server, Settings, ShieldAlert, ShoppingCart, SquareTerminal, Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { BillingApp } from "./billing/BillingApp";
import { BrowserApp } from "./browser/BrowserApp";
import { DevApp } from "./dev/DevApp";
import { FinanceApp } from "./finance/FinanceApp";
import { MarketingApp } from "./marketing/MarketingApp";
import { MarketApp } from "./market/MarketApp";
import { NetworkApp } from "./network/NetworkApp";
import { NewsApp } from "./news/NewsApp";
import { SecurityApp } from "./SecurityApp";
import { KnowledgeBaseApp } from "./KnowledgeBaseApp";
import { ApplicationsApp } from "./ApplicationsApp";
import { missingFor } from "../../sim/30-market/market";
import type { GameState } from "../../sim/50-state";
import { CustomersApp } from "./customers/CustomersApp";
import { SupportApp } from "./support/SupportApp";
import { supportApp } from "./support/desk";
import type { MarkProps } from "../art/mailmarks";
import { ResearchApp } from "./research/ResearchApp";
import { StaffApp } from "./staff/StaffApp";
import { TerminalApp } from "./terminal/TerminalApp";
import { WebsiteApp } from "./website/WebsiteApp";
import { isFinal } from "../../sim/40-support/tickets";
import { isUnpaid } from "../../sim/45-billing/billing";
import { deviceHealth } from "../../sim/60-infra/status";

export interface AppDef {
  name: string;
  icon: ComponentType<MarkProps>;
  tile: string;
  about: string;
  hidden?: boolean;
  body?: ComponentType;
  // The red count on the dock tile.
  badge?: (s: GameState) => number;
}

// Dock order; a divider follows every 4th app.
export const APPS: AppDef[] = [
  { name: "Applications", icon: FolderOpen, tile: "oklch(0.6 0.12 240)", about: "Shows your installed apps, the desktop, your downloads and the USB stick, which you write an ISO to here.", body: ApplicationsApp },
  { name: "Locations", icon: Server, tile: "oklch(0.5 0.06 250)", about: "Shows your sites on a map, the racks inside them and every device front.",
    badge: (s) => s.devices.reduce((n, d) => n + deviceHealth(s, d.id).failed.length, 0) + s.network.requests.length + s.network.attacks.length },
  { name: "Shop", icon: ShoppingCart, tile: "oklch(0.6 0.15 40)", about: "Sells servers, switches and patch panels into your storage." },
  { name: "Network", icon: Network, tile: "oklch(0.58 0.12 210)", about: "Shows every site on a map and manages DDoS protection, your AS number and address registry.", body: NetworkApp },
  { name: "Terminal", icon: SquareTerminal, tile: "oklch(0.3 0.01 255)", about: "Opens sessions on your servers, pings hosts and traces the route to them.", body: TerminalApp },
  { name: "Website", icon: AppWindow, tile: "oklch(0.6 0.13 230)", about: "Opens your company website in the Browser.", body: WebsiteApp },
  { name: "Browser", icon: Compass, tile: "oklch(0.56 0.15 250)", about: "Opens your company site, your customers' sites and the pages of your suppliers.", body: BrowserApp },
  { name: "Customers", icon: Users, tile: "oklch(0.52 0.17 268)", about: "Lists your customers with their contracts and happiness.", body: CustomersApp },
  { name: "Support", icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: "Collects tickets, orders and sales requests so you can answer, accept, quote or decline them.", body: SupportApp,
    badge: (s) => s.tickets.filter((t) => !isFinal(t)).length
      + s.sales.requests.filter((r) => r.kind === "new" && (r.status === "open" || r.status === "countered") && !missingFor(s, r).length).length },
  { name: "Billing", icon: Receipt, tile: "oklch(0.6 0.14 160)", about: "Sends invoices, reminders and dunning notices.", body: BillingApp,
    badge: (s) => s.invoices.filter(isUnpaid).length },
  { name: "Finance", icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: "Shows your profit and loss, cash flow, tax, insurance and the account statement with every booking.", body: FinanceApp },
  { name: "Staff", icon: Contact, tile: "oklch(0.7 0.15 70)", about: "Hires people and assigns them to work queues.", body: StaffApp },
  { name: "Marketing", icon: Megaphone, tile: "oklch(0.62 0.19 350)", about: "Runs campaigns and manages reviews.", body: MarketingApp },
  { name: "Market", icon: ChartPie, tile: "oklch(0.62 0.12 230)", about: "Shows demand, customer requirements and lost sales.", body: MarketApp },
  { name: "Knowledge base", icon: BookOpen, tile: "oklch(0.6 0.12 200)", about: "Lists the help articles customers read instead of writing in.", body: KnowledgeBaseApp },
  { name: "Nagiosaurus", icon: Activity, tile: "oklch(0.58 0.14 150)", about: "Watches every installed software for known vulnerabilities and lists the most exposed first.", hidden: true },
  { name: "Research", icon: GraduationCap, tile: "oklch(0.72 0.15 95)", about: "Trains your company in new skills with the know-how it earns.", body: ResearchApp },
  { name: "Getting started", icon: BookOpen, tile: "oklch(0.55 0.15 255)", about: "Explains the controls and how the game saves.", hidden: true },
  { name: "Security", icon: ShieldAlert, tile: "oklch(0.58 0.17 25)", about: "Lists the nodes a PHP vulnerability affects and takes their sites offline, patches and cleans them up, and keeps the incident reports of lost data.", body: SecurityApp,
    badge: (s) => s.lossReports.filter((r) => r.items.some((i) => !i.restored)).length },
  { name: "Notes", icon: FileText, tile: "oklch(0.7 0.13 85)", about: "Edits the notes on your desktop.", hidden: true },
  { name: "News", icon: Newspaper, tile: "oklch(0.55 0.12 30)", about: "Lists the headlines about new software, hardware and market changes.", hidden: true, body: NewsApp },
  { name: "Dev menu", icon: Bug, tile: "oklch(0.5 0.15 25)", about: "Sets the date, your money and your research points for testing.", hidden: true, body: DevApp },
  { name: "Settings", icon: Settings, tile: "oklch(0.55 0.01 260)", about: "Sets your company name and logo, the theme and which apps may send notifications." },
];

export const appByName = (name: string): AppDef => APPS.find((a) => a.name === name) ?? APPS[0];


// The app as the player sees it: Support is Email, or the installed desk, with its own name, mark and tile.
export const appFor = (s: GameState, name: string): AppDef =>
  name === "Support" ? { ...appByName(name), ...supportApp(s) } : name === "Applications" ? { ...appByName(name), name: "Finder" } : appByName(name);
