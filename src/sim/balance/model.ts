// Monthly cohort model of docs/design/economy.md for the headless balance run.
// ponytail: customers are cohorts per profile and product with one average happiness; per-customer sim comes with the real tick.
import { binomial, createRng, rand, type Rng } from "../00-core/rng";
import { WORK_SHARE, type Patience } from "../00-core/workhours";
import {
  BASEMENT_SLOTS, BUDGET_SIZE, businessPowerPrice, CHOICE_TAU, CITIES, COMPETITORS, generationAt,
  leadCapShare, LEVELS, MARKET_GROWTH, monthlySalary, NEVER_PAYS, ON_TIME, PAYMENT_MINUTES, PROFILES,
  REPAIR_HOURS, SEARCH_AD_COST, SERVER_AFR, STAFF_HOURS_PER_MONTH, START_CASH,
  TAX_RATE, TICKET_MINUTES, TICKETS_PER_CUSTOMER, UPGRADE_CHANCE, priceAt, tasksPerHour, vpsPlanGb,
  type ProductId, type Profile,
} from "../10-catalog/economy";
import { DATACENTERS, HOME_LINES, homeLineById, MOVE, spacePrice } from "../20-world/datacenters";
import { LINE_EXTRA_V4, providerV4, STATIC_LINE_ADDRESSES } from "../10-catalog/addresses";
import { noticedHours } from "../10-catalog/attention";
import { dcPerTb } from "../10-catalog/network";
import { OVER_DRIFT, PAST_MAX_DRIFT, TOLERANCE } from "../30-customers/pricing";
import { OFFER, ORGANIC_CONSIDER, REFERRAL_LEADS, SPILL_SHARE } from "../30-market/market";
import { BUDGETS, OWNED, PLATFORMS, SATURATION, WEBSITE_LEADS } from "../80-business/marketing";
import { generationOf, penaltyFor, SITE_RENT } from "../80-business/website";
import { annuity, baseRate, LOAN_AMOUNTS, MIN_LIMIT, RISK_PREMIUM } from "../45-billing/billing";
import { LEASE_FACTOR, LEASE_TERMS } from "../10-catalog/leasing";
import { modelById, type DeviceModel } from "../10-catalog/hardware";
import { presetPrice } from "../10-catalog/parts";
import { skillById } from "../10-catalog/research";
import { KNOW_HOW, STORE, subscriptionPrice } from "../10-catalog/store";
import { MONTHLY_RATES } from "../40-support/tickets";
import { BOT_SPEED } from "../47-staff/staff";
import { botOdds, BOT_RIGHT, costPerTicket, type ChadKind } from "../47-staff/chad";
import { marketPrice, marketSetup, type Spec } from "../10-catalog/products";
import { EMAIL_SHARE } from "../30-market/orders";
import { factorFor, REGISTRARS, tierFor } from "../10-catalog/registrars";
import { DOMAIN_FEE, registryCost } from "../30-customers/registry";
import { providerById } from "../80-business/mail";
import type { Product as LiveProduct } from "../30-customers/customers";

// Average hours a ticket written at a random hour waits for the office to open: four 16-hour nights and a 64-hour weekend.
const OFF_HOURS_WAIT = (4 * 16 ** 2 + 64 ** 2) / 2 / 168;

const BUSINESS_IDS = ["small", "agency", "office", "shop", "enterprise"];

// Calendar hours past a patience window; a business-hours window stretches over nights and weekends.
const beyond =(e: Patience, calendarHours: number): number =>
  Math.max(0, calendarHours - (e.clock === "business" ? e.hours / WORK_SHARE : e.hours));

export interface Bot {
  name: string;
  priceFactor: number;
  hires: boolean;
  adShare: number;
  playerHours: number;
}

export const STEADY: Bot = { name: "steady", priceFactor: 0.8, hires: true, adShare: 0.1, playerHours: 60 };
export const SOLO: Bot = { ...STEADY, name: "solo", hires: false };

interface Cohort { n: number; H: number }
interface Server { gen: number; ramGb: number; cores: number; watts: number; bought: number; price: number; basement: boolean; leasedUntil?: number }
interface Loan { balance: number; payment: number; rate: number }
interface Lease { payment: number; until: number }
type Product = ProductId | "game";
interface Worker { skill: number; hired: number; cap: number }

export interface YearRow { year: number; level: number; customers: number; mrr: number; minCash: number; staff: number; flow: Record<string, number> }
export interface RunResult { bot: string; seed: number; rows: YearRow[]; levelYear: Record<number, number>; bankrupt: boolean }

