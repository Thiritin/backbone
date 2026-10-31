// Rivals: the competitors as companies that refresh hardware, have outages and win customers.
// Values and decisions are in docs/design/competitors.md.
import { chance, hashRng, rand } from "../00-core/rng";
import { dateOf, monthIndexOf, START_YEAR, yearOf } from "../00-core/time";
import { CHOICE_TAU, CITIES, COMPETITORS, GENERATIONS, generationAt, type Competitor, type Template } from "../10-catalog/economy";
import { profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { PROFILE_IDS } from "../80-business/marketing";
import type { NewsDef } from "../80-business/news";
import { cityMarket, needsOf, rivals, rivalValue } from "./market";

export interface Outage { months: number; hit: number }
export interface Rival extends Competitor {
  id: string;
  // Months since January 2005 when it opened; the majors count as -1.
  founded: number;
  // Months it takes to move to a new server generation.
  lag: number;
  outage: Outage | null;
  customers: Record<string, number>;
  closed: number | null;
}
// New customers a month per city, in CITIES order, for you and each rival by id.
export interface ShareEntry { month: number; you: number[]; rivals: Record<string, number[]> }

export const TEMPLATES = Object.fromEntries(COMPETITORS.map((c) => [c.template, c])) as Record<Template, Competitor>;
const OUTAGE_CHANCE: Partial<Record<Template, number>> = { premium: 0.01, budget: 0.03 };
const C_STEP: Partial<Record<Template, number>> = { budget: 4, managed: 4, premium: 3 };
// Control panels, one-click installs, managed WordPress, a customer API and AI assistants.
export const CONVENIENCE_YEARS = [2006, 2009, 2013, 2016, 2023];
export const CHURN = 0.015, OUTAGE_CHURN = 0.02, GEN_PENALTY = 7.5, SHARE_MONTHS = 60;

export const monthOf = (hour: number): number => monthIndexOf(hour) - START_YEAR * 12;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// New customers a month in a city for each rival when nobody else takes any.
function split(list: Rival[], city: string, hour: number): Map<string, number> {
  const out = new Map<string, number>(), market = cityMarket(city, hour);
  for (const p of PROFILE_IDS) {
    for (const [product, w] of needsOf(p, yearOf(hour))) {
      const sellers = rivals(p, product, list), us = sellers.map((c) => Math.exp(rivalValue(p, c) / CHOICE_TAU)), sum = us.reduce((n, e) => n + e, 0);
      sellers.forEach((c, i) => out.set(c.id, (out.get(c.id) ?? 0) + (market * profileStats(p).mix * w * us[i]) / sum));
    }
  }
  return out;
}

// The six majors, each starting with the customers its 2005 share holds at steady churn.
export function seedRivals(seed: number): Rival[] {
  const list: Rival[] = COMPETITORS.map((c, i) => ({ ...c, id: slug(c.name), founded: -1, lag: Math.floor(rand(hashRng(seed, 0x7a11, i)) * 19), outage: null, customers: {}, closed: null }));
  for (const city of CITIES) {
    const flows = split(list, city.name, 0);
    for (const r of list) r.customers[city.name] = Math.round((flows.get(r.id) ?? 0) / CHURN);
  }
  return list;
}

// One month of a rival's scores and price at the month that starts at hour; news is the outage it started, if any.
export function driftRival(r: Rival, i: number, seed: number, hour: number): { rival: Rival; news: { city: string; hours: number } | null } {
  const d = dateOf(hour), year = d.getUTCFullYear(), t = TEMPLATES[r.template];
  // Months since January of a year; a rival follows the market lag months after it moves.
  const since = (y: number) => (year - y) * 12 + d.getUTCMonth();
  const gen = generationAt(year);
  const rng = hashRng(seed, monthOf(hour), i);
  const next: Rival = { ...r, P: t.P - (gen > 0 && since(GENERATIONS[gen].year) < r.lag ? GEN_PENALTY : 0) };
  if (CONVENIENCE_YEARS.some((y) => since(y) === r.lag)) next.C = Math.min(95, r.C + (C_STEP[r.template] ?? 2));
  const cut = since(START_YEAR + 1) - r.lag;
  if (cut >= 0 && cut % 12 === 0) next.priceFactor = Math.max(round(t.priceFactor - 0.15), round(r.priceFactor * (r.template === "budget" ? 0.98 : 0.99)));
  if (r.outage) {
    const left = r.outage.months - 1;
    next.outage = left > 0 ? { ...r.outage, months: left } : null;
    if (!left) next.R = r.R + r.outage.hit;
    return { rival: next, news: null };
  }
  if (!chance(rng, OUTAGE_CHANCE[r.template] ?? 0.02)) return { rival: next, news: null };
  const hit = Math.round(10 + 15 * rand(rng)), months = 1 + Math.floor(3 * rand(rng));
  const cities = Object.keys(r.customers);
  const news = { city: cities[Math.floor(rand(rng) * cities.length)] ?? CITIES[0].name, hours: 2 + Math.floor(11 * rand(rng)) };
  return { rival: { ...next, R: r.R - hit, outage: { months, hit } }, news };
}

// A rival news id reads rival.<kind>.<rival id>.<month>.<params>.
export function rivalNews(s: GameState, id: string): NewsDef | undefined {
  const [, kind, rid, , ...rest] = id.split("."), r = s.competitors.find((x) => x.id === rid);
  if (!r) return undefined;
  if (kind === "outage") return { id, key: "event.news.rivalOutage", at: -1, params: { name: r.name, city: CITIES[Number(rest[0])]?.name ?? "", hours: Number(rest[1]) } };
  return undefined;
}
