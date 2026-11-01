// Market research: demand and shares per city, lost-sale reasons and paid profile studies.
// Decisions are recorded in docs/design/economy.md, "Market research".
import { CHOICE_TAU, type Budget, type Competitor } from "../10-catalog/economy";
import type { Product, Profile } from "../30-customers/customers";
import { profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { PROFILE_IDS } from "../80-business/marketing";
import { yearOf } from "../00-core/time";
import { cityMarket, leadFlows, NEEDS, needsOf, openRivals, rivals, rivalValue, share } from "./market";

// A study by Gartnah reveals one profile; priced by its budget.
export const STUDY_COST: Record<Budget, number> = { low: 800, medium: 2000, high: 4000 };
export const studyCost = (p: Profile): number => STUDY_COST[profileStats(p).budget];
export const studied = (s: GameState, p: Profile): boolean => s.marketing.studies.includes(p);


const demanded = (): Product[] => [...new Set(PROFILE_IDS.flatMap((p) => NEEDS[p].map(([x]) => x)))];
const weight = (p: Profile, product: Product, year: number): number => needsOf(p, year).find(([x]) => x === product)?.[1] ?? 0;

export interface Demand { product: Product; buyers: number; you: number; rivals: { name: string; buyers: number }[] }

// Buyers a month for each product in a city, how many of them ask you and how the rest split over the competitors.
export function demand(s: GameState, city: string): Demand[] {
  const flows = leadFlows(s).filter((f) => f.city === city), market = cityMarket(city, s.hour);
  const player = (p: Profile, product: Product, w: number, total: number) => {
    const sh = share(s, p, product, city);
    return Math.min(total, flows.filter((f) => f.profile === p).reduce((n, f) => n + f.leads * w * Math.min(1, sh * f.conversion), 0));
  };
  return demanded().map((product) => {
    let buyers = 0, you = 0;
    const others = new Map<string, number>();
    for (const p of PROFILE_IDS) {
      const w = weight(p, product, yearOf(s.hour));
      if (!w) continue;
      const total = market * profileStats(p).mix * w;
      const mine = flows.some((f) => f.profile === p) ? player(p, product, w, total) : 0;
      const sellers = rivals(p, product, openRivals(s, city)), us = sellers.map((c) => Math.exp(rivalValue(p, c) / CHOICE_TAU)), sum = us.reduce((n, e) => n + e, 0);
      sellers.forEach((c, i) => others.set(c.name, (others.get(c.name) ?? 0) + ((total - mine) * us[i]) / sum));
      buyers += total;
      you += mine;
    }
    return { product, buyers, you, rivals: [...others].map(([name, n]) => ({ name, buyers: n })).sort((a, b) => b.buyers - a.buyers) };
  }).filter((d) => d.buyers > 0);
}

export interface LostGroup { reason: string; params: Record<string, string | number>; count: number; reference: number }

// Lost sales of the last months grouped by reason, most frequent first; reference sums their monthly market prices.
export function lostReasons(s: GameState, months: number): LostGroup[] {
  const groups = new Map<string, LostGroup>();
  for (const l of s.sales.lost) {
    if (s.hour - l.hour > months * 730) continue;
    const k = `${l.reason}|${JSON.stringify(l.params)}`, g = groups.get(k) ?? { reason: l.reason, params: l.params, count: 0, reference: 0 };
    groups.set(k, { ...g, count: g.count + 1, reference: g.reference + l.reference });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.reference - a.reference);
}

// The profiles a competitor sells to: those whose price cap it fits and, for a specialist, its targets.
export const segmentsOf = (c: Competitor): Profile[] =>
  PROFILE_IDS.filter((p) => c.priceFactor <= profileStats(p).cap && (!c.targets || c.targets.includes(profileStats(p).id)));
