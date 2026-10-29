// The market: who looks for a host each month, how many of them pick you, and what they ask for.
// Values and decisions are in docs/design/economy.md, "Market and leads", "Customer choice" and "Requests, SLAs and growth".
import { rand, type Rng } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { CHOICE_TAU, CITIES, COMPETITORS, generationAt, leadCapShare, MARKET_GROWTH, type Budget, type Profile as ProfileStats } from "../10-catalog/economy";
import { modelById } from "../10-catalog/hardware";
import { marketPrice, planOf, PRODUCTS, type Sla } from "../10-catalog/products";
import type { Product, Profile } from "../30-customers/customers";
import { profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { hasHosts, serverTaken, supports } from "../60-infra/cluster";
import { locationOf } from "../60-infra/status";
import { awareness, leadsThisMonth, PROFILE_IDS, reviewMultiplier, reviewScore, trustBonus } from "../80-business/marketing";
import { forumAwareness } from "../47-staff/staff";
import { metrics } from "../metrics";
import { LINE_NAME, serviceMarket, type CustomSpec } from "./custom";

export type RequestStatus = "open" | "quoted" | "countered" | "refused" | "won" | "lost" | "declined";
// by names the employee who sent a "you" message; the player otherwise.
export interface SalesMessage { hour: number; from: "customer" | "you"; key: string; params: Record<string, string | number>; by?: string }
// One sales request. profile, budget and shady stay hidden from the player. reference is the monthly market price;
// budget is the price ratio to it at which the customer accepts half the time. serviceId is the service an expansion replaces.
export interface SalesRequest {
  id: string; kind: "new" | "expansion" | "order"; customerId: string | null; contact: string; company: string | null; profile: Profile;
  city: string; product: Product; plan: string; sla: Sla; reference: number; discount: number; budget: number; shady: boolean;
  serviceId: string | null; ticketId: string | null; createdAt: number; deadline: number; status: RequestStatus;
  quote: number | null; counter: number | null; replyAt: number | null; attempts: number; thread: SalesMessage[];
  // Web hosting only: the domain the service will carry.
  domain?: string;
  // A custom order (custom.ts): its resources, whether the customer owns the domain already, its first invoice and the
  // route chosen for its setup ("auto", a cluster id or a node's device id).
  spec?: CustomSpec; owned?: boolean; invoiceId?: string; route?: string;
  // Whether its line sold packages when it arrived; without them it asks for the line, not a plan.
  packaged?: boolean;
}
// reason is an i18n key with its params.
export interface LostSale { hour: number; name: string; product: Product; plan: string; reference: number; reason: string; params: Record<string, string | number> }
export interface Sales { requests: SalesRequest[]; lost: LostSale[] }
export const newSales = (): Sales => ({ requests: [], lost: [] });

// Share of a city's new customers who know you and look at your offer; 0.4 gives about 20 basement leads a month.
export const ORGANIC_CONSIDER = 0.4;
// How strongly a host's price level moves the choice: a quarter of the balance model's price term.
export const PRICE_WEIGHT = 0.25;
// Website and campaign leads that come from cities without a location of yours.
export const SPILL_SHARE = 0.1;
export const REFERRAL_LEADS = 0.005;
// Forum leads raise awareness of the forum profiles by this share of the gap per lead.
export const FORUM_AWARENESS = 0.005;
export const FORUM_PROFILES: Profile[] = ["hobbyDev", "gamer", "smallBiz"];
// economy.md, Customer choice, Offer column.
export const OFFER: Record<Budget, number> = { low: 0.9, medium: 1, high: 1.3 };
export const REQUEST_HOURS = 72;

// What each profile asks for: product and weight. Plans scale with the budget (decision).
export const NEEDS: Record<Profile, [Product, number][]> = {
  private: [["webHosting", 1]],
  gamer: [["gameServer", 0.6], ["vps", 0.2], ["webHosting", 0.2]],
  hobbyDev: [["vps", 0.9], ["webHosting", 0.1]],
  soleProp: [["webHosting", 0.9], ["vps", 0.1]],
  smallBiz: [["webHosting", 0.6], ["vps", 0.4]],
  agency: [["webHosting", 0.3], ["vps", 0.7]],
  office: [["webHosting", 0.9], ["vps", 0.1]],
  onlineShop: [["webHosting", 0.5], ["vps", 0.5]],
  enterprise: [["vps", 0.5], ["dedicated", 0.5]],
};
export const SLA_ASKED: Record<Profile, Sla> = {
  private: "basic", gamer: "basic", hobbyDev: "basic", soleProp: "basic", smallBiz: "business", agency: "business",
  office: "business", onlineShop: "premium", enterprise: "premium",
};

const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];
export const cityMarket = (city: string, hour: number): number =>
  (CITIES.find((c) => c.name === city)?.market ?? 600) * Math.pow(1 + MARKET_GROWTH, hour / 8760);
