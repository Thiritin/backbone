// Monthly cohort model of docs/design/economy.md for the headless balance run.
// ponytail: customers are cohorts per profile and product with one average happiness; per-customer sim comes with the real tick.
import { binomial, createRng, rand, type Rng } from "../00-core/rng";
import { WORK_SHARE, type Patience } from "../00-core/workhours";
import {
  BASEMENT_SLOTS, BUDGET_SIZE, businessPowerPrice, CHOICE_TAU, CITIES, COMPETITORS, generationAt, GENERATIONS,
  KNOW_HOW, LEAD_CAP_SHARE, ORGANIC_BASE, LEVELS, MARKET_GROWTH, monthlySalary, NEVER_PAYS, ON_TIME, PAYMENT_MINUTES, PROFILES,
  RACK_U_PER_MONTH, REPAIR_HOURS, RESOLD_COST_SHARE, SEARCH_AD_COST, SERVER_AFR, STAFF_HOURS_PER_MONTH, START_CASH,
  TAX_RATE, TICKET_MINUTES, TICKETS_PER_CUSTOMER, UPGRADE_CHANCE, priceAt, tasksPerHour, vpsPlanGb, vpsRatePerGb,
  WEB_BASE, type ProductId, type Profile,
} from "../10-catalog/economy";
import { HOME_LINES } from "../20-world/datacenters";
import { OVER_DRIFT, PAST_MAX_DRIFT, TOLERANCE } from "../30-customers/pricing";
import { OFFER } from "../30-market/market";
import { annuity, baseRate, LOAN_AMOUNTS, MIN_LIMIT, RISK_PREMIUM } from "../45-billing/billing";

// Average hours a ticket written at a random hour waits for the office to open: four 16-hour nights and a 64-hour weekend.
const OFF_HOURS_WAIT = (4 * 16 ** 2 + 64 ** 2) / 2 / 168;

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
interface Server { gen: number; ramGb: number; bought: number; price: number; basement: boolean }
interface Loan { balance: number; payment: number; rate: number }
type Product = ProductId | "game";
interface Worker { skill: number; hired: number; cap: number }

export interface YearRow { year: number; level: number; customers: number; mrr: number; minCash: number; staff: number; flow: Record<string, number> }
export interface RunResult { bot: string; seed: number; rows: YearRow[]; levelYear: Record<number, number>; bankrupt: boolean }

const PRODUCTS: Product[] = ["web", "vps", "game"];
const MONTHS = 12;
// Live rules (10-catalog/products.ts): a web space books 0.25 GB in a panel VM, a game server 4 GB of the year's plan
// at 1.6x the VPS rate per GB. Gamers ask for a game server 60% of the time (30-market/market.ts, NEEDS).
const WEB_RAM = 0.25, GAME_RAM = 4, GAME_RATE = 1.6, GAME_SHARE = 0.6;
// RAM per cluster for the hypervisor and the panel VM's own panel.
const CONTROL_RAM = 1;
// A basement server's average draw and the evening peak over a service's mean traffic (Traffic and bandwidth).
const BASEMENT_WATTS = 150, PEAK_FACTOR = 2;
const KNOW: Record<Product, number> = { ...KNOW_HOW, game: 1.5 };
const TRAFFIC: Record<Product, number> = { web: 2, vps: 20, game: 60 };

const priceOf = (p: Profile, product: Product, year: number): number =>
  product === "web" ? WEB_BASE * BUDGET_SIZE[p.budget]
    : product === "game" ? GAME_RATE * vpsRatePerGb(year) * GAME_RAM * vpsPlanGb(year) * BUDGET_SIZE[p.budget]
    : vpsRatePerGb(year) * vpsPlanGb(year) * BUDGET_SIZE[p.budget];
const ramOf = (p: Profile, product: Product, year: number): number =>
  product === "web" ? WEB_RAM : (product === "game" ? GAME_RAM : 1) * vpsPlanGb(year) * BUDGET_SIZE[p.budget];
