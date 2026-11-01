// economy.md, Pleskit banned IPs: the Fail2ban jail turns away scanner addresses and now and then locks a customer out.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";
import { accountsOf } from "./webpanel";

export interface Ban { ip: string; at: number; until: number; kind: "scanner" | "customer"; serviceId?: string }
export interface HostBans { jail: boolean; trusted: string[]; list: Ban[]; failed: number }
export const newHostBans = (): HostBans => ({ jail: true, trusted: [], list: [], failed: 0 });

export const FAIL2BAN_FROM = 2014;
export const SCANNERS_PER_DAY = 3;
export const SCANNER_BAN_HOURS = 7 * 24;
export const CUSTOMER_BAN_HOURS = 24;
// Share of the exposure roll that gets through while the jail is on.
export const JAIL_FACTOR = 0.75;
// A customer is locked out with 0.5% per 10 accounts a day, at most 8%.
export const LOCKOUT_PER_10 = 0.005;
export const LOCKOUT_MAX = 0.08;
export const BAN_MINUTES = 5;

export const isPleskit = (c: Cluster | undefined): c is Cluster => !!c && c.kind === "panel" && c.panel === "pleskit";
export const jailOn = (s: GameState, hostId: string): boolean => !!s.webpanel.bans[hostId]?.jail;
export const jailFactor = (s: GameState, hostId: string): number => (jailOn(s, hostId) ? JAIL_FACTOR : 1);

const idNum = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const ipFrom = (...xs: number[]): string => { const r = hashRng(...xs); return [0, 0, 0, 0].map((_, i) => (i ? Math.floor(rand(r) * 256) : 1 + Math.floor(rand(r) * 222))).join("."); };
// The address a customer's account connects from.
export const customerIp = (s: GameState, serviceId: string): string => ipFrom(s.seed, idNum(serviceId), 321);

export function setBans(s: GameState, hostId: string, patch: Partial<HostBans>): void {
  s.webpanel = { ...s.webpanel, bans: { ...s.webpanel.bans, [hostId]: { ...(s.webpanel.bans[hostId] ?? newHostBans()), ...patch } } };
}

// Daily from 2014 on every Pleskit host: expired bans lapse, scanners knock, and a customer is sometimes locked out.
export function bansTick(s: GameState): void {
  if (s.hour % 24 !== 0 || yearOf(s.hour) < FAIL2BAN_FROM) return;
  const hosts = s.clusters.filter(isPleskit), ids = new Set(hosts.map((c) => c.id));
  if (Object.keys(s.webpanel.bans).some((id) => !ids.has(id))) s.webpanel = { ...s.webpanel, bans: Object.fromEntries(Object.entries(s.webpanel.bans).filter(([id]) => ids.has(id))) };
  const day = s.hour / 24;
  for (const c of hosts) {
    if (!s.webpanel.bans[c.id]) setBans(s, c.id, {});
    const b = s.webpanel.bans[c.id], list = b.list.filter((x) => x.until > s.hour);
    if (!b.jail) { setBans(s, c.id, { list, failed: b.failed + SCANNERS_PER_DAY * 3 }); continue; }
    for (let i = 0; i < SCANNERS_PER_DAY; i++) list.push({ ip: ipFrom(s.seed, idNum(c.id), day, i, 322), at: s.hour, until: s.hour + SCANNER_BAN_HOURS, kind: "scanner" });
    const accounts = accountsOf(s, c.id);
    const r = hashRng(s.seed, idNum(c.id), day, 323);
    if (accounts.length && rand(r) < Math.min(LOCKOUT_MAX, (accounts.length / 10) * LOCKOUT_PER_10)) {
      const v = accounts[Math.floor(rand(r) * accounts.length)], ip = customerIp(s, v.id);
      const cust = s.customers.find((x) => x.id === v.customerId);
      if (cust && !b.trusted.includes(ip) && !list.some((x) => x.serviceId === v.id)) {
        list.push({ ip, at: s.hour, until: s.hour + CUSTOMER_BAN_HOURS, kind: "customer", serviceId: v.id });
        if (!s.tickets.some((t) => t.serviceId === v.id && t.topic === "lockedOut" && !isFinal(t))) createTicket(s, cust, "howTo", v.id, "lockedOut");
      }
    }
    setBans(s, c.id, { list });
  }
}