const PRODUCTS: Product[] = ["web", "vps", "game"];
const MONTHS = 12;
// Gamers ask for a game server 60% of the time (30-market/market.ts, NEEDS).
const GAME_SHARE = 0.6;
// RAM per cluster for the hypervisor and the panel VM's own panel.
const CONTROL_RAM = 1;
// The bot plans for this many vCPU per physical core; the game lets it book more, at the cost of performance.
const CPU_PER_CORE = 8;
// A basement server's average draw and the evening peak over a service's mean traffic (Traffic and bandwidth).
const BASEMENT_WATTS = 150, PEAK_FACTOR = 2;
const KNOW: Record<Product, number> = { web: KNOW_HOW.webHosting, vps: KNOW_HOW.vps, game: KNOW_HOW.gameServer };
const TRAFFIC: Record<Product, number> = { web: 2, vps: 20, game: 60 };
// Out of the basement the bot rents the cheapest rack share in its home city that holds its servers' rated draw,
// or whole positions past a full rack, and pays power per kWh and the datacenter's bandwidth per TB (Datacenters and space).
const HOME_DC = DATACENTERS.filter((d) => d.city === CITIES[0].name).sort((a, b) => a.positionPrice - b.positionPrice)[0];
const DRAW_SHARE = 0.6;
// Cities the bot opens after its home city, largest market first, each in its cheapest datacenter's 1/8 rack share.
// ponytail: capacity stays one pool; per-city clusters come with a placement-aware model.
const CITY_ORDER = [CITIES[0], ...CITIES.slice(1).sort((a, b) => b.market - a.market)];
const cityRent = (city: string) => Math.min(...DATACENTERS.filter((d) => d.city === city).map((d) => spacePrice(d, "share", 8)));
// ChadGPT Support (Pear Store, Automation skill) answers how-to and billing tickets around the clock at twice a skill-50
// person's rate. The model learns Employee management, Monitoring and Automation on the way.
const CHAD = STORE.find((i) => i.id === "chadGpt")!;
const CHAD_KNOW_HOW = ["people", "monitoring", "automation"].reduce((a, id) => a + skillById(id)!.knowHow, 0);
// Awareness starts at 5% for private individuals and gamers and 2% for the rest (80-business/marketing.ts).
const AWARENESS_START = (p: Profile) => (p.id === "private" || p.id === "gamer" ? 0.05 : 0.02);
// The model has none of year 1's setup work (trainings, website, order form) and would fill the basement by April;
// the happiness run's careful player fills it in the last quarter, so the bot moves out no earlier than October.
const MOVE_MONTH = 9;
function rackRent(watts: number): number {
  const kw = watts / 1000;
  const share = [8, 4, 2, 1].find((n) => kw <= HOME_DC.kwPerPosition / n);
  return share ? spacePrice(HOME_DC, "share", share) : Math.ceil(kw / HOME_DC.kwPerPosition) * HOME_DC.positionPrice;
}

// A customer's spec, sized like the live SIZES (10-catalog/products.ts) and scaled by the budget: a web space of 2 GB of
// the year's disk and two mailboxes per size step in 0.25 GB of a panel VM, a VPS of the year's base RAM (one vCPU per
// 2 GB, at least one, and 20 GB of disk per GB), a game server of 2 vCPUs, 4 GB and 10 GB of the year's base; traffic
// scales with the budget like the rest.
const LIVE: Record<Product, LiveProduct> = { web: "webHosting", vps: "vps", game: "gameServer" };
function specOf(p: Profile, product: Product, year: number): Spec {
  const k = BUDGET_SIZE[p.budget], g = vpsPlanGb(year), trafficGb = monthlyGb(product, year) * k;
  if (product === "web") return { vcpu: 0.1, ramGb: 0.25, diskGb: 2 * g * k, trafficGb, mailboxes: 2 * k };
  if (product === "game") return { vcpu: 2 * g * k, ramGb: 4 * g * k, diskGb: 10 * g * k, trafficGb, mailboxes: 0 };
  return { vcpu: Math.max(1, Math.round((g * k) / 2)), ramGb: g * k, diskGb: 20 * g * k, trafficGb, mailboxes: 0 };
}
// The monthly price of that spec at the live market rates per resource.
const priceOf = (p: Profile, product: Product, year: number): number => marketPrice(LIVE[product], specOf(p, product, year), year);
// Booked vCPUs and GB of RAM of that spec.
const cpuOf = (p: Profile, product: Product, year: number): number => specOf(p, product, year).vcpu;
// The live shop's Dwell server of a generation and line (10-catalog/hardware.ts): balanced 1U or memory-optimized 2U.
const shopServer = (gen: number, line: "compute" | "memory"): DeviceModel => modelById(`g${gen + 1}-${line}`);
// What the shop charges for it in a year: its chassis plus its parts at that year's part prices.
const shopPrice = (gen: number, line: "compute" | "memory", year: number): number => presetPrice(shopServer(gen, line), year);
const serverOf = (gen: number, line: "compute" | "memory", month: number, basement: boolean): Server => {
  const m = shopServer(gen, line);
  return { gen, ramGb: m.server!.ramGb, cores: m.server!.cores, watts: m.watts, bought: month, price: shopPrice(gen, line, 2005 + Math.floor(month / 12)), basement };
};
const ramOf = (p: Profile, product: Product, year: number): number => specOf(p, product, year).ramGb;
// Mbit/s a customer sends at the evening peak; traffic grows 20% a year like the live TRAFFIC_GROWTH.
const monthlyGb = (product: Product, year: number): number => TRAFFIC[product] * Math.pow(1.2, year - 2005);
const peakMbit = (product: Product, year: number): number => (monthlyGb(product, year) * 8000) / (730 * 3600) * PEAK_FACTOR;
const wants = (p: Profile, product: Product): number => {
  const game = p.id === "gamer" ? GAME_SHARE : 0;
  return product === "web" ? 1 - p.vpsShare : product === "game" ? game : p.vpsShare - game;
};

