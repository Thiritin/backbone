// The company website: every company has one, and it lists the product lines the player switched on. Leads only write
// about listed lines; gdd.md, "Where requests come from".
import { yearOf } from "../00-core/time";
import { sizeSpec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { Product } from "../30-customers/customers";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { lineOffered, noRoomError } from "../60-infra/cluster";
import { hasOrderForm } from "./marketing";

export const SITE_LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation"];

export const listed = (s: GameState, p: Product): boolean => s.marketing.lines.includes(p);

// The error key for why a line cannot go on the website, or null when it can.
export const lineBlocker = (s: GameState, p: Product): string | null =>
  lineOffered(s, p) ? null : noRoomError(s, p);

// Saves from before the website list every line they could sell.
export const fillLines = (s: GameState, saved: Product[] | undefined): GameState =>
  saved ? s : { ...s, marketing: { ...s.marketing, lines: SITE_LINES.filter((p) => lineOffered(s, p)) } };

// What the website shows: each listed line, with its price from the line's smallest size at the player's rates once the
// order form takes orders, and the order address while orders still come by email.
export const siteContent = (s: GameState): { lines: { product: Product; from: number | null }[]; email: string | null } => ({
  lines: SITE_LINES.filter((p) => listed(s, p)).map((p) => ({ product: p, from: hasOrderForm(s) ? offerPrice(s, p, sizeSpec(p, 0, yearOf(s.hour))) : null })),
  email: s.marketing.emailOrders ? `sales@${companyDomain(s)}` : null,
});
