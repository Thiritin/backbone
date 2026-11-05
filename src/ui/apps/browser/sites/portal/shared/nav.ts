import type { GameState } from "../../../../../../sim/50-state";

export type ScreenName = "home" | "products" | "product" | "settings" | "servers" | "orders" | "clients" | "client" | "order" | "service" | "invoices" | "quotes" | "emails" | "marketplace" | "licence" | "updates" | "setup" | "dashboard" | "gateways" | "import" | "accounts" | "domains" | "reports" | "network";
export interface Screen { name: ScreenName; id?: string; tab?: string }
// browse opens a full address in the Browser, such as the vendor's My account.
export interface ScreenProps { game: GameState; go: (s: Screen) => void; toClient?: (customerId: string) => void; browse?: (url: string) => void }

const NAMES: ScreenName[] = ["home", "products", "product", "settings", "servers", "orders", "order", "service", "clients", "client", "invoices", "quotes", "emails", "marketplace", "licence", "updates", "setup", "dashboard", "gateways", "import", "accounts", "domains", "reports", "network"];

export const screenOf = (q: URLSearchParams): Screen => {
  const name = q.get("s") as ScreenName;
  return { name: NAMES.includes(name) ? name : "home", id: q.get("id") ?? undefined, tab: q.get("tab") ?? undefined };
};

export const screenArgs = ({ name, id, tab }: Screen): Record<string, string> => ({ s: name, ...(id && { id }), ...(tab && { tab }) });

// The menu entry a detail screen sits under.
const PARENT = { product: "products", client: "clients", order: "orders", service: "clients", setup: "settings", dashboard: "home", accounts: "clients", domains: "clients", reports: "invoices", network: "servers", gateways: "settings", import: "settings" } as const;
export type NavName = Exclude<ScreenName, keyof typeof PARENT>;
export const navOf = (name: ScreenName): NavName => (name in PARENT ? PARENT[name as keyof typeof PARENT] : (name as NavName));
