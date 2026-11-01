// Rivals: the competitors as companies that refresh hardware, have outages and win customers.
// Values and decisions are in docs/design/competitors.md.
import { binomial, chance, hashRng, rand, type Rng } from "../00-core/rng";
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
  // Customer count per city it sells in; a small rival sells only in its home cities.
  customers: Record<string, number>;
  closed: number | null;
  // Months in a row under the exit share in all its cities.
  weak: number;
  // Review stars and count per month, newest last, for the last REVIEW_MONTHS.
  reviews: { stars: number; count: number }[];
}
// New customers a month per city, in CITIES order, for you and each rival by id.
export interface ShareEntry { month: number; you: number[]; rivals: Record<string, number[]> }

export const TEMPLATES = Object.fromEntries(COMPETITORS.map((c) => [c.template, c])) as Record<Template, Competitor>;
const OUTAGE_CHANCE: Partial<Record<Template, number>> = { premium: 0.01, budget: 0.03 };
const C_STEP: Partial<Record<Template, number>> = { budget: 4, managed: 4, premium: 3 };
// Control panels, one-click installs, managed WordPress, a customer API and AI assistants.
export const CONVENIENCE_YEARS = [2006, 2009, 2013, 2016, 2023];
export const CHURN = 0.015, OUTAGE_CHURN = 0.02, GEN_PENALTY = 7.5, SHARE_MONTHS = 60;
// Small rivals (competitors.md, Entry and exit).
export const SMALL_GAP = 10, MAX_SMALL = 10, EXIT_SHARE = 0.005, EXIT_MONTHS = 6;
const STEMS = ["Netz", "Host", "Server", "Web", "Daten", "Cloud", "Rack", "Bit"];
const ENDINGS = ["kiste", "werk", "haus", "mann", "ly", "io", "24", "pro"];
// Rival reviews: 5% of new customers write one, an outage month adds 0.2% of all customers at H = 20.
export const REVIEW_SHARE = 0.05, OUTAGE_REVIEWS = 0.002, REVIEW_MONTHS = 24;

export const monthOf = (hour: number): number => monthIndexOf(hour) - START_YEAR * 12;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rand(rng) * xs.length)];
export const isSmall = (r: Rival): boolean => r.founded >= 0;
export const sellsIn = (r: Rival, city: string): boolean => r.customers[city] !== undefined;
export const reviewCount = (r: Rival): number => r.reviews.reduce((n, b) => n + b.count, 0);
// The same score as the player's: the 2-year average with a 3.5-star prior worth 20 reviews.
export const rivalScore = (r: Rival): number => (3.5 * 20 + r.reviews.reduce((n, b) => n + b.stars, 0)) / (20 + reviewCount(r));

// New customers a month in a city for each rival when nobody else takes any.
export function split(all: Rival[], city: string, hour: number): Map<string, number> {
  const out = new Map<string, number>(), market = cityMarket(city, hour), list = all.filter((r) => r.closed === null && sellsIn(r, city));
  for (const p of PROFILE_IDS) {
    for (const [product, w] of needsOf(p, yearOf(hour))) {
      const sellers = rivals(p, product, list), us = sellers.map((c) => Math.exp(rivalValue(p, c) / CHOICE_TAU)), sum = us.reduce((n, e) => n + e, 0);
      sellers.forEach((c, i) => out.set(c.id, (out.get(c.id) ?? 0) + (market * profileStats(p).mix * w * us[i]) / sum));
    }
  }
  return out;
}

