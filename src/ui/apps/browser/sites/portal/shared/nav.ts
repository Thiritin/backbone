import type { GameState } from "../../../../../../sim/50-state";

export type ScreenName = "home" | "products" | "product" | "options" | "servers" | "orders" | "clients" | "client" | "invoices";
export interface Screen { name: ScreenName; id?: string; tab?: string }
export interface ScreenProps { game: GameState; go: (s: Screen) => void; toClient: (customerId: string) => void }

const NAMES: ScreenName[] = ["home", "products", "product", "options", "servers", "orders", "clients", "client", "invoices"];

export const screenOf = (q: URLSearchParams): Screen => {
  const name = q.get("s") as ScreenName;
  return { name: NAMES.includes(name) ? name : "home", id: q.get("id") ?? undefined, tab: q.get("tab") ?? undefined };
};

export const screenArgs = ({ name, id, tab }: Screen): Record<string, string> => ({ s: name, ...(id && { id }), ...(tab && { tab }) });
