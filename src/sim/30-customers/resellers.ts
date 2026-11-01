import { yearOf } from "../00-core/time";
import { chance } from "../00-core/rng";
import { marketRates } from "../10-catalog/products";
import type { GameState } from "../50-state";
import type { Service } from "./customers";

// economy.md, Resellers: a reseller books a block of accounts in full and fills it over months with their own customers.
export interface Reseller { accounts: number; fillRate: number; startedAt: number }

export const FILL_MAX = 0.7;
export const FILL_MONTHS = 6;
export const HOURS_PER_MONTH = 730;
// The share of the filled accounts' abuse reports the reseller handles before they reach the player.
export const RESELLER_HANDLES = 0.5;
export const SHADY_PER_MONTH = 0.02;
export const FIRST_LEAD_YEAR = 2008;
export const LEAD_SHARE = 0.03;

const RESELLER_PANELS = ["directadmen", "cpanic"];

// A cheaper block fills faster: the months scale with the price per account against the market's, between half and all.
export function fillMonths(v: Service): number {
  const accounts = v.spec.accounts || 1, month = v.period === "hour" ? v.price * HOURS_PER_MONTH : v.price / 12;
  const market = marketRates("reseller", yearOf(v.startedAt)).account ?? 0;
  return FILL_MONTHS * (market > 0 ? Math.min(1, Math.max(0.5, month / accounts / market)) : 1);
}

export const fillAt = (v: Service, hour: number): number =>
  Math.min(FILL_MAX, (FILL_MAX * Math.max(0, hour - v.startedAt)) / (fillMonths(v) * HOURS_PER_MONTH));

// The filled share of a reseller service, 1 for every other service.
export function fillOf(s: GameState, serviceId: string): number {
  const v = s.services.find((x) => x.id === serviceId);
  if (!v || v.product !== "reseller") return 1;
  return s.webpanel.resellers[v.customerId]?.fillRate ?? 0;
}

// Abuse reports of a reseller's customer come in at the rate of the filled accounts, half of them handled by the reseller.
export function resellerAbuse(s: GameState, customerId: string): number {
  const r = s.webpanel.resellers[customerId];
  return r ? r.accounts * r.fillRate * (1 - RESELLER_HANDLES) : 1;
}

// Leads write once resellers exist in the game's era and a DirectAdmen or cPanic host can carry them.
export const resellerLeadsOpen = (s: GameState): boolean =>
  yearOf(s.hour) >= FIRST_LEAD_YEAR && s.clusters.some((c) => c.kind === "panel" && RESELLER_PANELS.includes(c.panel ?? ""));

// Daily: keep one record per live reseller block, advance its fill and roll the monthly chance of a shady account.
export function resellerTick(s: GameState): void {
  const live = s.services.filter((v) => v.product === "reseller" && v.endedAt === null);
  const next: Record<string, Reseller> = {};
  for (const v of live) {
    const old = s.webpanel.resellers[v.customerId], accounts = v.spec.accounts ?? 0;
    next[v.customerId] = { accounts, startedAt: old?.startedAt ?? v.startedAt, fillRate: fillAt(v, s.hour) };
    const c = s.customers.find((x) => x.id === v.customerId);
    if (c && !c.shady && chance(s.rng, SHADY_PER_MONTH / 30)) s.customers = s.customers.map((x) => (x.id === c.id ? { ...x, shady: true } : x));
  }
  if (JSON.stringify(next) !== JSON.stringify(s.webpanel.resellers)) s.webpanel = { ...s.webpanel, resellers: next };
}

// The live reseller blocks that run on a panel host.
export function resellersOn(s: GameState, hostId: string): Service[] {
  const ids = new Set(s.workloads.filter((w) => w.clusterId === hostId && w.serviceId).map((w) => w.serviceId));
  return s.services.filter((v) => v.product === "reseller" && v.endedAt === null && ids.has(v.id));
}

// The end users a reseller has so far: a count from the fill and names drawn from the seed.
const WORDS = ["garden", "bakery", "studio", "photo", "garage", "blog", "club", "music", "pets", "travel", "books", "sport"];
export function endUsers(s: GameState, v: Service): { user: string; domain: string; diskGb: number }[] {
  const r = s.webpanel.resellers[v.customerId], n = r ? Math.round(r.accounts * r.fillRate) : 0;
  const share = n ? (v.spec.diskGb * (r?.fillRate ?? 0)) / n : 0;
  return Array.from({ length: n }, (_, i) => ({ user: `user${i + 1}`, domain: `${WORDS[(s.seed + i * 7) % WORDS.length]}${i + 1}.com`, diskGb: share }));
}
