// The company website: every company has one, and it lists the product lines the player switched on. Leads only write
// about listed lines; gdd.md, "Where requests come from".
import { kindServing } from "../10-catalog/platforms";
import { PRODUCTS } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { lineOffered } from "../60-infra/cluster";

export const SITE_LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "dedicated", "colocation"];

export const listed = (s: GameState, p: Product): boolean => s.marketing.lines.includes(p);

// The error key for why a line cannot go on the website, or null when it can.
export const lineBlocker = (s: GameState, p: Product): string | null =>
  lineOffered(s, p) ? null : PRODUCTS[p].ha ? "error.needsHaCluster" : kindServing(p) === "panel" ? "error.needsPanel" : "error.needsPlatform";

// Saves from before the website list every line they could sell.
export const fillLines = (s: GameState, saved: Product[] | undefined): GameState =>
  saved ? s : { ...s, marketing: { ...s.marketing, lines: SITE_LINES.filter((p) => lineOffered(s, p)) } };
