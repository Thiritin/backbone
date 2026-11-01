// Values from docs/design/economy.md; section names are noted per block.
import { textFields } from "../00-core/text";
import type { Product } from "../30-customers/customers";
import type { Patience } from "../00-core/workhours";

export type Budget = "low" | "medium" | "high";
export type Skill = "low" | "medium" | "high";
export type ProductId = "web" | "vps";

export interface Profile {
  id: string;
  name: string;
  budget: Budget;
  skill: Skill;
  mix: number;
  wP: number;
  wR: number;
  wC: number;
  lambda: number;
  cap: number;
  churn: number;
  outagePenalty: number;
  waitPenalty: number;
  // How fast they expect a reply, and how long an outage goes unnoticed before it hurts and they write in.
  reply: Patience;
  tolerance: Patience;
  // Share of this profile's buyers who want a VPS rather than web hosting; an estimate, not in the doc.
  vpsShare: number;
}

const work = (hours: number): Patience => ({ hours, clock: "business" });
const always = (hours: number): Patience => ({ hours, clock: "always" });

// Market and leads (mix), Customer choice (weights), Happiness and churn (churn, penalties, response).
export const PROFILES: Profile[] = textFields("sim.profile", [
  { id: "private", name: "Private individual", budget: "low", skill: "low", mix: 0.25, wP: 0.2, wR: 0.2, wC: 0.6, lambda: 1.0, cap: 1.3, churn: 0.025, outagePenalty: 1, waitPenalty: 0.3, reply: work(16), tolerance: work(16), vpsShare: 0 },
  { id: "gamer", name: "Gamer", budget: "low", skill: "medium", mix: 0.15, wP: 0.5, wR: 0.3, wC: 0.2, lambda: 1.0, cap: 1.3, churn: 0.04, outagePenalty: 4, waitPenalty: 0.3, reply: work(8), tolerance: always(1), vpsShare: 0.8 },
  { id: "hobby", name: "Hobby developer", budget: "low", skill: "high", mix: 0.1, wP: 0.6, wR: 0.2, wC: 0.2, lambda: 1.2, cap: 1.3, churn: 0.03, outagePenalty: 2, waitPenalty: 0.3, reply: work(16), tolerance: work(16), vpsShare: 0.9 },
  { id: "sole", name: "Sole proprietor", budget: "medium", skill: "low", mix: 0.15, wP: 0.15, wR: 0.35, wC: 0.5, lambda: 0.6, cap: 1.6, churn: 0.012, outagePenalty: 2, waitPenalty: 0.6, reply: work(8), tolerance: work(3), vpsShare: 0.1 },
  { id: "small", name: "Small business", budget: "medium", skill: "medium", mix: 0.15, wP: 0.3, wR: 0.4, wC: 0.3, lambda: 0.6, cap: 1.6, churn: 0.01, outagePenalty: 3, waitPenalty: 0.6, reply: work(8), tolerance: work(2), vpsShare: 0.4 },
  { id: "agency", name: "Agency or startup", budget: "medium", skill: "high", mix: 0.08, wP: 0.5, wR: 0.35, wC: 0.15, lambda: 0.7, cap: 1.6, churn: 0.015, outagePenalty: 4, waitPenalty: 0.6, reply: work(8), tolerance: work(2), vpsShare: 0.7 },
  { id: "office", name: "Doctor's or law office", budget: "high", skill: "low", mix: 0.05, wP: 0.1, wR: 0.6, wC: 0.3, lambda: 0.3, cap: 2.5, churn: 0.006, outagePenalty: 8, waitPenalty: 1.5, reply: work(4), tolerance: work(1), vpsShare: 0.1 },
  { id: "shop", name: "Online shop", budget: "high", skill: "medium", mix: 0.05, wP: 0.3, wR: 0.55, wC: 0.15, lambda: 0.3, cap: 2.5, churn: 0.008, outagePenalty: 10, waitPenalty: 1.5, reply: always(4), tolerance: always(0), vpsShare: 0.5 },
  { id: "enterprise", name: "Enterprise", budget: "high", skill: "high", mix: 0.02, wP: 0.35, wR: 0.55, wC: 0.1, lambda: 0.25, cap: 2.5, churn: 0.004, outagePenalty: 15, waitPenalty: 1.5, reply: always(4), tolerance: always(0), vpsShare: 0.8 },
], ["name"]);