export const locationCities = (s: GameState): string[] => [...new Set(s.locations.map((l) => l.city))];
const zonesIn = (s: GameState, city: string): string[] => s.locations.filter((l) => l.city === city).map((l) => l.az);

// Products you can sell in a city: cluster products need a cluster with nodes there running software that sells them,
// dedicated servers a free mounted server.
export function offers(s: GameState, product: Product, city: string): boolean {
  const zones = zonesIn(s, city), runsOn = PRODUCTS[product].runsOn;
  if (runsOn === "cluster") return s.clusters.some((c) => zones.includes(c.az) && hasHosts(c) && supports(c, product));
  if (runsOn === "server") return s.devices.some((d) => d.rackId && modelById(d.model).server && zones.includes(locationOf(s, d)?.az ?? "") && !serverTaken(s, d.id));
  return runsOn === "none" || s.locations.some((l) => l.city === city && l.dc);
}

// Customer choice scores of your company for a product in a city (economy.md, Customer choice).
// ponytail: headroom is 100 and uptime comes from this month's down hours; per-link p95 and a 90-day record come with the network lane.
export function playerScores(s: GameState, profile: Profile, city: string): { P: number; R: number; C: number } {
  const year = yearOf(s.hour), now = generationAt(year);
  const nodes = s.clusters.flatMap((c) => c.nodes).map((n) => s.devices.find((d) => d.id === n.deviceId)).filter((d) => !!d);
  const gens = nodes.map((d) => Math.max(0, 100 - 15 * (now - generationAt(modelById(d.model).from))));
  const gen = gens.length ? gens.reduce((a, b) => a + b, 0) / gens.length : 70;
  const loc = zonesIn(s, city).length ? 100 : 40;
  const P = 0.5 * gen + 0.3 * 100 + 0.2 * loc;
  const live = s.services.filter((v) => v.endedAt === null);
  const down = live.reduce((n, v) => n + (s.downHours[v.id] ?? 0), 0) / Math.max(1, live.length * (s.hour % 730 || 1));
  const uptime = s.hour < 720 ? 60 : Math.min(100, Math.max(0, 100 - 40 * Math.log10(Math.max(down, 0.0005) / 0.0001)));
  const answered = s.tickets.filter((t) => t.replies.length && s.hour - t.createdAt < 2160);
  const ratio = answered.length ? answered.reduce((n, t) => n + (t.replies[0].hour - t.createdAt) / Math.max(1, t.dueAt - t.createdAt), 0) / answered.length : 0.75;
  const support = ratio <= 0.5 ? 100 : ratio <= 1 ? 100 - 100 * (ratio - 0.5) : Math.max(0, 50 - 50 * (ratio - 1));
  const R = 0.5 * uptime + 0.3 * support + 0.2 * 40;
  const bundle = NEEDS[profile];
  const portfolio = (100 * bundle.filter(([p]) => offers(s, p, city)).length) / bundle.length;
  const C = 0.5 * 60 + 0.3 * portfolio;
  return { P, R, C };
}

// Your price level against the market reference, from the services you sell (friends excluded); 1 without any.
export function priceIndex(s: GameState): number {
  const ratios: number[] = [];
  const year = yearOf(s.hour);
  for (const v of s.services) {
    const c = s.customers.find((x) => x.id === v.customerId);
    if (v.endedAt !== null || v.period !== "hour" || !c || c.habit === "friend") continue;
    const ref = serviceMarket(v, year) * OFFER[profileStats(c.profile).budget];
    if (ref > 0) ratios.push((v.price * 730) / ref);
  }
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
}

const value = (p: ProfileStats, P: number, R: number, C: number, T: number, priceFactor: number) =>
  p.wP * P + p.wR * R + p.wC * C + T - PRICE_WEIGHT * p.lambda * 100 * (priceFactor - 1);

export const rivals = (profile: Profile, product: Product) => {
  const p = profileStats(profile);
  return COMPETITORS.filter((c) => c.priceFactor <= p.cap && c.sells.includes(product) && (!c.targets || c.targets.includes(p.id)));
};

// Your value U and the best competitor's for a profile, product and city.
export function values(s: GameState, profile: Profile, product: Product, city: string): { you: number; others: number[] } {
  const p = profileStats(profile), sc = playerScores(s, profile, city);
  return {
    you: value(p, sc.P, sc.R, sc.C, trustBonus(s), priceIndex(s)),
    others: rivals(profile, product).map((c) => value(p, c.P, c.R, c.C, 0, c.priceFactor)),
  };
}