// Mbit/s a customer sends at the evening peak; traffic grows 20% a year like the live TRAFFIC_GROWTH.
const peakMbit = (product: Product, year: number): number => (TRAFFIC[product] * Math.pow(1.2, year - 2005) * 8000) / (730 * 3600) * PEAK_FACTOR;
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
  const servers: Server[] = [{ gen: 0, ramGb: GENERATIONS[0].ramGb, bought: 0, price: GENERATIONS[0].price, basement: true }];
  const loans: Loan[] = [];
  let line = HOME_LINES[0];
  const support: Worker[] = [];
  const books: Worker[] = [];
  let cash = START_CASH, minCash = cash, level = 1, knowHow = 0, cities = 1, rackUnlocked = false, hireUnlocked = false;
  let backlogT = 0, backlogP = 0, waitHours = 4, downFrac = 0, lastMrr = 0, yearProfit = 0, negMonths = 0, bankrupt = false;
  let reviewSum = 0, reviewN = 0;
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

    // Leads (Market and leads): organic and paid per location city, referrals from happy customers.
    const adBudget = cash > 3000 ? bot.adShare * lastMrr : 0;
    let adSpent = 0;
    const newCustomers: number[][] = PROFILES.map(() => PRODUCTS.map(() => 0));
    for (let c = 0; c < cities; c++) {
      const market = CITIES[c].market * Math.pow(1 + MARKET_GROWTH, yf - 2005);
      const citySpend = adBudget / cities;
      PROFILES.forEach((p, i) => {
        const organic = ORGANIC_BASE.value * (1 + 0.5 * (level - 1)) * revMult * p.mix;
        const referrals = c === 0 ? PRODUCTS.reduce((a, _, k) => a + cohorts[i][k].n * Math.min(1, Math.max(0, (cohorts[i][k].H - 50) / 40)), 0) * 0.005 * revMult : 0;
        const spend = citySpend * p.mix;
        const cpl = priceAt(SEARCH_AD_COST[p.budget], 0.6, year) * (1 + citySpend / 5000);
        const paid = spend / cpl;
        adSpent += spend;
        const leads = Math.min(organic + referrals + paid, LEAD_CAP_SHARE * market * p.mix);
        PRODUCTS.forEach((pr, k) => { newCustomers[i][k] += binomial(rng, Math.round(leads * wants(p, pr)), share(p, pr)); });
      });
    }

    // Capacity, like the live game: every product books RAM, the cluster keeps RAM for its control planes, and while the
    // company is in the basement the home line's upload caps the evening peak.
    const level0 = level - 1;
    const debt = () => loans.reduce((a, l) => a + l.balance, 0);
    const ramNeeded = (extra: number[][]) => PROFILES.reduce((a, p, i) => a + PRODUCTS.reduce((b, pr, k) => b + (cohorts[i][k].n + extra[i][k]) * ramOf(p, pr, year), 0), 0);
    const ramHave = () => servers.reduce((a, s) => a + s.ramGb, 0) - CONTROL_RAM;
    const peakNeeded = (extra: number[][]) => PROFILES.reduce((a, _, i) => a + PRODUCTS.reduce((b, pr, k) => b + (cohorts[i][k].n + extra[i][k]) * peakMbit(pr, year), 0), 0);
    if (!rackUnlocked && servers.length >= BASEMENT_SLOTS && knowHow >= 50 && cash > 1500) { rackUnlocked = true; cash -= 500; }
    // Steady capacity rule: buy whenever the cluster would be over 80% full and cash keeps €2,000 plus three instalments,
    // on the smallest preset loan over five years when cash is short.
    while (ramNeeded(newCustomers) > 0.8 * ramHave()) {
      const basement = !rackUnlocked;
      if (basement && servers.length >= BASEMENT_SLOTS) break;
      const g = GENERATIONS[gen], reserve = 2000 + 3 * loans.reduce((a, l) => a + l.payment, 0);
      const short = g.price + reserve - cash, amount = LOAN_AMOUNTS.find((a) => a >= short);
      const rate = baseRate(year) + RISK_PREMIUM[level0] / 100, payment = amount ? annuity(amount, rate, 60) : 0;
      // Out of the basement the bot borrows only while all instalments stay under 60% of its recurring revenue.
      const affordable = basement || loans.reduce((a, l) => a + l.payment, 0) + payment <= 0.6 * lastMrr;
      if (short > 0 && amount && amount <= MIN_LIMIT[level0] - debt() && affordable) {
        loans.push({ balance: amount, payment, rate });
        cash += amount;
        book_("loans", amount);
      }
      if (cash < g.price + reserve) break;
      servers.push({ gen, ramGb: g.ramGb, bought: month, price: g.price, basement });
      cash -= g.price;
      book_("servers", g.price);
    }
    // The cheapest line with more upload once the basement's evening peak reaches 90% of its line.
    if (!rackUnlocked && peakNeeded(newCustomers) > 0.9 * line.up) {
      const better = HOME_LINES.filter((l) => l.from <= year && l.up > line.up).sort((a, b) => a.monthly - b.monthly)[0];
      if (better) line = better;
    }
    // Sales that don't fit the RAM, or the upload while in the basement, are lost.
    let ramFree = ramHave() - ramNeeded(PROFILES.map(() => PRODUCTS.map(() => 0)));
    let upFree = rackUnlocked ? Infinity : line.up - peakNeeded(PROFILES.map(() => PRODUCTS.map(() => 0)));
    PROFILES.forEach((p, i) => PRODUCTS.forEach((pr, k) => {
      const fit = Math.max(0, Math.min(newCustomers[i][k], Math.floor(ramFree / ramOf(p, pr, year)), Math.floor(upFree / peakMbit(pr, year))));
      newCustomers[i][k] = fit;
      ramFree -= fit * ramOf(p, pr, year);
      upFree -= fit * peakMbit(pr, year);
    }));
    const vpsTotal = PROFILES.reduce((a, _, i) => a + cohorts[i][1].n + cohorts[i][2].n, 0);

    // Work queues (Tickets and work rates; Billing back-office tasks).
    const customers = PROFILES.reduce((a, _, i) => a + cohorts[i].reduce((b, c) => b + c.n, 0), 0);
    let ticketLoad = 0;
    PROFILES.forEach((p, i) => PRODUCTS.forEach((_, k) => {
      ticketLoad += cohorts[i][k].n * (TICKETS_PER_CUSTOMER[p.skill] + UPGRADE_CHANCE[p.budget] + p.churn);
    }));
    support.forEach((w) => grow(w, month));
    books.forEach((w) => grow(w, month));
    const staffT = support.reduce((a, w) => a + STAFF_HOURS_PER_MONTH * tasksPerHour(TICKET_MINUTES, w.skill), 0);
    const playerT = Math.min(bot.playerHours * tasksPerHour(TICKET_MINUTES, 50), ticketLoad + backlogT);
    const capT = staffT + playerT;
    const hoursLeft = bot.playerHours - playerT / tasksPerHour(TICKET_MINUTES, 50);
    const capP = books.reduce((a, w) => a + STAFF_HOURS_PER_MONTH * tasksPerHour(PAYMENT_MINUTES, w.skill), 0)
      + hoursLeft * tasksPerHour(PAYMENT_MINUTES, 50);
    backlogT = Math.max(0, backlogT + ticketLoad - capT);
    backlogP = Math.max(0, backlogP + customers - capP);
    waitHours = 4 + (backlogT / Math.max(capT, 1)) * 730;
    const processed = customers ? Math.min(1, capP / Math.max(customers, 1)) : 1;
    const avgSkill = support.length ? support.reduce((a, w) => a + w.skill, 0) / support.length : 100;
    const pRight = support.length ? (playerT + staffT * (0.75 + 0.25 * avgSkill / 100)) / Math.max(capT, 1) : 1;

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
      if (pr !== "web") c.H -= hitShare * p.outagePenalty * beyond(p.tolerance, REPAIR_HOURS);
      // Overpricing against a fair price and the cohort's average maximum (economy.md, Price tolerance).
      const pct = (limit: number) => Math.max(0, 100 * (bot.priceFactor / limit - 1));
      c.H -= OVER_DRIFT * pct(Math.max(1, OFFER[p.budget])) + PAST_MAX_DRIFT * pct(p.cap * (TOLERANCE[0] + TOLERANCE[1]) / 2);
      const target = Math.min(95, Math.max(20, 70 + 0.5 * (U(p, pr, 0) - best(p, pr))));
      c.H += 0.2 * (target - c.H);
      c.H = Math.min(100, Math.max(0, c.H));
      const pCancel = Math.min(1, p.churn + 0.5 * Math.max(0, (50 - c.H) / 50));
      const gone = binomial(rng, c.n, pCancel);
      cancels += gone;
      const stars = Math.min(5, Math.max(1, 1 + (4 * c.H) / 100));
      const written = c.n * tpc * 0.05 + gone * 0.3 + (pr !== "web" ? c.n * hitShare * 0.1 : 0);
      reviewsStars += written * stars;
      reviewsCount += written;
      const add = newCustomers[i][k];
      c.H = c.n - gone + add > 0 ? ((c.n - gone) * c.H + add * 70) / (c.n - gone + add) : 70;
      c.n = c.n - gone + add;
    }));
    reviewSum = reviewSum * (23 / 24) + reviewsStars;
    reviewN = reviewN * (23 / 24) + reviewsCount;

    // Money.
    let mrr = 0, resold = 0, collectedShare = 0, stuck = 0;
    PROFILES.forEach((p, i) => PRODUCTS.forEach((pr, k) => {
      const v = cohorts[i][k].n * priceOf(p, pr, year) * bot.priceFactor;
      mrr += v;
      if (pr === "web") resold += cohorts[i][k].n * WEB_BASE * BUDGET_SIZE[p.budget] * RESOLD_COST_SHARE;
      collectedShare += v * (ON_TIME[p.budget] + (1 - ON_TIME[p.budget] - NEVER_PAYS[p.budget]) * processed);
      stuck += v * (1 - ON_TIME[p.budget] - NEVER_PAYS[p.budget]) * (1 - processed);
    }));
    const inBasement = servers.filter((s) => s.basement);
    const power = inBasement.length * (BASEMENT_WATTS / 1000) * 730 * businessPowerPrice(yf) * 1.6;
    const space = (servers.length - inBasement.length) * RACK_U_PER_MONTH;
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
    const depreciation = servers.reduce((a, s) => a + (month - s.bought < 60 ? s.price / 60 : 0), 0);
    const opex = resold + power + space + salaries + adSpent + (rackUnlocked ? 0 : line.monthly);
    cash += collectedShare - opex - instalments;
    book_("instalments", instalments);
    book_("collected", collectedShare); book_("resold", resold); book_("space", space); book_("power", power);
    book_("salaries", salaries); book_("ads", adSpent);
    yearProfit += collectedShare - opex - depreciation - interest;
    if (month % 12 === 3 && yearProfit > 0) { cash -= TAX_RATE * yearProfit; book_("tax", TAX_RATE * yearProfit); }
    if (month % 12 === 3) yearProfit = 0;
    lastMrr = mrr;

    // Staff decisions: hire when the queue is more than a day old.
    knowHow += PROFILES.reduce((a, _, i) => a + PRODUCTS.reduce((b, pr, k) => b + cohorts[i][k].n * KNOW[pr], 0), 0);
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
    const book = servers.reduce((a, s) => a + s.price * resale(month + 1 - s.bought), 0);
    const netWorth = cash - debt() + book + 24 * mrr;
    const next = LEVELS[level];
    if (next && netWorth >= next.netWorth && month / 12 >= next.years) {
      level++;
      levelYear[level] = yf;
    }
    const wantCities = Math.min(CITIES.length, level <= 2 ? 1 : [0, 0, 0, 2, 4, 6, 8][level]);
    while (cities < wantCities && cash > 10000) { cities++; cash -= 2000; }

    minCash = Math.min(minCash, cash);
    negMonths = cash < 0 ? negMonths + 1 : 0;
    if (negMonths >= 2) bankrupt = true;

    if (month % 12 === 11) {
      rows.push({ year, level, customers: Math.round(customers), mrr: Math.round(mrr), minCash: Math.round(minCash), staff: support.length + books.length, flow });
      minCash = cash;
      flow = {};
    }
  }
  return { bot: bot.name, seed, rows, levelYear, bankrupt };
}