export type Template = "budget" | "wholesale" | "devCloud" | "premium" | "game" | "managed";

export interface Competitor {
  name: string;
  template: Template;
  priceFactor: number;
  P: number;
  R: number;
  C: number;
  // The products it sells; targets limits a specialist to those PROFILES ids.
  sells: Product[];
  targets?: string[];
}

const EVERYTHING: Product[] = ["webHosting", "domain", "ssl", "dns", "gameServer", "vps", "vpn", "dedicated", "storage", "cloud", "colocation", "gpu"];

// Customer choice, Competitors: the four archetypes plus two specialists (decision, recorded in economy.md).
export const COMPETITORS: Competitor[] = [
  { name: "Ionose", template: "budget", priceFactor: 0.8, P: 55, R: 60, C: 70, sells: ["webHosting", "domain", "ssl", "dns", "vps"] },
  { name: "OVHeat", template: "wholesale", priceFactor: 0.75, P: 70, R: 65, C: 50, sells: EVERYTHING },
  { name: "Hetzna", template: "devCloud", priceFactor: 0.7, P: 85, R: 70, C: 40, sells: ["vps", "dedicated", "storage", "cloud", "colocation", "gpu"] },
  { name: "Rackspice", template: "premium", priceFactor: 1.3, P: 80, R: 90, C: 75, sells: EVERYTHING },
  { name: "Nitradoh", template: "game", priceFactor: 0.9, P: 75, R: 60, C: 60, sells: ["gameServer"], targets: ["gamer"] },
  { name: "WP Engyne", template: "managed", priceFactor: 1.4, P: 70, R: 80, C: 85, sells: ["webHosting"], targets: ["sole", "small", "office", "agency"] },
];

export const CHOICE_TAU = 12;

// Market and leads, Market size: new customers per month in 2005, +8% a year.
export const CITIES = [
  { name: "Frankfurt", market: 1500 },
  { name: "London", market: 1500 },
  { name: "Paris", market: 1500 },
  { name: "Amsterdam", market: 1000 },
  { name: "Berlin", market: 1000 },
  { name: "Milan", market: 1000 },
  { name: "Vienna", market: 600 },
  { name: "Zurich", market: 600 },
  { name: "Düsseldorf", market: 800 },
  { name: "Kerkrade", market: 150 },
  { name: "Nuremberg", market: 400 },
  { name: "Falkenstein", market: 100 },
  { name: "Munich", market: 1000 },
  { name: "Ashburn", market: 600 },
  { name: "New York", market: 2000 },
  { name: "Chicago", market: 1200 },
  { name: "Dallas", market: 1000 },
  { name: "Los Angeles", market: 1500 },
];
export const MARKET_GROWTH = 0.08;
// Organic leads and referrals per city and profile are capped at a share of the city's new customers that grows with
// the company's level: 2.4% for a basement hoster, 6.4% at level 6 (economy.md, Market and leads).
export const LEAD_CAP_SHARE = 0.016;
export const leadCapShare = (level: number): number => LEAD_CAP_SHARE * (1 + 0.5 * level);

// Prices over time: p(y) = p2026 · m^((2026 − y) / 21), flat after 2026.
export const priceAt = (p2026: number, m: number, year: number): number =>
  p2026 * Math.pow(m, (2026 - Math.min(year, 2026)) / 21);

export const BUDGET_SIZE: Record<Budget, number> = { low: 1, medium: 2, high: 4 };

// Web hosting is fixed-price (m = 1); resold lines cost 40% of the base rate (Starting state).
export const WEB_BASE = 6;
export const RESOLD_COST_SHARE = 0.4;

// VPS: €1.50 per GB of RAM in 2026, m = 20. Plan RAM doubling every 7 years is an estimate.
export const vpsRatePerGb = (year: number): number => priceAt(1.5, 20, year);
export const vpsPlanGb = (year: number): number => Math.pow(2, (year - 2005) / 7);

