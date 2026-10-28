// Values come from docs/design/economy.md (Leasing).
import { hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import type { GameState } from "../50-state";

export interface Lessor { id: string; name: string }
export const LESSORS: Lessor[] = [
  { id: "grenkel", name: "Grenkel Leasing" },
  { id: "leasling", name: "Deutsche Leasling" },
  { id: "parasol", name: "BNP Parasol Leasing" },
];
export const lessorName = (id: string): string => LESSORS.find((l) => l.id === id)?.name ?? id;
export interface LeaseOffer { id: string; lessor: string; months: 12 | 24 | 36; monthly: number; total: number }

export const LEASE_FACTOR = { min: 1.06, max: 1.4 } as const;
export const LEASE_TERMS = [12, 24, 36] as const;

export const monthIndex = (hour: number): number => {
  const d = dateOf(hour);
  return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth();
};

// A fresh generator per seed, month, amount and lessor, so offers hold for the month and never touch s.rng.
function draw(...xs: number[]) {
  const r = hashRng(...xs);
  return () => rand(r);
}

export function leaseOffers(s: GameState, amount: number): LeaseOffer[] {
  const month = monthIndex(s.hour), amountCents = Math.round(amount * 100);
  return LESSORS.map((l, i) => {
    const next = draw(s.seed, month, amountCents, i);
    const factor = LEASE_FACTOR.min + next() * (LEASE_FACTOR.max - LEASE_FACTOR.min);
    const months = LEASE_TERMS[Math.floor(next() * LEASE_TERMS.length)];
    const monthly = Math.round((amount * factor * 100) / months) / 100;
    return { id: `${l.id}-${month}-${amountCents}`, lessor: l.id, months, monthly, total: Math.round(monthly * months * 100) / 100 };
  });
}
