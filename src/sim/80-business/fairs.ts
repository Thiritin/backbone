// Values from docs/design/economy.md, "Trade fairs".
import { hourOf, yearOf } from "../00-core/time";
import { priceAt } from "../10-catalog/economy";
import type { Profile } from "../30-customers/customers";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { addGoodwill } from "../60-infra/network";

// cost: 2026 euros, scaled back with m = 0.6. bonus: the network contacts gained, 0 to 1. until: the last year it runs.
export interface Fair {
  id: string; name: string; city: string; month: number; day: number; days: number; level: number;
  cost: number; leads: number; profiles: Profile[]; bonus: number; until?: number;
}

export const FAIRS: Fair[] = [
  { id: "seebit", name: "SeeBIT", city: "Hanover", month: 3, day: 6, days: 5, level: 3, cost: 8000, leads: 15, profiles: ["soleProp", "smallBiz", "office"], bonus: 0.1, until: 2018 },
  { id: "cloudFeast", name: "CloudFeast", city: "Rust", month: 3, day: 23, days: 3, level: 4, cost: 20000, leads: 40, profiles: ["agency", "onlineShop", "enterprise"], bonus: 0.2 },
  { id: "ripeish", name: "RIPE-ish Meeting", city: "Amsterdam", month: 5, day: 18, days: 5, level: 3, cost: 3000, leads: 0, profiles: [], bonus: 0.4 },
  { id: "deSix", name: "DE-SIX Summit", city: "Frankfurt", month: 10, day: 7, days: 1, level: 4, cost: 5000, leads: 5, profiles: ["enterprise"], bonus: 0.5 },
  { id: "dcWhirled", name: "Data Centre Whirled", city: "Frankfurt", month: 11, day: 12, days: 2, level: 5, cost: 35000, leads: 60, profiles: ["enterprise", "office", "onlineShop"], bonus: 0.2 },
];

// attended is null until the fair ends; leads are what the attendee brought back.
export interface FairBooking { fair: string; year: number; employeeId: string; start: number; end: number; attended: boolean | null; leads: number }

const MONTH = 730, YEAR = 8760;
export const FAIR_CONVERSION = 1.5;
export const FAIR_AWARENESS = 0.03;
// A marketing manager trained on fairs brings back half again as many leads.
export const FAIR_MANAGER_LEADS = 1.5;

export const fairById = (id: string): Fair | undefined => FAIRS.find((f) => f.id === id);
export const fairStart = (f: Fair, year: number): number => hourOf(new Date(Date.UTC(year, f.month - 1, f.day)));
export const fairCost = (f: Fair, year: number): number => Math.round(priceAt(f.cost, 0.6, year));

export interface FairDate { fair: Fair; year: number; start: number; end: number; booking: FairBooking | undefined }

// The next run of every fair that has not ended yet, in date order.
export function upcomingFairs(s: GameState): FairDate[] {
  return FAIRS.flatMap((fair) => {
    let year = yearOf(s.hour);
    if (fairStart(fair, year) + fair.days * 24 <= s.hour) year++;
    if (fair.until && year > fair.until) return [];
    const start = fairStart(fair, year);
    return [{ fair, year, start, end: start + fair.days * 24, booking: s.fairs.find((b) => b.fair === fair.id && b.year === year) }];
  }).sort((a, b) => a.start - b.start);
}

const attended = (s: GameState): { b: FairBooking; f: Fair }[] =>
  s.fairs.filter((b) => b.attended).map((b) => ({ b, f: fairById(b.fair)! }));

// Better transit prices and peering acceptance from fairs in the last 12 months, fading linearly; read by the network code.
export const tradeFairBonus = (s: GameState): number =>
  Math.min(1, attended(s).filter(({ b }) => b.end <= s.hour && s.hour - b.end < YEAR).reduce((n, { b, f }) => n + f.bonus * (1 - (s.hour - b.end) / YEAR), 0));

// Leads from a fair count in the month after it, split evenly over the location cities and the fair's audiences.
export function fairBatches(s: GameState, cities: string[]) {
  return attended(s).filter(({ b, f }) => b.leads > 0 && f.profiles.length && b.end <= s.hour && s.hour - b.end < MONTH)
    .flatMap(({ b, f }) => cities.flatMap((city) => f.profiles.map((profile) => ({
      profile, city, source: "fair" as const, count: b.leads / cities.length / f.profiles.length, conversion: FAIR_CONVERSION,
    }))));
}

// Awareness gain at a month start for fairs that ended in the month before.
export const fairGain = (s: GameState, p: Profile): number =>
  attended(s).filter(({ b, f }) => f.profiles.includes(p) && b.end <= s.hour && s.hour - b.end < MONTH).length * FAIR_AWARENESS;

export function fairsTick(s: GameState): SimEvent[] {
  if (!s.fairs.some((b) => b.attended === null && b.end <= s.hour)) return [];
  const events: SimEvent[] = [];
  s.fairs = s.fairs.map((b) => {
    if (b.attended !== null || b.end > s.hour) return b;
    const f = fairById(b.fair)!, e = s.staff.find((x) => x.id === b.employeeId);
    if (!e) {
      events.push({ app: "Marketing", key: "event.fairMissed", params: { fair: f.name } });
      return { ...b, attended: false, leads: 0 };
    }
    const leads = Math.round(f.leads * (e.role === "marketing" && e.trained.includes("fairs") ? FAIR_MANAGER_LEADS : 1));
    events.push({ app: "Marketing", key: "event.fairDone", params: { name: e.name, fair: f.name, leads } });
    addGoodwill(s, f.bonus);
    return { ...b, attended: true, leads };
  });
  return events;
}
