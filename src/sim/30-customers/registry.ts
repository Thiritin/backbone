// GDD, Domains: domains registered or transferred for customers, renewed yearly at the registry of their TLD.
// Numbers in economy.md, Domains.
import { hashRng, rand } from "../00-core/rng";
import { hourOf, nowMinutes } from "../00-core/time";
import { marketRates } from "../10-catalog/products";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import type { Service } from "./customers";
import { sweepGroups } from "../60-infra/status";
import { registrarById, registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { companyDomain } from "./domains";

// transfer marks a domain the customer owned before; lapsed is set once it expired without a renewal or left for another
// registrar, and the partner no longer holds it. The company's own domain has no customer.
// readyAt is the game minute the registry answers; saves from before it have none and count as ready.
// cancelled stops the renewal at the partner, leavesAt is the hour a domain transferred out is gone, code its auth code.
// ns picks the name servers (nsHosts with custom); a change answers from nsReadyAt, nsPrev until then.
export interface Domain {
  name: string; customerId: string | null; registeredAt: number; expiresAt: number; transfer: boolean; lapsed: boolean; readyAt?: number;
  cancelled?: boolean; leavesAt?: number; code?: string;
  ns: NameServerMode; nsHosts?: [string, string]; nsReadyAt?: number; nsPrev?: { ns: NameServerMode; nsHosts?: [string, string] };
}
export type NameServerMode = "registrar" | "company" | "custom";
export const NS_MINUTES = 60;
export const nsPropagating = (s: GameState, d: Domain): boolean => (d.nsReadyAt ?? 0) > nowMinutes(s);
// The name servers the domain answers with now.
export const nsActive = (s: GameState, d: Domain): { ns: NameServerMode; nsHosts?: [string, string] } => (nsPropagating(s, d) && d.nsPrev) || d;
export function nameServers(s: GameState, d: Domain): [string, string] {
  const a = nsActive(s, d);
  if (a.ns === "custom" && a.nsHosts) return a.nsHosts;
  const host = a.ns === "registrar" ? registrarHost((s.registrar && registrarById(s.registrar.id)) || REGISTRARS[0]) : companyDomain(s);
  return [`ns1.${host}`, `ns2.${host}`];
}
export const parked = (s: GameState, d: Domain): boolean => nsActive(s, d).ns !== "company";
export type DomainStatus = "active" | "transfer" | "cancelled" | "gone";
export const domainStatus = (d: Domain): DomainStatus => (d.lapsed ? "gone" : d.leavesAt !== undefined ? "transfer" : d.cancelled ? "cancelled" : "active");
// The domains the partner holds and bills.
export const heldDomains = (s: GameState): Domain[] => s.domains.filter((d) => !d.lapsed);
export const REGISTER_MINUTES = 2;
export const registering = (s: GameState, d: Domain): boolean => (d.readyAt ?? 0) > nowMinutes(s);

export const YEAR = 8760, DAY = 24;
// What the registry charges per year, in 2005 and from 2026 on; linear in between. A registry with steps charges the last
// step's price that has taken effect instead, [year, month 1 to 12, euros]; it announces each one NOTICE_MONTHS before.
export const REGISTRIES: Record<string, { name: string; cost: [number, number]; steps?: [number, number, number][] }> = {
  de: { name: "DENIQ", cost: [12, 6] },
  at: { name: "nick.at", cost: [25, 12] },
  ch: { name: "SWISCH", cost: [15, 9] },
  "co.uk": { name: "Nominot", cost: [8, 7] },
  fr: { name: "AFNIQUE", cost: [20, 9] },
  nl: { name: "SIDNey", cost: [10, 6] },
  it: { name: "Registrato.it", cost: [15, 8] },
  com: { name: "VeriSigh", cost: [6, 9], steps: [[2005, 1, 6], [2007, 10, 6.42], [2008, 10, 6.86], [2010, 7, 7.34], [2012, 1, 7.85], [2021, 9, 8.39], [2022, 9, 8.97], [2023, 9, 9.59], [2024, 9, 10.26]] },
};
// What the customer pays: the market's yearly domain price for a new or renewed domain, a one-off fee for a transfer (its first year included).
export const domainFee = (year: number): number => Math.round((marketRates("domain", year).base ?? 0) * 100) / 100;
export const REGISTRY_NOTICE_MONTHS = 6;
export const stepAt = (step: [number, number, number]): number => hourOf(new Date(Date.UTC(step[0], step[1] - 1, 1)));
export const TRANSFER_FEE = 5;
export const EXPIRY_NOTICE_DAYS = 30;

export const tldOf = (name: string): string => Object.keys(REGISTRIES).find((t) => name.endsWith(`.${t}`)) ?? "de";
export const registryOf = (name: string) => REGISTRIES[tldOf(name)];
export function registryCost(name: string, year: number, month = 0): number {
  const steps = registryOf(name).steps?.filter(([y, m]) => y < year || (y === year && m <= month + 1));
  if (steps?.length) return steps[steps.length - 1][2];
  const [a, b] = registryOf(name).cost, k = Math.min(1, Math.max(0, (year - 2005) / 21));
  return Math.round((a + (b - a) * k) * 100) / 100;
}

export const domainOf = (s: GameState, name: string): Domain | undefined => s.domains.find((d) => d.name === name);

// The transfer code the old registrar gave a customer who owns their domain; the order email quotes it.
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeFrom = (rng: ReturnType<typeof hashRng>): string => Array.from({ length: 8 }, () => CODE[Math.floor(rand(rng) * CODE.length)]).join("");
export const authCode = (seed: number, requestId: string): string => codeFrom(hashRng(seed, Number(requestId.slice(3)) || 0, 281));
// The code the partner gives out to transfer one of the player's domains away.
export const outCode = (seed: number, name: string): string => codeFrom(hashRng(seed, ...[...name].map((ch) => ch.charCodeAt(0)), 283));

// Records the domain for a year; the registrar bills its registry cost monthly (30-customers/registrar.ts).
export function register(s: GameState, name: string, customerId: string | null, transfer: boolean): void {
  const d: Domain = { name, customerId, registeredAt: s.hour, expiresAt: s.hour + YEAR, transfer, lapsed: false, readyAt: nowMinutes(s) + REGISTER_MINUTES, ns: "company" };
  s.domains = [...s.domains.filter((x) => x.name !== name), d];
}

// Another year, counted from the expiry date or from now when it has lapsed; the partner renews it again.
export function extend(s: GameState, name: string): void {
  s.domains = s.domains.map((x) => (x.name === name ? { ...x, expiresAt: Math.max(x.expiresAt, s.hour) + YEAR, lapsed: false, cancelled: undefined } : x));
}

// A web site is unreachable while the domain it runs on has expired.
export const domainDown = (s: GameState, v: Service): boolean => {
  if (!v.domain) return false;
  const expired = sweepGroups(s, "expiredDomains", () => (s.domains ?? []).filter((d) => s.hour >= d.expiresAt), (d) => d.name);
  return expired ? expired.has(v.domain) : (s.domains ?? []).some((d) => d.name === v.domain && s.hour >= d.expiresAt);
};

// Daily: a reminder a month before a domain of an active customer expires. The partner renews every domain on its last day
// unless it was cancelled, which lapses at expiry; a domain transferred out is gone on its day. While the partner holds the
// domains over an unpaid invoice, nothing renews or lapses.
export function domainsTick(s: GameState): SimEvent[] {
  if (s.hour % DAY || !s.domains.length) return [];
  const events: SimEvent[] = [], active = new Set(s.customers.filter((c) => c.churnedAt === null).map((c) => c.id));
  const hold = s.payables.some((p) => p.supplier === "registrar" && p.paidAt === null && p.consequence === "domains");
  const renew = new Set<string>(), gone = new Set<string>();
  for (const d of s.domains) {
    if (d.lapsed) continue;
    const mine = d.customerId !== null && active.has(d.customerId), left = d.expiresAt - s.hour;
    if (mine && left <= EXPIRY_NOTICE_DAYS * DAY && left > (EXPIRY_NOTICE_DAYS - 1) * DAY) events.push({ app: "Books", key: "event.domainExpiring", params: { domain: d.name, days: EXPIRY_NOTICE_DAYS } });
    if (d.leavesAt !== undefined) {
      if (s.hour >= d.leavesAt) gone.add(d.name);
    } else if (hold) continue;
    else if (!d.cancelled && left < DAY) renew.add(d.name);
    else if (left <= 0) {
      gone.add(d.name);
      if (mine) events.push({ app: "Books", key: "event.domainExpired", params: { domain: d.name } });
    }
  }
  if (renew.size || gone.size) s.domains = s.domains.map((d) => (renew.has(d.name) ? { ...d, expiresAt: d.expiresAt + YEAR } : gone.has(d.name) ? { ...d, lapsed: true } : d));
  return events;
}