// A small rival opening at month: 10 under its template's scores and 0.1 under its price, with the convenience steps
// the market has taken so far, in one or two home cities.
export function smallRival(list: Rival[], rng: Rng, month: number, templates: Template[]): Rival {
  const used = new Set(list.map((r) => r.name));
  const draw = () => `${pick(rng, STEMS)}${pick(rng, ENDINGS)}`;
  let name = draw();
  for (let n = 1; used.has(name) && n < 20; n++) name = draw();
  for (let n = 2, base = name; used.has(name); n++) name = `${base} ${n}`;
  const template = pick(rng, templates), t = TEMPLATES[template];
  const home = pick(rng, CITIES).name, second = chance(rng, 0.5) ? pick(rng, CITIES).name : home;
  const steps = CONVENIENCE_YEARS.filter((y) => (y - START_YEAR) * 12 <= month).length * (C_STEP[template] ?? 2);
  return {
    ...t, id: slug(name), name, P: t.P - SMALL_GAP, R: t.R - SMALL_GAP, C: Math.min(95, t.C - SMALL_GAP + steps), priceFactor: round(t.priceFactor - 0.1),
    founded: month, lag: Math.floor(rand(rng) * 19), outage: null, customers: { [home]: 0, [second]: 0 }, closed: null, weak: 0, reviews: [],
  };
}

// The six majors in every city and three small rivals, each starting with the customers its 2005 share holds at steady churn.
export function seedRivals(seed: number): Rival[] {
  const list: Rival[] = COMPETITORS.map((c, i) => ({
    ...c, id: slug(c.name), founded: -1, lag: Math.floor(rand(hashRng(seed, 0x7a11, i)) * 19), outage: null,
    customers: Object.fromEntries(CITIES.map((x) => [x.name, 0])), closed: null, weak: 0, reviews: [],
  }));
  const rng = hashRng(seed, 0x5ea1);
  for (let k = 0; k < 3; k++) list.push(smallRival(list, rng, 0, ["budget", "game", "managed"]));
  for (const city of CITIES) {
    const flows = split(list, city.name, 0);
    for (const r of list) if (sellsIn(r, city.name)) r.customers[city.name] = Math.round((flows.get(r.id) ?? 0) / CHURN);
  }
  return list;
}

// Entry waves: the shared and VPS boom of 2006 to 2009, the cloud years to 2015, then a trickle; at most MAX_SMALL small rivals open.
export const entryChance = (year: number): number => (year < 2006 ? 0 : year <= 2009 ? 0.15 : year <= 2015 ? 0.1 : 0.05);
export function entrant(list: Rival[], seed: number, hour: number): Rival | null {
  const month = monthOf(hour), rng = hashRng(seed, month, 0xe17), year = yearOf(hour);
  if (list.filter((r) => isSmall(r) && r.closed === null).length >= MAX_SMALL || !chance(rng, entryChance(year))) return null;
  return smallRival(list, rng, month, year >= 2010 ? ["budget", "game", "managed", "devCloud"] : ["budget", "game", "managed"]);
}

// A month's reviews from n new customers and, in an outage, OUTAGE_REVIEWS of all customers at H = 20.
export function rivalReviews(r: Rival, rng: Rng, n: number): { stars: number; count: number } {
  const write = (count: number, h: number) => {
    const x = 1 + (4 * h) / 100, low = Math.floor(x);
    return { stars: count * Math.min(5, low) + (low < 5 ? binomial(rng, count, x - low) : 0), count };
  };
  const happy = write(Math.round(REVIEW_SHARE * n), 40 + 0.6 * r.R);
  if (!r.outage) return happy;
  const angry = write(Math.round(OUTAGE_REVIEWS * Object.values(r.customers).reduce((a, b) => a + b, 0)), 20);
  return { stars: happy.stars + angry.stars, count: happy.count + angry.count };
}

