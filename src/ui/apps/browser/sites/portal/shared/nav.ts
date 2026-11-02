import type { GameState } from "../../../../../../sim/50-state";

export type ScreenName = "home" | "products" | "product" | "options" | "servers" | "orders" | "clients" | "client" | "invoices" | "licence" | "updates";
export interface Screen { name: ScreenName; id?: string; tab?: string }
// browse opens a full address in the Browser, such as the vendor's My account.
export interface ScreenProps { game: GameState; go: (s: Screen) => void; toClient?: (customerId: string) => void; browse?: (url: string) => void }

const NAMES: ScreenName[] = ["home", "products", "product", "options", "servers", "orders", "clients", "client", "invoices", "licence", "updates"];

export const screenOf = (q: URLSearchParams): Screen => {
  const name = q.get("s") as ScreenName;
  return { name: NAMES.includes(name) ? name : "home", id: q.get("id") ?? undefined, tab: q.get("tab") ?? undefined };
};

export const screenArgs = ({ name, id, tab }: Screen): Record<string, string> => ({ s: name, ...(id && { id }), ...(tab && { tab }) });
