import { chance, hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { OFFER } from "../30-market/market";
import { serviceMarket } from "../30-market/spec";
import { bump, createTicket, isFinal, profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { activeServices, type Customer, type Service } from "./customers";

// economy.md, Price tolerance.
export const TOLERANCE = [0.9, 1.2] as const;
export const RAISE_PENALTY = 1, PAST_MAX_PENALTY = 2, CUT_BONUS = 0.2, CUT_MAX = 10;
export const LEAVE_SPAN = 0.3;
export const OVER_DRIFT = 0.1, PAST_MAX_DRIFT = 1;
export const COMPLAIN_FROM = 5, COMPLAIN_PER_PCT = 1 / 40, COMPLAIN_PAST_MAX = 0.5, COMPLAIN_MONTHLY = 0.5, COMPLAIN_MONTHLY_PAST_MAX = 0.3;

const idHash = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
// The customer's share of their profile's cap, fixed per game and customer.
export const tolerance = (s: GameState, c: Customer): number => TOLERANCE[0] + (TOLERANCE[1] - TOLERANCE[0]) * rand(hashRng(s.seed, idHash(c.id), 71));

// The monthly price a customer finds fair (the market, or their usual offer if higher) and the most they pay.
// They measure against the market of the year they signed when it was higher.
export function limits(s: GameState, c: Customer, v: Service): { fair: number; max: number } {
  const year = (h: number) => serviceMarket(v, yearOf(h));
  const market = Math.max(year(s.hour), year(v.startedAt)), p = profileStats(c.profile);
  return { fair: market * Math.max(1, OFFER[p.budget]), max: market * p.cap * tolerance(s, c) };
}

const pctOver = (price: number, limit: number) => Math.max(0, 100 * (price / limit - 1));
const hasOpen = (s: GameState, c: Customer, kind: "cancellation" | "billing", topic?: string) =>
  s.tickets.some((t) => t.customerId === c.id && t.kind === kind && (!topic || t.topic === topic) && !isFinal(t));

function complain(s: GameState, c: Customer, v: Service, p: number): void {
  if (!hasOpen(s, c, "billing", "price") && chance(s.rng, p)) createTicket(s, c, "billing", v.id, "price");
}

// A new monthly price for a running hourly service; before keeps the price from before the first of a run of raises.
// Changes the customer in place: actions work on a cloned state and the support tick on copies. A price the customer agreed to
// (an add-on they bought) changes the price alone.
export function reprice(s: GameState, v: Service, price: number, agreed = false): void {
  const cust = s.customers.find((x) => x.id === v.customerId)!;
  if (agreed) {
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: price / 730 } : x));
    return;
  }
  const old = v.price * 730, pct = (100 * (price - old)) / old, { max } = limits(s, cust, v);
  const before = price > old ? v.before ?? v.price : v.before !== undefined && price / 730 > v.before ? v.before : undefined;
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, price: price / 730, before } : x));
  if (pct <= 0) return bump(cust, Math.min(CUT_MAX, -CUT_BONUS * pct));
  bump(cust, -RAISE_PENALTY * pct - PAST_MAX_PENALTY * Math.max(0, pctOver(price, max) - pctOver(old, max)));
  if (price > max && chance(s.rng, Math.min(1, (price / max - 1) / LEAVE_SPAN))) {
    if (!hasOpen(s, cust, "cancellation")) createTicket(s, cust, "cancellation", v.id).topic = "price";
  } else if (pct >= COMPLAIN_FROM) complain(s, cust, v, Math.min(1, pct * COMPLAIN_PER_PCT + (price > max ? COMPLAIN_PAST_MAX : 0)));
}

// Monthly: an overpriced service wears happiness down, and a raised one may bring a complaint. Customers are copies.
export function overpricing(s: GameState): void {
  for (const c of s.customers) {
    if (c.churnedAt !== null) continue;
    let worst = 0;
    for (const v of activeServices(s.services, c.id)) {
      if (v.period !== "hour") continue;
      const price = v.price * 730, { fair, max } = limits(s, c, v);
      worst = Math.max(worst, OVER_DRIFT * pctOver(price, fair) + PAST_MAX_DRIFT * pctOver(price, max));
      if (v.before !== undefined && price > fair) complain(s, c, v, Math.min(1, COMPLAIN_MONTHLY * (price / fair - 1) + (price > max ? COMPLAIN_MONTHLY_PAST_MAX : 0)));
    }
    bump(c, -worst);
  }
}

// Puts the service back on its price from before the raises.
export function revertPrice(s: GameState, serviceId: string | null): void {
  const v = s.services.find((x) => x.id === serviceId);
  if (v?.before !== undefined && v.endedAt === null) reprice(s, v, v.before * 730);
}