// The softmax share of leads that pick you over the competitors that sell the product.
export function share(s: GameState, profile: Profile, product: Product, city: string): number {
  const { you, others } = values(s, profile, product, city);
  const e = Math.exp(you / CHOICE_TAU);
  return e / (e + others.reduce((n, u) => n + Math.exp(u / CHOICE_TAU), 0));
}

export interface LeadFlow { profile: Profile; city: string; leads: number; conversion: number }

// Expected leads per month by profile and city: organic, referrals, forum posts, website and campaigns, capped per city.
export function leadFlows(s: GameState): LeadFlow[] {
  const home = s.locations[0]?.city ?? "Frankfurt", cities = locationCities(s), level = metrics(s).level.level, rev = reviewMultiplier(s);
  const others = CITIES.map((c) => c.name).filter((c) => !cities.includes(c));
  const out: LeadFlow[] = [];
  const add = (profile: Profile, city: string, leads: number, conversion = 1) => {
    if (leads > 0) out.push({ profile, city, leads, conversion });
  };
  const forum = forumAwareness(s);
  for (const profile of PROFILE_IDS) {
    const mix = profileStats(profile).mix;
    for (const city of cities) {
      const cap = leadCapShare(level) * cityMarket(city, s.hour) * mix;
      const organic = ORGANIC_CONSIDER * cityMarket(city, s.hour) * mix * awareness(s, profile) * (1 + 0.5 * (level - 1)) * rev;
      const happy = city === home ? s.customers.filter((c) => c.profile === profile && c.churnedAt === null && c.happiness >= 70).length : 0;
      const posts = city === home && FORUM_PROFILES.includes(profile) ? forum / FORUM_PROFILES.length : 0;
      add(profile, city, Math.min(cap, organic + happy * REFERRAL_LEADS * rev + posts));
    }
  }
  for (const b of leadsThisMonth(s)) {
    add(b.profile, b.city, b.count * (1 - SPILL_SHARE), b.conversion);
    for (const city of others) add(b.profile, city, (b.count * SPILL_SHARE) / others.length, b.conversion);
  }
  return out;
}

// What a lead of this profile asks for: a product by the profile's weights, a plan by budget and an SLA.
export function needFor(r: Rng, profile: Profile): { product: Product; plan: string; sla: Sla } {
  let x = rand(r), product = NEEDS[profile][0][0];
  for (const [p, w] of NEEDS[profile]) {
    if (x < w) { product = p; break; }
    x -= w;
  }
  const plans = PRODUCTS[product].plans, budget = profileStats(profile).budget;
  const i = budget === "low" ? 0 : budget === "medium" ? Math.min(1, plans.length - 1) : plans.length - 1;
  const asked = SLA_ASKED[profile];
  // Four in ten settle for one SLA level less than their profile asks.
  const sla: Sla = rand(r) < 0.4 ? (asked === "premium" ? "business" : "basic") : asked;
  return { product, plan: plans[i].id, sla };
}

export const referenceFor = (s: GameState, profile: Profile, product: Product, plan: string, sla: Sla): number =>
  Math.round(marketPrice(product, plan, yearOf(s.hour), sla) * OFFER[profileStats(profile).budget] * 100) / 100;

export interface Requirement { key: string; params: Record<string, string | number>; ok: boolean }

// Every requirement of a request with whether you meet it; the keys read as "Needs a location in London".
export function requirementsFor(s: GameState, r: Pick<SalesRequest, "city" | "product" | "sla" | "profile" | "kind">): Requirement[] {
  const out: Requirement[] = [{ key: "sales.need.location", params: { city: r.city }, ok: s.locations.some((l) => l.city === r.city) }];
  if (!out[0].ok || r.kind === "expansion") return out;
  if (r.sla === "premium") out.push({ key: "sales.need.age", params: { months: 12 }, ok: s.hour >= 8760 });
  if (profileStats(r.profile).budget === "high") out.push({ key: "sales.need.reviews", params: { stars: 3 }, ok: reviewScore(s) >= 3 });
  return out;
}

export const missingFor = (s: GameState, r: Parameters<typeof requirementsFor>[1]): Requirement[] => requirementsFor(s, r).filter((x) => !x.ok);

