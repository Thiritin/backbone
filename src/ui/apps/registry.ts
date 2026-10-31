import {
  Activity, Cloud, FolderOpen, Bug, BookOpen, Compass, ChartLine, ChartPie, Contact, FileText, Network, GraduationCap, LifeBuoy, Megaphone, MessageCircle, Newspaper, Receipt, Server, Settings, ShieldAlert, ShoppingCart, SquareTerminal, Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { t } from "../../i18n/en";
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
import type { GameState } from "../../sim/50-state";
import { CustomersApp } from "./customers/CustomersApp";
import { SupportApp } from "./support/SupportApp";
import { supportApp } from "./support/desk";
import type { MarkProps } from "../art/mailmarks";
import { ResearchApp } from "./research/ResearchApp";
import { StaffApp } from "./staff/StaffApp";
import { WeatherApp } from "./weather/WeatherApp";
import { TerminalApp } from "./terminal/TerminalApp";
import { isFinal } from "../../sim/40-support/tickets";
import { isUnpaid } from "../../sim/45-billing/billing";
import { deviceHealth } from "../../sim/60-infra/status";
import { yearOf } from "../../sim/00-core/time";

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
  { name: "Applications", icon: FolderOpen, tile: "oklch(0.6 0.12 240)", about: t("apps.about.Applications"), body: ApplicationsApp },
  { name: "Locations", icon: Server, tile: "oklch(0.5 0.06 250)", about: t("apps.about.Locations"),
    badge: (s) => s.devices.reduce((n, d) => n + deviceHealth(s, d.id).failed.length, 0) + s.network.requests.length + s.network.attacks.length },
  { name: "Shop", icon: ShoppingCart, tile: "oklch(0.6 0.15 40)", about: t("apps.about.Shop") },
  { name: "Network", icon: Network, tile: "oklch(0.58 0.12 210)", about: t("apps.about.Network"), body: NetworkApp },
  { name: "Terminal", icon: SquareTerminal, tile: "oklch(0.3 0.01 255)", about: t("apps.about.Terminal"), body: TerminalApp },
  { name: "Browser", icon: Compass, tile: "oklch(0.56 0.15 250)", about: t("apps.about.Browser"), body: BrowserApp },
  { name: "Customers", icon: Users, tile: "oklch(0.52 0.17 268)", about: t("apps.about.Customers"), body: CustomersApp },
  { name: "Support", icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: t("apps.about.Support"), body: SupportApp,
    badge: (s) => s.tickets.filter((t) => !isFinal(t)).length },
  { name: "Billing", icon: Receipt, tile: "oklch(0.6 0.14 160)", about: t("apps.about.Billing"), body: BillingApp,
    badge: (s) => s.invoices.filter(isUnpaid).length },
  { name: "Finance", icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: t("apps.about.Finance"), body: FinanceApp },
  { name: "Staff", icon: Contact, tile: "oklch(0.7 0.15 70)", about: t("apps.about.Staff"), body: StaffApp },
  { name: "Marketing", icon: Megaphone, tile: "oklch(0.62 0.19 350)", about: t("apps.about.Marketing"), body: MarketingApp },
  { name: "Market", icon: ChartPie, tile: "oklch(0.62 0.12 230)", about: t("apps.about.Market"), body: MarketApp },
  { name: "Knowledge base", icon: BookOpen, tile: "oklch(0.6 0.12 200)", about: t("apps.about.Knowledge base"), body: KnowledgeBaseApp },
  { name: "Nagiosaurus", icon: Activity, tile: "oklch(0.58 0.14 150)", about: t("apps.about.Nagiosaurus"), hidden: true },
  { name: "Research", icon: GraduationCap, tile: "oklch(0.72 0.15 95)", about: t("apps.about.Research"), body: ResearchApp },
  { name: "Getting started", icon: BookOpen, tile: "oklch(0.55 0.15 255)", about: t("apps.about.Getting started"), hidden: true },
  { name: "Security", icon: ShieldAlert, tile: "oklch(0.58 0.17 25)", about: t("apps.about.Security"), body: SecurityApp,
    badge: (s) => s.lossReports.filter((r) => r.items.some((i) => !i.restored)).length },
  { name: "Notes", icon: FileText, tile: "oklch(0.7 0.13 85)", about: t("apps.about.Notes"), hidden: true },
  { name: "News", icon: Newspaper, tile: "oklch(0.55 0.12 30)", about: t("apps.about.News"), hidden: true, body: NewsApp },
  { name: "Weather", icon: Cloud, tile: "oklch(0.62 0.12 240)", about: t("apps.about.Weather"), hidden: true, body: WeatherApp },
  { name: "Dev menu", icon: Bug, tile: "oklch(0.5 0.15 25)", about: t("apps.about.Dev menu"), hidden: true, body: DevApp },
  { name: "Chat", icon: MessageCircle, tile: "oklch(0.55 0.16 275)", about: t("apps.about.Chat") },
  { name: "Settings", icon: Settings, tile: "oklch(0.55 0.01 260)", about: t("apps.about.Settings") },
];

// The app name on screen; the name itself stays the window id.
export const appTitle = (a: Pick<AppDef, "name">): string => {
  const key = `apps.name.${a.name}`, s = t(key);
  return s === key ? a.name : s;
};

export const appByName = (name: string): AppDef => APPS.find((a) => a.name === name) ?? APPS[0];


// Chat wears the messenger of the year; every one of them opens the Backbone Discord.
const CHATS = [{ from: 2016, name: "Diskord", tile: "oklch(0.55 0.16 275)" }, { from: 2008, name: "Skipe", tile: "oklch(0.62 0.13 230)" }, { from: 0, name: "ICU", tile: "oklch(0.62 0.17 140)" }];

// The app as the player sees it: Support is Email, or the installed desk, with its own name, mark and tile.
export const appFor = (s: GameState, name: string): AppDef =>
  name === "Support" ? { ...appByName(name), ...supportApp(s) } : name === "Chat" ? { ...appByName(name), ...CHATS.find((c) => c.from <= yearOf(s.hour))! } : name === "Applications" ? { ...appByName(name), name: "Finder" } : appByName(name);
