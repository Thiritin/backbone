// GDD, Domains: domains registered or transferred for customers, renewed yearly at the registry of their TLD.
// Numbers in economy.md, Domains.
import { nowMinutes } from "../00-core/time";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import type { Service } from "./customers";

// transfer marks a domain the customer owned before; lapsed is set once it expired without a renewal. The company's own domain has no customer.
// readyAt is the game minute the registry answers; saves from before it have none and count as ready.
export interface Domain { name: string; customerId: string | null; registeredAt: number; expiresAt: number; transfer: boolean; lapsed: boolean; readyAt?: number }
export const REGISTER_MINUTES = 2;
export const registering = (s: GameState, d: Domain): boolean => (d.readyAt ?? 0) > nowMinutes(s);

export const YEAR = 8760, DAY = 24;
// What the registry charges per year, in 2005 and from 2026 on; linear in between.
export const REGISTRIES: Record<string, { name: string; cost: [number, number] }> = {
  de: { name: "DENIQ", cost: [12, 6] },
  at: { name: "nick.at", cost: [25, 12] },
  ch: { name: "SWISCH", cost: [15, 9] },
  "co.uk": { name: "Nominot", cost: [8, 7] },
  fr: { name: "AFNIQUE", cost: [20, 9] },
  nl: { name: "SIDNey", cost: [10, 6] },
  it: { name: "Registrato.it", cost: [15, 8] },
  com: { name: "VeriSigh", cost: [6, 9] },
};
// What the customer pays: a yearly fee for a new or renewed domain, a one-off fee for a transfer (its first year included).
export const DOMAIN_FEE = 15;
export const TRANSFER_FEE = 5;
export const EXPIRY_NOTICE_DAYS = 30;

export const tldOf = (name: string): string => Object.keys(REGISTRIES).find((t) => name.endsWith(`.${t}`)) ?? "de";
export const registryOf = (name: string) => REGISTRIES[tldOf(name)];
export function registryCost(name: string, year: number): number {
  const [a, b] = registryOf(name).cost, k = Math.min(1, Math.max(0, (year - 2005) / 21));
  return Math.round((a + (b - a) * k) * 100) / 100;
}

export const domainOf = (s: GameState, name: string): Domain | undefined => s.domains.find((d) => d.name === name);

// Records the domain for a year; the registrar bills its registry cost monthly (30-customers/registrar.ts).
export function register(s: GameState, name: string, customerId: string | null, transfer: boolean): void {
  const d: Domain = { name, customerId, registeredAt: s.hour, expiresAt: s.hour + YEAR, transfer, lapsed: false, readyAt: nowMinutes(s) + REGISTER_MINUTES };
  s.domains = [...s.domains.filter((x) => x.name !== name), d];
}

// Another year, counted from the expiry date or from now when it has lapsed.
export function extend(s: GameState, name: string): void {
  s.domains = s.domains.map((x) => (x.name === name ? { ...x, expiresAt: Math.max(x.expiresAt, s.hour) + YEAR, lapsed: false } : x));
}

// A web site is unreachable while the domain it runs on has expired.
export const domainDown = (s: GameState, v: Service): boolean => !!v.domain && (s.domains ?? []).some((d) => d.name === v.domain && s.hour >= d.expiresAt);

// Daily: a reminder a month before a domain of an active customer expires, and a notice when it lapses.
export function domainsTick(s: GameState): SimEvent[] {
  if (s.hour % DAY || !s.domains.length) return [];
  const events: SimEvent[] = [], active = new Set(s.customers.filter((c) => c.churnedAt === null).map((c) => c.id));
  let lapsed = false;
  for (const d of s.domains) {
    if (!d.customerId || !active.has(d.customerId)) continue;
    const left = d.expiresAt - s.hour;
    if (left <= EXPIRY_NOTICE_DAYS * DAY && left > (EXPIRY_NOTICE_DAYS - 1) * DAY) events.push({ app: "Books", key: "event.domainExpiring", params: { domain: d.name, days: EXPIRY_NOTICE_DAYS } });
    if (!d.lapsed && s.hour >= d.expiresAt) {
      lapsed = true;
      events.push({ app: "Books", key: "event.domainExpired", params: { domain: d.name } });
    }
  }
  if (lapsed) s.domains = s.domains.map((d) => (!d.lapsed && s.hour >= d.expiresAt && d.customerId !== null && active.has(d.customerId) ? { ...d, lapsed: true } : d));
  return events;
}