// economy.md, Customer choice: a quote is accepted with a logistic chance of its ratio to the reference.
// mid is the ratio accepted half the time; width 0.06 turns 10% over mid into about a 16% chance.
export const ACCEPT_WIDTH = 0.06;
export function acceptMid(s: GameState, r: SalesRequest): number {
  const existing = r.customerId !== null ? 1.15 : 1;
  return r.budget * (1 - r.discount) * existing * (1 + 0.05 * (reviewScore(s) - 3.5)) * (1 + 0.1 * awareness(s, r.profile));
}
export const acceptChance = (s: GameState, r: SalesRequest, quote: number): number =>
  (1 / (1 + Math.exp((quote / r.reference - acceptMid(s, r)) / ACCEPT_WIDTH))) * (r.attempts > 1 ? 0.35 : 1);

// Names for request senders; companies follow the profile.
const FIRST = ["Anna", "Ben", "Carla", "David", "Elif", "Frank", "Greta", "Hakan", "Ines", "Jan", "Katrin", "Luca", "Mona", "Nils", "Olga", "Peter", "Rosa", "Sven", "Tanja", "Uwe"];
const LAST = ["Albers", "Bauer", "Dietrich", "Engel", "Franke", "Graf", "Haas", "Jung", "Kaiser", "Lorenz", "Maurer", "Nowak", "Otto", "Pohl", "Roth", "Seidel", "Thiel", "Vogel", "Winter", "Ziegler"];
const TRADES = ["Florist", "Bakery", "Bike Repair", "Tailoring", "Bookshop", "Plumbing", "Driving School", "Tattoo Studio"];
const FIRMS = ["Logistics", "Consulting", "Print & Copy", "Steuerberatung", "Elektro", "Immobilien"];
const AGENCY = ["Pixelwerk", "Bytegarten", "Klickfabrik", "Studio Kobalt", "Nordlicht Digital", "Webschmiede"];
const SHOPS = ["socken", "kaffeebohne", "brettspiel", "hundekeks", "gartenzwerg", "retrokonsole"];
const OFFICES = ["Dental Practice", "Law Office", "Physiotherapy", "Notary", "Veterinary Clinic"];
const SHADY = ["Bulletproof Solutions Ltd", "Totally Legit Media", "Offshore Synergies", "Anonymous Traffic GmbH"];
const HOME = { FIRST, LAST, FIRMS, AGENCY, SHOPS, shop: "de", corp: "AG" };
// Senders in American cities; same list lengths, so a seed draws the same sequence.
const US = {
  FIRST: ["Amy", "Brian", "Carly", "Dwayne", "Emily", "Frank", "Grace", "Hank", "Isabel", "Jake", "Kayla", "Logan", "Madison", "Nate", "Olivia", "Parker", "Riley", "Scott", "Tyler", "Wyatt"],
  LAST: ["Anderson", "Baker", "Carter", "Davis", "Evans", "Foster", "Garcia", "Harris", "Johnson", "Kelly", "Lopez", "Miller", "Nelson", "Owens", "Parker", "Reed", "Smith", "Taylor", "Walker", "Young"],
  FIRMS: ["Logistics", "Consulting", "Print & Copy", "Tax Services", "Electric", "Realty"],
  AGENCY: ["Pixel Barn", "Byte Garden", "Click Factory", "Studio Cobalt", "Northern Light Digital", "Web Forge"],
  SHOPS: ["socks", "coffeebean", "boardgame", "dogtreats", "gardengnome", "retroconsole"],
  shop: "com", corp: "Inc",
};

export function senderFor(r: Rng, profile: Profile, shady = false, us = false): { contact: string; company: string | null } {
  const { FIRST, LAST, FIRMS, AGENCY, SHOPS, shop, corp } = us ? US : HOME;
  const last = pick(r, LAST), contact = `${pick(r, FIRST)} ${last}`;
  if (shady) return { contact: `Mr. ${pick(r, ["Smith", "Jones", "Brown"])}`, company: pick(r, SHADY) };
  const company: Record<Profile, string | null> = {
    private: null, gamer: null, hobbyDev: null,
    soleProp: `${last} ${pick(r, TRADES)}`, smallBiz: `${last} ${pick(r, FIRMS)}`, agency: pick(r, AGENCY),
    office: `${pick(r, OFFICES)} ${last}`, onlineShop: `${pick(r, SHOPS)}-shop.${shop}`, enterprise: `${last} Industries ${corp}`,
  };
  return { contact, company: company[profile] };
}

export const requestName = (r: Pick<SalesRequest, "contact" | "company">): string => r.company ?? r.contact;
// A request names its plan only when it orders one of the player's packages.
export const planName = (r: Pick<SalesRequest, "product" | "plan" | "spec" | "packaged">): string =>
  r.spec || !r.packaged ? LINE_NAME[r.product] : planOf(r.product, r.plan).name;
