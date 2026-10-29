import { START_YEAR, yearOf } from "../00-core/time";
import type { GameState } from "../50-state";

// Values from docs/design/economy.md, section "Pear One subscriptions". The desk replaces the inbox of the app whose id stays "Support".
export type DeskFeature = "filters" | "search" | "assign" | "templates" | "slaTimers" | "customerSidebar" | "reports";

export interface Desk { id: string; name: string; from: number; monthly: number; features: DeskFeature[] }

export const DESKS: Desk[] = [
  { id: "ostickit", name: "OsTickit", from: START_YEAR, monthly: 0, features: ["filters"] },
  { id: "zendusk", name: "Zendusk", from: 2007, monthly: 49, features: ["filters", "search", "assign", "templates", "slaTimers", "customerSidebar", "reports"] },
  { id: "freshdusk", name: "Freshdusk", from: 2010, monthly: 15, features: ["filters", "search", "assign", "templates", "slaTimers"] },
  { id: "freescoot", name: "FreeScoot", from: 2018, monthly: 0, features: ["filters", "search", "assign"] },
];

export const DESK_FEATURES: Record<string, DeskFeature[]> = Object.fromEntries(DESKS.map((d) => [d.id, d.features]));

export const deskById = (id: string): Desk | undefined => DESKS.find((d) => d.id === id);
// The desk installed, or none: the app then runs as a plain inbox.
export const deskOf = (s: Pick<GameState, "installed">): Desk | undefined => DESKS.find((d) => s.installed.includes(d.id));
export const deskHas = (s: Pick<GameState, "installed">, f: DeskFeature): boolean => !!deskOf(s)?.features.includes(f);
export const deskReady = (s: Pick<GameState, "hour">, id: string): boolean => yearOf(s.hour) >= (deskById(id)?.from ?? 0);

// One seat for the owner and one for every employee on the support desk.
export const seats = (s: Pick<GameState, "staff">): number => 1 + s.staff.filter((e) => e.role === "support").length;