// Hardware, Server generations.
export const GENERATIONS: { year: number; cores: number; ramGb: number; diskGb: number; disk: "HDD" | "SSD" | "NVMe"; watts: number; price: number }[] = [
  { year: 2005, cores: 2, ramGb: 8, diskGb: 500, disk: "HDD", watts: 250, price: 2500 },
  { year: 2008, cores: 8, ramGb: 24, diskGb: 1000, disk: "HDD", watts: 300, price: 3000 },
  { year: 2011, cores: 12, ramGb: 64, diskGb: 2000, disk: "HDD", watts: 300, price: 3500 },
  { year: 2014, cores: 24, ramGb: 128, diskGb: 2000, disk: "SSD", watts: 300, price: 4000 },
  { year: 2017, cores: 40, ramGb: 256, diskGb: 4000, disk: "SSD", watts: 350, price: 4500 },
  { year: 2020, cores: 64, ramGb: 512, diskGb: 8000, disk: "NVMe", watts: 400, price: 5000 },
  { year: 2023, cores: 128, ramGb: 1024, diskGb: 15000, disk: "NVMe", watts: 450, price: 5500 },
];
export const generationAt = (year: number): number => {
  let g = 0;
  GENERATIONS.forEach((gen, i) => {
    if (gen.year <= year) g = i;
  });
  return g;
};

export const BASEMENT_SLOTS = 4;

// Prices over time, keyframes: straight lines between [year, value] pairs, flat before the first and after the last.
export function keyframes(keys: [number, number][], year: number): number {
  const i = keys.findIndex(([y]) => y > year);
  if (i < 0) return keys[keys.length - 1][1];
  if (i === 0) return keys[0][1];
  const [y0, v0] = keys[i - 1], [y1, v1] = keys[i];
  return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
}

// Electricity keyframes in ct/kWh (business); the basement pays 1.6×.
const POWER_KEYS: [number, number][] = [[2005, 9], [2010, 12], [2014, 15], [2020, 18], [2022, 35], [2023, 25], [2026, 17]];
export const businessPowerPrice = (year: number): number => keyframes(POWER_KEYS, year) / 100;

export const SERVER_AFR = 0.08;
export const REPAIR_HOURS = 8;

// Tickets and work rates: tickets per customer per month by skill (how-to + billing + abuse).
export const TICKETS_PER_CUSTOMER: Record<Skill, number> = { low: 0.1125, medium: 0.0525, high: 0.03 };
export const TICKET_MINUTES = 19;
export const PAYMENT_MINUTES = 6;
export const UPGRADE_CHANCE: Record<Budget, number> = { low: 0.02, medium: 0.03, high: 0.04 };

// Staff work 8 h on about 210 days a year.
export const STAFF_HOURS_PER_MONTH = (8 * 210) / 12;
export const tasksPerHour = (minutes: number, skill: number): number => (60 / minutes) * (0.5 + skill / 100);

// Staff, Salary: role base 2026 gross per year, salary multiplier m = 0.6.
export const ROLE_BASE = { support: 42000, bookkeeper: 38300, accountant: 50000, marketing: 45300, technician: 47000 } as const;
export const monthlySalary = (role: keyof typeof ROLE_BASE, skill: number, year: number): number =>
  (priceAt(ROLE_BASE[role], 0.6, year) * 1.29 * (0.85 + 0.6 * (skill / 100))) / 12;

// Billing and payment habits: share of invoices paid on time.
export const ON_TIME: Record<Budget, number> = { low: 0.82, medium: 0.9, high: 0.65 };
export const NEVER_PAYS: Record<Budget, number> = { low: 0.02, medium: 0.01, high: 0 };

// Marketing: search ads per lead in 2026, m = 0.6.
export const SEARCH_AD_COST: Record<Budget, number> = { low: 15, medium: 35, high: 90 };

// Net worth and level thresholds.
export const LEVELS = [
  { level: 1, name: "Basement Hoster", netWorth: 0, years: 0 },
  { level: 2, name: "Garage Hero", netWorth: 15_000, years: 0 },
  { level: 3, name: "Rack Renter", netWorth: 100_000, years: 1 },
  { level: 4, name: "Cage Fighter", netWorth: 750_000, years: 3 },
  { level: 5, name: "Room Service", netWorth: 5_000_000, years: 5 },
  { level: 6, name: "Datacenter Baron", netWorth: 30_000_000, years: 8 },
];

// Clock and pacing: year each level should be reached by a reasonable player.
export const PACING_YEAR: Record<number, number> = { 2: 2005, 3: 2007, 4: 2010, 5: 2013, 6: 2018 };

export const TAX_RATE = 0.3;
// The savings the player transfers into the business account when it opens.
export const START_CASH = 3500;
