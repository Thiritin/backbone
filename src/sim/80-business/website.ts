// The company website: every company has one, and it lists the product lines the player switched on. Leads only write
// about listed lines; gdd.md, "Where requests come from".
import { PRODUCTS } from "../10-catalog/products";
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

// A line sells packages once the order form is owned and the player switched them on; gdd.md, "Packages".
export const hasPackages = (s: GameState, p: Product): boolean => hasOrderForm(s) && s.marketing.packages.includes(p);

// What the website shows: each listed line with its package names (none before packages), and the order address
// while orders still come by email.
export const siteContent = (s: GameState): { lines: { product: Product; plans: string[] }[]; email: string | null } => ({
  lines: SITE_LINES.filter((p) => listed(s, p)).map((p) => ({ product: p, plans: hasPackages(s, p) ? PRODUCTS[p].plans.map((x) => x.name) : [] })),
  email: s.marketing.emailOrders ? `sales@${companyDomain(s)}` : null,
});

// Saves from before packages that own the order form sell packages on every listed line.
export const fillPackages = (s: GameState, saved: Product[] | undefined): GameState =>
  saved || !hasOrderForm(s) ? s : { ...s, marketing: { ...s.marketing, packages: [...s.marketing.lines] } };