// One month of a rival's scores and price at the month that starts at hour; news is the outage it started, if any.
export function driftRival(r: Rival, i: number, seed: number, hour: number): { rival: Rival; news: { city: string; hours: number } | null } {
  const d = dateOf(hour), year = d.getUTCFullYear(), t = TEMPLATES[r.template];
  // Months since January of a year; a rival follows the market lag months after it moves.
  const since = (y: number) => (year - y) * 12 + d.getUTCMonth();
  const gen = generationAt(year);
  const rng = hashRng(seed, monthOf(hour), i);
  const next: Rival = { ...r, P: t.P - (isSmall(r) ? SMALL_GAP : 0) - (gen > 0 && since(GENERATIONS[gen].year) < r.lag ? GEN_PENALTY : 0) };
  if (CONVENIENCE_YEARS.some((y) => since(y) === r.lag)) next.C = Math.min(95, r.C + (C_STEP[r.template] ?? 2));
  // Only the budget template cuts its price, 2% a year (competitors.md, Monthly drift).
  const cut = since(START_YEAR + 1) - r.lag;
  if (r.template === "budget" && cut >= 0 && cut % 12 === 0) next.priceFactor = Math.max(round(t.priceFactor - 0.15), round(r.priceFactor * 0.98));
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

export interface RivalEvent { kind: "outage" | "bust" | "bought" | "open"; id: string; params: (string | number)[] }

// One month for all rivals: scores drift, customers grow by won(rival, city) minus churn, reviews come in, a small rival
// under EXIT_SHARE of its cities' customers for EXIT_MONTHS closes with 50% chance, and a new one may open.
export function rollRivals(list: Rival[], seed: number, hour: number, won: (r: Rival, city: string) => number): { list: Rival[]; events: RivalEvent[] } {
  const month = monthOf(hour), events: RivalEvent[] = [], sold: [Rival, string][] = [];
  const totals = new Map<string, number>();
  for (const r of list) if (r.closed === null) for (const [city, n] of Object.entries(r.customers)) totals.set(city, (totals.get(city) ?? 0) + n);
  let next = list.map((r, i): Rival => {
    if (r.closed !== null) return r;
    const { rival, news } = driftRival(r, i, seed, hour), rng = hashRng(seed, month, i, 1);
    const churn = CHURN + (rival.outage ? OUTAGE_CHURN : 0), cities = Object.keys(r.customers);
    rival.customers = Object.fromEntries(cities.map((city) => [city, Math.max(0, Math.round(r.customers[city] * (1 - churn) + won(r, city)))]));
    rival.reviews = [...r.reviews, rivalReviews(rival, rng, cities.reduce((n, city) => n + won(r, city), 0))].slice(-REVIEW_MONTHS);
    rival.weak = isSmall(r) && cities.every((city) => r.customers[city] < EXIT_SHARE * (totals.get(city) ?? 0)) ? r.weak + 1 : 0;
    if (news) events.push({ kind: "outage", id: r.id, params: [CITIES.findIndex((c) => c.name === news.city), news.hours] });
    if (rival.weak < EXIT_MONTHS || !chance(rng, 0.5)) return rival;
    // A bust rival's customers leave; a bought one's move to the major of its template.
    if (chance(rng, 0.5)) events.push({ kind: "bust", id: r.id, params: [] });
    else {
      const buyer = slug(TEMPLATES[r.template].name);
      events.push({ kind: "bought", id: r.id, params: [buyer] });
      sold.push([rival, buyer]);
    }
    return { ...rival, closed: month, customers: {} };
  });
  for (const [r, buyer] of sold) {
    next = next.map((x) => (x.id !== buyer ? x : { ...x, customers: Object.fromEntries(Object.entries(x.customers).map(([city, n]) => [city, n + (r.customers[city] ?? 0)])) }));
  }
  const born = entrant(next, seed, hour);
  if (born) {
    next = [...next, born];
    events.push({ kind: "open", id: born.id, params: [CITIES.findIndex((c) => c.name === Object.keys(born.customers)[0])] });
  }
  return { list: next, events };
}

// A rival news id reads rival.<kind>.<rival id>.<month>.<params>.
export function rivalNews(s: GameState, id: string): NewsDef | undefined {
  const [, kind, rid, , ...rest] = id.split("."), r = s.competitors.find((x) => x.id === rid);
  if (!r) return undefined;
  if (kind === "open") return { id, key: "event.news.rivalOpen", at: -1, params: { name: r.name, city: CITIES[Number(rest[0])]?.name ?? "" } };
  if (kind === "bust") return { id, key: "event.news.rivalBust", at: -1, params: { name: r.name } };
  if (kind === "bought") return { id, key: "event.news.rivalBought", at: -1, params: { name: r.name, buyer: s.competitors.find((x) => x.id === rest[0])?.name ?? "" } };
  if (kind === "outage") return { id, key: "event.news.rivalOutage", at: -1, params: { name: r.name, city: CITIES[Number(rest[0])]?.name ?? "", hours: Number(rest[1]) } };
  return undefined;
}