function supportScore(waitRatio: number): number {
  if (waitRatio <= 0.5) return 100;
  if (waitRatio <= 1) return 100 - 100 * (waitRatio - 0.5);
  return Math.max(0, 50 - 50 * (waitRatio - 1));
}

const uptimeScore = (down: number): number =>
  Math.min(100, Math.max(0, 100 - 40 * Math.log10(Math.max(down, 1e-6) / 0.0001)));

function hire(rng: Rng, month: number): Worker {
  const r = rand(rng);
  const skill = r < 0.6 ? 10 + 25 * rand(rng) : r < 0.9 ? 35 + 30 * rand(rng) : 65 + 25 * rand(rng);
  return { skill, hired: month, cap: 60 + 40 * rand(rng) };
}

function grow(w: Worker, month: number): void {
  const years = (month - w.hired) / 12;
  const perYear = years < 2 ? 12 : years < 5 ? 6 : 2;
  w.skill = Math.min(w.cap, w.skill + perYear / 12);
}

export function run(bot: Bot, seed: number, years = 15): RunResult {
  const rng = createRng(seed);
  const cohorts: Cohort[][] = PROFILES.map(() => PRODUCTS.map(() => ({ n: 0, H: 70 })));
  cohorts[0][0] = { n: 3, H: 85 };
  // The first server, bought from the starting savings in January.
  const servers: Server[] = [serverOf(0, "compute", 0, true)];
  const loans: Loan[] = [];
  const leases: Lease[] = [];
  const profits: number[] = [];
  // A dynamic line sells only web hosting, so the bot starts on the business DSL line (economy.md, Addresses and internet).
  let line = homeLineById("dsl-16-biz");
  const support: Worker[] = [];
  const books: Worker[] = [];
  let cash = START_CASH - servers[0].price, minCash = cash, level = 1, knowHow = 0, cities = 1, rackUnlocked = false, hireUnlocked = false;
  let backlogT = 0, backlogP = 0, waitHours = 4, downFrac = 0, lastMrr = 0, lastPerGb = 0, lastRunning = 0, yearProfit = 0, negMonths = 0, bankrupt = false;
  let reviewSum = 0, reviewN = 0, website = false, designYear = 2005, cityRents = 0, chad = false;
  const aware: number[] = PROFILES.map(AWARENESS_START);
  // Customers of a cohort with happiness 70 or more, from its average.
  const happyOf = (i: number, k: number) => cohorts[i][k].n * Math.min(1, Math.max(0, (cohorts[i][k].H - 50) / 40));
  const rows: YearRow[] = [];
  const levelYear: Record<number, number> = {};
  let flow: Record<string, number> = {};
  const book_ = (k: string, v: number) => { flow[k] = (flow[k] ?? 0) + v; };

  for (let month = 0; month < years * MONTHS && !bankrupt; month++) {
    const year = 2005 + Math.floor(month / 12);
    const yf = 2005 + month / 12;
    const gen = generationAt(year);

    // Scores (Customer choice).
    const vpsServers = servers.length;
    const gensBehind = servers.reduce((a, s) => a + (gen - s.gen) * s.ramGb, 0) / Math.max(1, servers.reduce((a, s) => a + s.ramGb, 0));
    const vpsP = 0.5 * Math.max(0, 100 - 15 * gensBehind) + 0.3 * 100 + 0.2 * 100;
    const P: Record<Product, number> = { web: 70, vps: vpsP, game: vpsP };
    const avgPromised = 30;
    const sScore = supportScore(waitHours / avgPromised);
    const vpsR = 0.5 * (month < 1 ? 60 : uptimeScore(downFrac)) + 0.3 * sScore + 0.2 * 40;
    const R: Record<Product, number> = { web: 0.5 * (month < 1 ? 60 : 82) + 0.3 * sScore + 0.2 * 40, vps: vpsR, game: vpsR };
    const C = 0.5 * 70 + 0.3 * 50 + 0.2 * 25;
    const revMult = 0.4 + 0.25 * ((3.5 * 20 + reviewSum) / (20 + reviewN) - 1);

    const U = (p: Profile, pr: Product, locPenalty: number) =>
      p.wP * (P[pr] - locPenalty) + p.wR * R[pr] + p.wC * C - p.lambda * 100 * (bot.priceFactor - 1);
    // ponytail: the cohort model keeps the four archetypes in every segment; specialists and product lines live in the real market (30-market).
    const rivals = (p: Profile, _pr: Product) => COMPETITORS.filter((c) => c.priceFactor <= p.cap && !c.targets);
    const best = (p: Profile, pr: Product) => Math.max(...rivals(p, pr)
      .map((c) => p.wP * c.P + p.wR * c.R + p.wC * c.C - p.lambda * 100 * (c.priceFactor - 1)));
    const share = (p: Profile, pr: Product) => {
      const you = Math.exp(U(p, pr, 0) / CHOICE_TAU);
      const others = rivals(p, pr)
        .reduce((a, c) => a + Math.exp((p.wP * c.P + p.wR * c.R + p.wC * c.C - p.lambda * 100 * (c.priceFactor - 1)) / CHOICE_TAU), 0);
      return you / (you + others);
    };

    // Leads (Market and leads), as 30-market/market.ts leadFlows: organic by awareness and referrals from happy customers,
    // capped per city, plus website and search campaign leads, of which 10% spill to cities without a location.
    if (!website && rackUnlocked && cash > 3000 + OWNED.website.setup + OWNED.orderForm.setup) { website = true; designYear = generationOf(year); cash -= OWNED.website.setup + OWNED.orderForm.setup; }
    // The bot redesigns once the site is 2 generations behind; its site stays on the rented host.
    if (website && generationOf(year) - designYear >= 8 && cash > 5000) { designYear = generationOf(year); cash -= OWNED.website.setup; }
    // The search campaign: the largest preset budget within the bot's ad share, spread over every profile and city.
    const adSpent = cash > 3000 ? BUDGETS.filter((b) => b <= bot.adShare * lastMrr).at(-1) ?? 0 : 0;
    const perCity = adSpent / cities, dearer = 1 + perCity / SATURATION;
    const paidBy = PROFILES.map(() => 0);
    const newCustomers: number[][] = PROFILES.map(() => PRODUCTS.map(() => 0));
    for (let c = 0; c < cities; c++) {
      const market = CITY_ORDER[c].market * Math.pow(1 + MARKET_GROWTH, yf - 2005);
      PROFILES.forEach((p, i) => {
        const organic = ORGANIC_CONSIDER * market * p.mix * aware[i] * (1 + 0.5 * (level - 1)) * revMult;
        const referrals = c === 0 ? PRODUCTS.reduce((a, _, k) => a + happyOf(i, k), 0) * REFERRAL_LEADS * revMult : 0;
        const cap = leadCapShare(level) * market * p.mix;
        const paid = perCity / PROFILES.length / (priceAt(SEARCH_AD_COST[p.budget], 0.6, year) * dearer);
        const site = website ? WEBSITE_LEADS * p.mix * penaltyFor((generationOf(year) - designYear) / 4) : 0;
        paidBy[i] += paid;
        const leads = Math.min(organic + referrals, cap) + (paid + site) * (1 - SPILL_SHARE);
        book_("organic", organic); book_("referrals", referrals); book_("paid", paid); book_("website", site); book_("leads", leads); book_("cap", cap);
        book_("city" + c, leads);
        PRODUCTS.forEach((pr, k) => { newCustomers[i][k] += binomial(rng, Math.round(leads * wants(p, pr)), share(p, pr)); });
      });
    }
    // Awareness (Marketing and reviews): paid leads, the website, the review score, the free listing's trust and happy customers.
    const score = (3.5 * 20 + reviewSum) / (20 + reviewN);
    PROFILES.forEach((_, i) => {
      const happy = PRODUCTS.reduce((a, _, k) => a + happyOf(i, k), 0);
      const g = 0.05 * (1 - Math.exp(-paidBy[i] / 100)) + (website ? 0.004 : 0) + 0.006 * (score - 3.5)
        + 0.001 * (website ? PLATFORMS.free.trust : 0) + Math.min(0.01, 0.0005 * happy);
      aware[i] = Math.min(1, Math.max(0.02, aware[i] + (1 - aware[i]) * g - 0.02 * aware[i]));
    });

    // Capacity, like the live game: every product books RAM, the cluster keeps RAM for its control planes, and while the
    // company is in the basement the home line's upload caps the evening peak.
    const level0 = level - 1;
    const debt = () => loans.reduce((a, l) => a + l.balance, 0);
    const ramNeeded = (extra: number[][]) => PROFILES.reduce((a, p, i) => a + PRODUCTS.reduce((b, pr, k) => b + (cohorts[i][k].n + extra[i][k]) * ramOf(p, pr, year), 0), 0);
    const ramHave = () => servers.reduce((a, s) => a + s.ramGb, 0) - CONTROL_RAM;
    const cpuNeeded = (extra: number[][]) => PROFILES.reduce((a, p, i) => a + PRODUCTS.reduce((b, pr, k) => b + (cohorts[i][k].n + extra[i][k]) * cpuOf(p, pr, year), 0), 0);
    const cpuHave = () => servers.reduce((a, s) => a + s.cores * CPU_PER_CORE, 0);
    const peakNeeded = (extra: number[][]) => PROFILES.reduce((a, _, i) => a + PRODUCTS.reduce((b, pr, k) => b + (cohorts[i][k].n + extra[i][k]) * peakMbit(pr, year), 0), 0);
    if (!rackUnlocked && month >= MOVE_MONTH && servers.length >= BASEMENT_SLOTS && knowHow >= 50 && cash > 1500 + MOVE.sameCity.price) {
      // The move: the basement servers ride along to the rack share and the home line is cancelled.
      rackUnlocked = true;
      cash -= 500 + MOVE.sameCity.price;
      for (const s of servers) s.basement = false;
    }
    // Steady capacity rule: buy whenever the cluster would be over 80% full and cash keeps €2,000 plus three instalments,
    // on the smallest preset loan over five years when cash is short. Out of the basement it leases the server when the
    // bank says no, taking the lowest monthly of the three lessors' offers.
    const owed = () => loans.reduce((a, l) => a + l.payment, 0) + leases.reduce((a, l) => a + l.payment, 0);
    // The live loan limit: the level's minimum or 12x the average monthly profit of the last six months, less debt.
    const limit = () => Math.max(MIN_LIMIT[level0], (12 * profits.reduce((a, b) => a + b, 0)) / 6) - debt();
    while (ramNeeded(newCustomers) > 0.8 * ramHave() || cpuNeeded(newCustomers) > 0.8 * cpuHave()) {
      const basement = !rackUnlocked;
      if (basement && servers.length >= BASEMENT_SLOTS) break;
      // In the datacenter the bot buys the line with the lowest price per GB it can fill, given the vCPUs its customers book per GB.
      const cpuPerGb = cpuNeeded(newCustomers) / Math.max(1, ramNeeded(newCustomers));
      const usable = (m: DeviceModel) => Math.min(m.server!.ramGb, (m.server!.cores * CPU_PER_CORE) / Math.max(cpuPerGb, 1e-6));
      const line = basement ? "compute" : (["compute", "memory"] as const).reduce((a, b) => shopPrice(gen, b, year) / usable(shopServer(gen, b)) < shopPrice(gen, a, year) / usable(shopServer(gen, a)) ? b : a);
      const g = serverOf(gen, line, month, basement), reserve = 2000 + 3 * owed();
      const short = g.price + reserve - cash, amount = LOAN_AMOUNTS.find((a) => a >= short);
      const rate = baseRate(year) + RISK_PREMIUM[level0] / 100, payment = amount ? annuity(amount, rate, 60) : 0;
      // Out of the basement the bot borrows only while all instalments stay under 60% of its recurring revenue.
      const affordable = (more: number) => basement || owed() + more <= 0.6 * lastMrr;
      if (short > 0 && amount && amount <= limit() && affordable(payment)) {
        loans.push({ balance: amount, payment, rate });
        cash += amount;
        book_("loans", amount);
      }
      if (cash < g.price + reserve) {
        if (basement) break;
        const offer = [0, 1, 2].map(() => {
          const factor = LEASE_FACTOR.min + rand(rng) * (LEASE_FACTOR.max - LEASE_FACTOR.min), months = LEASE_TERMS[Math.floor(rand(rng) * LEASE_TERMS.length)];
          return { payment: (g.price * factor) / months, months };
        }).sort((a, b) => a.payment - b.payment)[0];
        // Only an offer the new server pays for from its first month: 80% booked at last month's revenue per GB, less its running costs.
        if (offer.payment > 0.8 * usable(shopServer(gen, line)) * lastPerGb - lastRunning || cash < reserve) break;
        leases.push({ payment: offer.payment, until: month + offer.months });
        servers.push({ ...g, leasedUntil: month + offer.months });
        book_("leased", g.price);
        continue;
      }
      servers.push(g);
      cash -= g.price;
      book_("servers", g.price);
    }
    // The cheapest line with more upload once the basement's evening peak reaches 90% of its line.
    if (!rackUnlocked && peakNeeded(newCustomers) > 0.9 * line.up) {
      const better = HOME_LINES.filter((l) => l.staticIp && l.from <= year && l.up > line.up).sort((a, b) => a.monthly - b.monthly)[0];
      if (better) line = better;
    }
    const wonNow = newCustomers.flat().reduce((a, b) => a + b, 0);
    book_("won", wonNow);
    // Sales that don't fit the RAM, or the upload while in the basement, are lost.
    let ramFree = ramHave() - ramNeeded(PROFILES.map(() => PRODUCTS.map(() => 0)));
    let cpuFree = cpuHave() - cpuNeeded(PROFILES.map(() => PRODUCTS.map(() => 0)));
    let upFree = rackUnlocked ? Infinity : line.up - peakNeeded(PROFILES.map(() => PRODUCTS.map(() => 0)));
    PROFILES.forEach((p, i) => PRODUCTS.forEach((pr, k) => {
      const fit = Math.max(0, Math.min(newCustomers[i][k], Math.floor(ramFree / ramOf(p, pr, year)), Math.floor(cpuFree / cpuOf(p, pr, year)), Math.floor(upFree / peakMbit(pr, year))));
      newCustomers[i][k] = fit;
      ramFree -= fit * ramOf(p, pr, year);
      cpuFree -= fit * cpuOf(p, pr, year);
      upFree -= fit * peakMbit(pr, year);
    }));
    book_("fit", newCustomers.flat().reduce((a, b) => a + b, 0));
    const vpsTotal = PROFILES.reduce((a, _, i) => a + cohorts[i][1].n + cohorts[i][2].n, 0);

    // Work queues (Tickets and work rates; Billing back-office tasks).
    const customers = PROFILES.reduce((a, _, i) => a + cohorts[i].reduce((b, c) => b + c.n, 0), 0);
    let ticketLoad = 0;
    PROFILES.forEach((p, i) => PRODUCTS.forEach((_, k) => {
      ticketLoad += cohorts[i][k].n * (TICKETS_PER_CUSTOMER[p.skill] + UPGRADE_CHANCE[p.budget] + p.churn);
    }));
    support.forEach((w) => grow(w, month));
    books.forEach((w) => grow(w, month));
    const routineOf = (kind: ChadKind) => PROFILES.reduce((a, p, i) => a + cohorts[i].reduce((b, c) => b + c.n, 0) * MONTHLY_RATES[kind][p.budget], 0);
    const routine = routineOf("howTo") + routineOf("billing"), howToShare = routineOf("howTo") / Math.max(routine, 1);
    const mix = (f: (k: ChadKind) => number) => howToShare * f("howTo") + (1 - howToShare) * f("billing");
    // ChadGPT replies up to BOT_TRIES times per ticket, each reply billed, and leaves the unsolved rest in the queue.
    const botTickets = chad ? Math.min(BOT_SPEED * 730 * tasksPerHour(TICKET_MINUTES, 50) / mix((k) => botOdds(k).attempts), routine * (1 + backlogT / Math.max(1, ticketLoad))) : 0;
    const botT = botTickets * mix((k) => botOdds(k).solved);
    const staffT = support.reduce((a, w) => a + STAFF_HOURS_PER_MONTH * tasksPerHour(TICKET_MINUTES, w.skill), 0);
    const playerT = Math.min(bot.playerHours * tasksPerHour(TICKET_MINUTES, 50), Math.max(0, ticketLoad + backlogT - botT));
    const capT = staffT + playerT + botT;
    const hoursLeft = bot.playerHours - playerT / tasksPerHour(TICKET_MINUTES, 50);
    const capP = books.reduce((a, w) => a + STAFF_HOURS_PER_MONTH * tasksPerHour(PAYMENT_MINUTES, w.skill), 0)
      + hoursLeft * tasksPerHour(PAYMENT_MINUTES, 50);
    backlogT = Math.max(0, backlogT + ticketLoad - capT);
    backlogP = Math.max(0, backlogP + customers - capP);
    waitHours = 4 + (backlogT / Math.max(capT, 1)) * 730;
    const processed = customers ? Math.min(1, capP / Math.max(customers, 1)) : 1;
    const avgSkill = support.length ? support.reduce((a, w) => a + w.skill, 0) / support.length : 100;
    const pRight = support.length || chad ? (playerT + staffT * (0.75 + 0.25 * avgSkill / 100) + botT * mix((k) => BOT_RIGHT[k])) / Math.max(capT, 1) : 1;

    // Failures: each failed server takes its VPS share down for the repair.
    const failures = binomial(rng, vpsServers, SERVER_AFR / 12);
    const vpsPerServer = vpsTotal / Math.max(1, vpsServers);
    const downHours = failures * REPAIR_HOURS * vpsPerServer;
    downFrac = 0.66 * downFrac + 0.34 * (downHours / Math.max(1, vpsTotal * 730));
    const hitShare = Math.min(1, (failures * vpsPerServer) / Math.max(1, vpsTotal));

    // Happiness events, drift and churn (Happiness and churn).
    let cancels = 0, reviewsStars = 0, reviewsCount = 0;
    PROFILES.forEach((p, i) => PRODUCTS.forEach((pr, k) => {
      const c = cohorts[i][k];
      if (c.n === 0 && newCustomers[i][k] === 0) return;
      const tpc = TICKETS_PER_CUSTOMER[p.skill];
      c.H -= Math.min(40, tpc * p.waitPenalty * beyond(p.reply, waitHours + (p.reply.clock === "always" ? OFF_HOURS_WAIT : 0)));
      c.H += tpc * (5 * pRight - 10 * (1 - pRight));
      // Only the hours after the customer noticed the repair count (economy.md, Noticing outages).
      if (pr !== "web") c.H -= hitShare * p.outagePenalty * noticedHours(pr === "game" ? "game" : BUSINESS_IDS.includes(p.id) ? "business" : "private", REPAIR_HOURS);
      // Overpricing against a fair price and the cohort's average maximum (economy.md, Price tolerance).
      const pct = (limit: number) => Math.max(0, 100 * (bot.priceFactor / limit - 1));
      c.H -= OVER_DRIFT * pct(Math.max(1, OFFER[p.budget])) + PAST_MAX_DRIFT * pct(p.cap * (TOLERANCE[0] + TOLERANCE[1]) / 2);
      const target = Math.min(95, Math.max(20, 70 + 0.5 * (U(p, pr, 0) - best(p, pr))));
      c.H += 0.2 * (target - c.H);
      c.H = Math.min(100, Math.max(0, c.H));
      const pCancel = Math.min(1, p.churn + 0.5 * Math.max(0, (50 - c.H) / 50));
      const gone = binomial(rng, c.n, pCancel);
      cancels += gone;
      if (gone) book_("churnNatural", (gone * p.churn) / pCancel);
      const stars = Math.min(5, Math.max(1, 1 + (4 * c.H) / 100));
      const written = c.n * tpc * 0.05 + gone * 0.3 + (pr !== "web" ? c.n * hitShare * 0.1 : 0);
      reviewsStars += written * stars;
      reviewsCount += written;
      const add = newCustomers[i][k];
      c.H = c.n - gone + add > 0 ? ((c.n - gone) * c.H + add * 70) / (c.n - gone + add) : 70;
      c.n = c.n - gone + add;
    }));
    book_("cancels", cancels);
    reviewSum = reviewSum * (23 / 24) + reviewsStars;
    reviewN = reviewN * (23 / 24) + reviewsCount;

    // Money.
    let mrr = 0, collectedShare = 0, stuck = 0;
    PROFILES.forEach((p, i) => PRODUCTS.forEach((pr, k) => {
      const v = cohorts[i][k].n * priceOf(p, pr, year) * bot.priceFactor;
      mrr += v;
      collectedShare += v * (ON_TIME[p.budget] + (1 - ON_TIME[p.budget] - NEVER_PAYS[p.budget]) * processed);
      stuck += v * (1 - ON_TIME[p.budget] - NEVER_PAYS[p.budget]) * (1 - processed);
      // The bot places every order on acceptance, as a company with automatic orders would; the quote and setup steps done by
      // hand are the happiness harness's. The order form bills its standard orders the market's setup fee once; big budgets and email orders pay none.
      if (website && p.budget !== "high") collectedShare += newCustomers[i][k] * (1 - EMAIL_SHARE) * marketSetup(LIVE[pr], year) * ON_TIME[p.budget];
    }));
    const inBasement = servers.filter((s) => s.basement);
    const inDc = servers.filter((s) => !s.basement);
    const rated = inDc.reduce((a, s) => a + s.watts, 0);
    const power = inBasement.length * (BASEMENT_WATTS / 1000) * 730 * businessPowerPrice(yf) * 1.6
      + (DRAW_SHARE * rated / 1000) * 730 * businessPowerPrice(yf) * HOME_DC.powerFactor;
    const space = inDc.length ? rackRent(rated) : 0;
    const bandwidth = rackUnlocked ? PROFILES.reduce((a, _, i) => a + PRODUCTS.reduce((b, pr, k) => b + cohorts[i][k].n * monthlyGb(pr, year), 0), 0) / 1000 * dcPerTb(year) : 0;
    // Loan instalments: interest is a cost, principal only moves cash.
    let instalments = 0, interest = 0;
    for (const l of loans) {
      const pay = Math.min(l.payment, l.balance * (1 + l.rate / 12));
      interest += l.balance * (l.rate / 12);
      l.balance = Math.max(0, l.balance * (1 + l.rate / 12) - pay);
      instalments += pay;
    }
    for (let l = loans.length - 1; l >= 0; l--) if (loans[l].balance < 0.01) loans.splice(l, 1);
    const salaries = support.reduce((a, w) => a + monthlySalary("support", w.skill, year), 0)
      + books.reduce((a, w) => a + monthlySalary("bookkeeper", w.skill, year), 0);
    const leasing = leases.reduce((a, l) => a + l.payment, 0);
    for (let l = leases.length - 1; l >= 0; l--) if (leases[l].until <= month + 1) leases.splice(l, 1);
    const depreciation = servers.reduce((a, s) => a + (!s.leasedUntil && month - s.bought < 60 ? s.price / 60 : 0), 0);
    const marketing = website ? OWNED.website.upkeep + OWNED.orderForm.upkeep + SITE_RENT : 0;
    // Domain registration: the registrar bills one twelfth of the yearly wholesale of the company domain and of the domains of web
    // customers who ordered by email, who pay the yearly fee in return. The company books Hosted Exchange for the owner and every
    // employee (Company email).
    const customerDomains = PROFILES.reduce((a, _, i) => a + cohorts[i][0].n, 0) * (website ? EMAIL_SHARE : 1), domains = 1 + customerDomains;
    const domainBill = (domains * registryCost("x.de", year) * factorFor(REGISTRARS[0], "de", tierFor(domains)) - customerDomains * DOMAIN_FEE) / 12;
    const mailBill = (1 + support.length + books.length) * providerById("hostedExchange")!.price(year);
    const chadPrice = chad ? subscriptionPrice(CHAD, year) + botTickets * mix((k) => costPerTicket(k, year)) : 0;
    // Every VPS and game server holds an address: extra business line addresses in the basement, provider addresses (one
    // per server too) in a datacenter.
    const ownAddresses = PROFILES.reduce((a, _, i) => a + cohorts[i][1].n + cohorts[i][2].n, 0);
    const addresses = rackUnlocked
      ? (ownAddresses + servers.length) * providerV4(year, ownAddresses + servers.length)
      : Math.max(0, ownAddresses - (STATIC_LINE_ADDRESSES - 1)) * LINE_EXTRA_V4;
    book_("addresses", addresses);
    const opex = chadPrice + leasing + power + space + cityRents + bandwidth + salaries + adSpent + marketing + domainBill + mailBill + addresses + (rackUnlocked ? 0 : line.monthly);
    cash += collectedShare - opex - instalments;
    profits.push(collectedShare - opex - interest - servers.filter((x) => x.bought === month && !x.leasedUntil).reduce((a, x) => a + x.price, 0));
    if (profits.length > 6) profits.shift();
    book_("instalments", instalments);
    book_("collected", collectedShare); book_("leasing", leasing); book_("space", space + cityRents); book_("bandwidth", bandwidth); book_("power", power);
    book_("salaries", salaries); book_("ads", adSpent); book_("chad", chadPrice); book_("domains", domainBill); book_("mail", mailBill);
    yearProfit += collectedShare - opex - depreciation - interest;
    if (month % 12 === 3 && yearProfit > 0) { cash -= TAX_RATE * yearProfit; book_("tax", TAX_RATE * yearProfit); }
    if (month % 12 === 3) yearProfit = 0;
    lastMrr = mrr;
    lastPerGb = mrr / Math.max(1, ramNeeded(PROFILES.map(() => PRODUCTS.map(() => 0))));
    lastRunning = (power + space + bandwidth) / Math.max(1, servers.length);

    // Staff decisions: hire when the queue is more than a day old.
    knowHow += PROFILES.reduce((a, _, i) => a + PRODUCTS.reduce((b, pr, k) => b + cohorts[i][k].n * KNOW[pr], 0), 0);
    // ChadGPT once support runs behind and cash covers three months of it.
    if (!chad && knowHow >= CHAD_KNOW_HOW && backlogT > 0 && cash > 3 * subscriptionPrice(CHAD, year)) chad = true;
    if (bot.hires && !hireUnlocked && knowHow >= 100 && cash > 3000) { hireUnlocked = true; cash -= 1000; }
    if (bot.hires && hireUnlocked) {
      // Hire only when this month's capacity can't clear the load plus a third of the backlog.
      if (backlogT > capT / 30 && ticketLoad + backlogT / 3 > capT && cash > 3 * monthlySalary("support", 50, year)) support.push(hire(rng, month));
      // A bookkeeper when the late payments nobody chases are worth more than the salary.
      const bookkeeper = monthlySalary("bookkeeper", 50, year);
      if (stuck > bookkeeper && cash > 2 * bookkeeper) books.push(hire(rng, month));
    }
    for (const team of [support, books]) for (let w = team.length - 1; w >= 0; w--) if (rand(rng) < 0.005) team.splice(w, 1);
    for (let s = servers.length - 1; s >= 0; s--) if (month - servers[s].bought > 72) {
      servers.splice(s, 1);
    }

    // Levels (Net worth and level thresholds) and expansion to more cities.
    // Hardware counts at its resale value, as metrics.ts values it (60-infra/status.ts, resaleValue).
    const resale = (age: number) => (age <= 1 ? 1 - 0.2 * age : Math.max(0.2, 0.8 - (0.6 * (age - 1)) / 24));
    const book = servers.reduce((a, s) => a + ((s.leasedUntil ?? 0) > month + 1 ? 0 : s.price * resale(month + 1 - s.bought)), 0);
    const netWorth = cash - debt() + book + 24 * mrr;
    const next = LEVELS[level];
    if (next && netWorth >= next.netWorth && month / 12 >= next.years) {
      level++;
      levelYear[level] = yf;
    }
    // Two cities at level 3, four at level 4 and every city from level 5, when the late game's cash sits idle.
    const wantCities = level <= 2 ? 1 : level === 3 ? 2 : level === 4 ? 4 : CITIES.length;
    // A new city gets the rack share and a memory-optimized server for its own cluster.
    while (cities < wantCities && cash > 10000 + shopPrice(gen, "memory", year)) {
      servers.push(serverOf(gen, "memory", month, false));
      cash -= shopPrice(gen, "memory", year);
      book_("servers", shopPrice(gen, "memory", year));
      cityRents += cityRent(CITY_ORDER[cities].name);
      cities++;
    }

    minCash = Math.min(minCash, cash);
    negMonths = cash < 0 ? negMonths + 1 : 0;
    if (negMonths >= 2) bankrupt = true;

    if (month % 12 === 11) {
      Object.assign(flow, { aware: 1000 * PROFILES.reduce((a, p, i) => a + p.mix * aware[i], 0), cities, cash, debt: debt(), netWorth, nServers: servers.length, ramUsed: ramNeeded(PROFILES.map(() => PRODUCTS.map(() => 0))), ramHave: ramHave() });
      rows.push({ year, level, customers: Math.round(customers), mrr: Math.round(mrr), minCash: Math.round(minCash), staff: support.length + books.length, flow });
      minCash = cash;
      flow = {};
    }
  }
  return { bot: bot.name, seed, rows, levelYear, bankrupt };
}
