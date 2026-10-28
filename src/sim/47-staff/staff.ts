import { hashRng, rand, type Rng } from "../00-core/rng";
import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import { monthlySalary, priceAt } from "../10-catalog/economy";
import { cents, dueStep, ruleStep, ruleSuspendsAt, rulesAutomated, sendStep, STEPS, suspend, type Invoice } from "../45-billing/billing";
import { ACTION_MINUTES, logActivity } from "./activity";
import { storeItem } from "../10-catalog/store";
import { bump, createTicket, MINUTES, rightTemplate, TEMPLATES, type Ticket, type TicketKind } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { isWorkHour } from "../00-core/workhours";
import { orderError } from "../30-market/orders";
import { orderMinutes, staffOrderStep } from "../30-market/manual";

export type Role = "support" | "bookkeeper" | "accountant" | "marketing" | "technician";
export type Task = TicketKind | "reminder" | "dunning" | "final" | "suspend" | "campaigns" | "reviews" | "fairs" | "hardware" | "servers" | "panels";
// queue: works the role's tasks. trainer: trains colleagues of the same role. forum: posts in hosting and gaming forums.
export type Assignment = "queue" | "trainer" | "forum";

// talent is the hidden cap skill never passes; busyUntil is in game minutes like the player's queue. location is the
// location id a technician works at, null for every other role. salary is the full-time salary; hours is the workday
// the player sets and hoursFrom the hour it was last changed, since when salary is owed at those hours.
export interface Employee {
  id: string; name: string; role: Role; skill: number; talent: number; salary: number; hiredAt: number; assignment: Assignment; location: string | null;
  trained: Task[]; plan: Task[]; training: { task: Task; startedAt: number; doneAt: number } | null; busyUntil: number;
  raise: { ask: number; at: number } | null; nextRaiseAt: number; refusedAt: number | null; hours: WorkHours; hoursFrom: number;
  // Set on the stand-ins activeBots builds for store bots; never saved.
  bot?: true;
}
export interface Candidate { id: string; name: string; role: Role; skill: number; talent: number; salary: number; arriveAt: number; leaveAt: number }

export const WORK_HOURS = [2, 4, 6, 8] as const;
export type WorkHours = (typeof WORK_HOURS)[number];
export const FULL_DAY = 8;

export const ROLES: Role[] = ["support", "bookkeeper", "accountant", "marketing", "technician"];
export const TASKS: Record<Role, Task[]> = {
  support: ["howTo", "billing", "outage", "upgrade", "cancellation", "abuse", "appeal", "order"],
  bookkeeper: ["reminder"],
  accountant: ["dunning", "final", "suspend"],
  marketing: ["campaigns", "reviews", "fairs"],
  // Hardware: part swaps and power. Servers: draining nodes. Panels: PHP upgrades.
  technician: ["hardware", "servers", "panels"],
};
// The task each dunning step needs, in STEPS order; whoever sends final notices also hands debts to collections.
const STEP_TASK: Task[] = ["reminder", "dunning", "final", "final"];

const DAY = 24, YEAR = 8760;
export const MARKET_PER_ROLE = 2;
export const CANDIDATE_DAYS = 30;
export const AD = { standard: { price: 500, candidates: 3 }, premium: { price: 2000, candidates: 8 } } as const;
export type AdTier = keyof typeof AD;
export const AD_DAYS = 14;
export const COURSE_PRICE = 250;
export const COURSE_HOURS = 2 * DAY;
export const TRAINER_HOURS = DAY;
export const RAISE_DAYS = 30;
export const FORUM_LEADS = 2;
// Staff costs follow the salary multiplier from Prices over time.
export const staffPrice = (p2026: number, year: number): number => Math.round(priceAt(p2026, 0.6, year));

const FIRST = ["Lena", "Jonas", "Mia", "Felix", "Hannah", "Lukas", "Emma", "Paul", "Sophie", "Leon", "Clara", "Finn", "Marie", "Noah", "Anna", "Elias", "Laura", "Ben", "Sarah", "Tim"];
const LAST = ["Fischer", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Braun", "Zimmermann", "Hartmann", "Krüger", "Lange", "Werner", "Krause", "Meier", "Lehmann"];

const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];

// economy.md, Hiring: 60% juniors (10 to 35), 30% mid-level (35 to 65), 10% seniors (65 to 90); talent between 60 and 100.
function candidate(r: Rng, id: string, role: Role, arriveAt: number): Candidate {
  const x = rand(r);
  const [lo, hi] = x < 0.6 ? [10, 35] : x < 0.9 ? [35, 65] : [65, 90];
  const skill = Math.round(lo + rand(r) * (hi - lo));
  const talent = Math.min(100, Math.max(skill + 5, Math.round(60 + rand(r) * 40)));
  return {
    id, name: `${pick(r, FIRST)} ${pick(r, LAST)}`, role, skill, talent,
    salary: Math.round(monthlySalary(role, skill, yearOf(arriveAt))), arriveAt, leaveAt: arriveAt + CANDIDATE_DAYS * DAY,
  };
}

// Open applications for every role, as they arrive at each month start and in a new game.
export function applications(seed: number, hour: number): Candidate[] {
  const r = hashRng(seed, hour, 47);
  return ROLES.flatMap((role, i) => Array.from({ length: MARKET_PER_ROLE }, (_, k) => candidate(r, `m${hour}-${i * MARKET_PER_ROLE + k}`, role, hour)));
}

const refreshMarket = (s: GameState): void => {
  s.candidates = [...s.candidates.filter((c) => c.leaveAt > s.hour), ...applications(s.seed, s.hour)];
};

// A job ad brings its candidates spread over two weeks.
export function adCandidates(s: GameState, role: Role, tier: AdTier): Candidate[] {
  const r = hashRng(s.seed, s.hour, s.nextId, 48);
  return Array.from({ length: AD[tier].candidates }, () => candidate(r, `cand${s.nextId++}`, role, s.hour + Math.floor(rand(r) * AD_DAYS * DAY)));
}

export const visibleCandidates = (s: GameState): Candidate[] => s.candidates.filter((c) => c.arriveAt <= s.hour && c.leaveAt > s.hour);
export const marketSalary = (e: Pick<Employee, "role" | "skill">, hour: number): number => Math.round(monthlySalary(e.role, e.skill, yearOf(hour)));
export const fullyTrained = (e: Employee): boolean => TASKS[e.role].every((k) => e.trained.includes(k));
export const needsTraining = (e: Employee): boolean => e.training !== null || e.plan.length > 0;
export const trainerFor = (s: GameState, e: Employee): Employee | undefined =>
  s.staff.find((x) => x.id !== e.id && x.role === e.role && x.assignment === "trainer");
// Employees in training and trainers do no queue work.
export const working = (e: Employee): boolean => e.assignment === "queue" && e.training === null;

const monthStart = (hour: number, offset = 0): number => {
  const d = dateOf(hour);
  return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)));
};

// Monthly pay at the employee's hours: 8 hours a day is the full salary.
export const monthlyPay = (e: Pick<Employee, "salary" | "hours">): number => (e.salary * e.hours) / FULL_DAY;

// Salary owed since the latest of the hire, the last change of hours and the start of the period, as a share of that month.
export function salaryOwed(e: Employee, from: number, to: number): number {
  const hours = to - Math.max(e.hiredAt, e.hoursFrom, from);
  return hours > 0 ? cents((monthlyPay(e) * hours) / (monthStart(from, 1) - from)) : 0;
}

export const salaryUpToNow = (s: GameState, e: Employee): number => salaryOwed(e, monthStart(s.hour), s.hour);

// Starts the next planned course: one day with a trainer of the same role and free, otherwise two days and a course fee.
export function startTraining(s: GameState, e: Employee): void {
  if (e.training || !e.plan.length) return;
  const [task, ...plan] = e.plan;
  const trainer = trainerFor(s, e);
  if (!trainer) {
    const price = staffPrice(COURSE_PRICE, yearOf(s.hour));
    s.cash = cents(s.cash - price);
    s.ledger = [...s.ledger, { hour: s.hour, category: "salaries", key: "ledger.training", params: { name: e.name, task }, amount: -price }];
  }
  e.plan = plan;
  e.training = { task, startedAt: s.hour, doneAt: s.hour + (trainer ? TRAINER_HOURS : COURSE_HOURS) };
}

// Staff work business hours.
export { isWorkHour };

// economy.md, AI bots. A bot works around the clock at a fixed rate and never learns.
export const BOTS: Record<string, { role: Role; tasks: Task[] }> = {
  chadGpt: { role: "support", tasks: ["howTo", "billing"] },
  clipsy: { role: "bookkeeper", tasks: ["reminder"] },
};
export const BOT_SPEED = 2;
export const BOT_RIGHT = 0.6;
// Chance per reminder that the customer writes in about it, and per task of something memorable.
export const BOT_SLIP = 0.05;
export const BOT_INCIDENT = 0.002;
export const BOT_INCIDENT_HAPPINESS = -15;
export const BOT_INCIDENTS = 5;

export const activeBots = (s: GameState): Employee[] => Object.entries(BOTS).filter(([id]) => s.installed.includes(id)).map(([id, b]) => ({
  id, name: storeItem(id)!.name, role: b.role, skill: 0, talent: 0, salary: 0, hiredAt: 0, assignment: "queue", location: null,
  trained: b.tasks, plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, hours: FULL_DAY, hoursFrom: 0, bot: true,
}));

// An employee works their hours from 9 in office hours; a bot works around the clock.
export const onShift = (e: Employee, hour: number): boolean => !!e.bot || (isWorkHour(hour) && dateOf(hour).getUTCHours() < 9 + e.hours);
const shiftEnd = (e: Employee, hour: number): number => (e.bot ? Infinity : (hour - dateOf(hour).getUTCHours() + 9 + e.hours) * 60);

// An employee at a trade fair does no other work for the fair's days.
export const atFair = (s: GameState, e: Employee): boolean => s.fairs.some((b) => b.employeeId === e.id && b.start <= s.hour && s.hour < b.end);

export const hasMarketingManager = (s: GameState): boolean => s.staff.some((e) => e.role === "marketing");
// The best working marketing manager trained on the task, or none.
const manager = (s: GameState, task: Task): Employee | undefined =>
  s.staff.filter((e) => e.role === "marketing" && working(e) && !atFair(s, e) && e.trained.includes(task)).sort((a, b) => b.skill - a.skill)[0];
// Share of a task's full effect the manager's workday covers; campaigns take their minutes before reviews.
// ponytail: each task's best manager is counted alone, as if nobody else shared the work.
function dayShare(e: Employee | undefined, task: "campaigns" | "reviews"): number {
  if (!e) return 0;
  const before = task === "reviews" && e.trained.includes("campaigns") ? ACTION_MINUTES.campaigns : 0;
  return Math.min(1, Math.max(0, e.hours * 60 - before) / ACTION_MINUTES[task]);
}
// Campaigns bring 5% to 15% more leads with a manager trained on them, by skill.
export const campaignBoost = (s: GameState): number => {
  const e = manager(s, "campaigns");
  return e ? 1 + (0.05 + 0.1 * (e.skill / 100)) * dayShare(e, "campaigns") : 1;
};
export const REVIEW_INVITE_BOOST = 1.5;
export const reviewBoost = (s: GameState): number => 1 + (REVIEW_INVITE_BOOST - 1) * dayShare(manager(s, "reviews"), "reviews");

const speed = (e: Employee) => (e.bot ? BOT_SPEED : 0.5 + e.skill / 100);
const rightChance = (e: Employee) => (e.bot ? BOT_RIGHT : 0.75 + 0.25 * (e.skill / 100));

// A support agent queues a reply or action on the ticket the same way the player does; finishWork in the support tick applies it.
function choose(s: GameState, e: Employee, t: Ticket, r: Rng): { op: "reply" | "resolve"; arg: string } {
  if (t.kind === "cancellation") return { op: "resolve", arg: "retain" };
  if (t.kind === "order") return { op: "resolve", arg: staffOrderStep(s, t, orderError(s, t)) ?? "accept" };
  const right = rightTemplate(s, t);
  if (!right) return { op: "resolve", arg: "unsuspend" };
  if (rand(r) < rightChance(e)) return { op: "reply", arg: right };
  return { op: "reply", arg: pick(r, TEMPLATES[t.kind].filter((x) => x !== right)) };
}

interface BotTask { bot: Employee; customerId: string; reminder: boolean }

// Books work of the given minutes if it starts within this hour and ends by the end of the workday; returns the minutes
// it took at the employee's speed, or null when it waits. Work that does not fit today waits for the next workday.
function take(s: GameState, e: Employee, minutes: number): number | null {
  const at = Math.max(e.busyUntil, s.hour * 60), took = minutes / speed(e);
  if (at >= (s.hour + 1) * 60 || at + took > shiftEnd(e, s.hour)) return null;
  e.busyUntil = at + took;
  return took;
}

function answerTickets(s: GameState, agents: Employee[], r: Rng): BotTask[] {
  const churned = new Set(s.customers.filter((c) => c.churnedAt !== null).map((c) => c.id));
  const queue = s.tickets.filter((t) => t.status === "open" && !t.work && !churned.has(t.customerId)).sort((a, b) => a.dueAt - b.dueAt);
  const taken = new Map<string, Ticket["work"]>(), byBot: BotTask[] = [];
  for (const e of agents) {
    for (const t of queue) {
      // An order that cannot be set up waits for the player.
      const step = t.kind === "order" ? staffOrderStep(s, t, orderError(s, t)) : null;
      if (taken.has(t.id) || !e.trained.includes(t.kind) || (t.kind === "order" && !step)) continue;
      const took = take(s, e, step ? orderMinutes(s, t, step, MINUTES.order) : MINUTES[t.kind]);
      if (took === null) continue;
      const work = { ...choose(s, e, t, r), doneAt: Math.ceil(e.busyUntil), by: e.name };
      taken.set(t.id, work);
      logActivity(s, { customerId: t.customerId, serviceId: t.serviceId, by: e.name, key: `activity.${work.op}`, params: { kind: t.kind, arg: work.arg }, minutes: took });
      if (e.bot) byBot.push({ bot: e, customerId: t.customerId, reminder: false });
    }
  }
  if (taken.size) s.tickets = s.tickets.map((t) => (taken.has(t.id) ? { ...t, work: taken.get(t.id)!, unread: false } : t));
  return byBot;
}

type BillingWork = { inv: Invoice; step: number } | { inv: Invoice; step: "suspend" };

// What the billing rules ask for now, in due-date order: the next dunning step before a suspension.
function ruleWork(s: GameState): BillingWork[] {
  const live = new Set(s.customers.filter((c) => c.churnedAt === null).map((c) => c.id));
  return [...s.invoices].sort((a, b) => a.dueAt - b.dueAt).flatMap((inv): BillingWork[] => {
    const step = ruleStep(s, inv), at = ruleSuspendsAt(s, inv);
    return [...(step !== null ? [{ inv, step }] : []), ...(at !== null && s.hour >= at && live.has(inv.customerId) ? [{ inv, step: "suspend" as const }] : [])];
  });
}

// Bots work their own tasks on everything due, whatever the rules say.
const botWork = (s: GameState): BillingWork[] => [...s.invoices].sort((a, b) => a.dueAt - b.dueAt)
  .flatMap((inv) => { const step = dueStep(inv, s.hour); return step !== null ? [{ inv, step }] : []; });

// Bookkeepers and accountants carry out the billing rules until the Automation research runs them; each action starts
// with checking the invoice. One action per invoice and hour.
function chaseInvoices(s: GameState, clerks: Employee[], events: SimEvent[]): BotTask[] {
  const staffWork = rulesAutomated(s) ? [] : ruleWork(s), forBots = clerks.some((e) => e.bot) ? botWork(s) : [];
  const done = new Set<string>(), byBot: BotTask[] = [];
  for (const e of clerks) {
    for (const { inv, step } of e.bot ? forBots : staffWork) {
      const task = step === "suspend" ? "suspend" : STEP_TASK[step], key = step === "suspend" ? "suspend" : STEPS[step].key;
      if (done.has(inv.id) || !e.trained.includes(task)) continue;
      const took = take(s, e, ACTION_MINUTES.checkInvoice + ACTION_MINUTES[key]);
      if (took === null) continue;
      done.add(inv.id);
      const copy = { ...inv }, c = s.customers.find((x) => x.id === inv.customerId);
      s.invoices = s.invoices.map((x) => (x.id === inv.id ? copy : x));
      if (step !== "suspend") sendStep(s, copy, step);
      else if (suspend(s, copy) && c) events.push({ app: "Billing", key: "event.suspended", params: { customer: c.name, invoice: inv.number } });
      if (copy.status === "writtenOff" && c) events.push({ app: "Billing", key: "event.collected", params: { customer: c.name, invoice: inv.number } });
      const share = took / (ACTION_MINUTES.checkInvoice + ACTION_MINUTES[key]);
      const log = (k: string, minutes: number) => logActivity(s, { customerId: inv.customerId, serviceId: null, by: e.name, key: `activity.${k}`, params: { invoice: inv.number }, minutes: minutes * share });
      log("checkInvoice", ACTION_MINUTES.checkInvoice);
      log(key, ACTION_MINUTES[key]);
      if (e.bot) byBot.push({ bot: e, customerId: inv.customerId, reminder: true });
    }
  }
  return byBot;
}

// A bot reminder sometimes confuses the customer into a billing ticket; once in a long while a bot does something memorable.
function botTrouble(s: GameState, events: SimEvent[], r: Rng, done: BotTask[]): void {
  for (const { bot, customerId, reminder } of done) {
    const i = s.customers.findIndex((c) => c.id === customerId);
    if (i < 0 || s.customers[i].churnedAt !== null) continue;
    if (rand(r) < BOT_INCIDENT) {
      const c = { ...s.customers[i] };
      s.customers = s.customers.map((x, k) => (k === i ? c : x));
      bump(c, BOT_INCIDENT_HAPPINESS);
      createTicket(s, c, "billing");
      events.push({ app: "Staff", key: `event.botIncident${1 + Math.floor(rand(r) * BOT_INCIDENTS)}`, params: { bot: bot.name, customer: c.name } });
    } else if (reminder && rand(r) < BOT_SLIP) createTicket(s, s.customers[i], "billing");
  }
}

// Skill grows 12 points a year in the first two years, 6 in years 3 to 5 and 2 after that, up to the talent cap.
export function growth(e: Employee, hour: number): number {
  const years = (hour - e.hiredAt) / YEAR;
  return (years < 2 ? 12 : years < 5 ? 6 : 2) / 12;
}

// economy.md, Raises and quitting.
export function quitChance(e: Employee, hour: number): number {
  let p = 0.005;
  if (e.salary < 0.85 * marketSalary(e, hour)) p += 0.03;
  if (e.refusedAt !== null && hour - e.refusedAt < YEAR / 2) p += 0.05;
  return p;
}

export const raiseAsk = (e: Employee, hour: number): number => Math.round(e.salary * 1.03 + Math.max(0, marketSalary(e, hour) - e.salary));

function monthly(s: GameState, events: SimEvent[], r: Rng): void {
  const from = monthStart(s.hour, -1);
  const pay = s.staff.map((e) => ({ e, amount: salaryOwed(e, from, s.hour) })).filter((x) => x.amount > 0);
  const total = cents(pay.reduce((sum, x) => sum + x.amount, 0));
  if (pay.length) {
    s.cash = cents(s.cash - total);
    s.ledger = [...s.ledger, ...pay.map(({ e, amount }) => ({ hour: s.hour, category: "salaries", key: "ledger.salary", params: { name: e.name, role: e.role }, amount: -amount }))];
    events.push({ app: "Staff", key: "event.salaries", params: { count: pay.length, total } });
  }
  const quits: Employee[] = [];
  for (const e of s.staff) {
    e.skill = Math.min(e.talent, e.skill + growth(e, s.hour));
    if (rand(r) < quitChance(e, s.hour)) quits.push(e);
  }
  for (const e of quits) events.push({ app: "Staff", key: "event.quit", params: { name: e.name } });
  if (quits.length) s.staff = s.staff.filter((e) => !quits.includes(e));
  refreshMarket(s);
}

// Leads per month from staff posting in forums; the effect grows with skill. Read by the marketing and market code.
export const forumAwareness = (s: GameState): number =>
  s.staff.filter((e) => e.assignment === "forum").reduce((sum, e) => sum + (FORUM_LEADS * speed(e) * e.hours) / FULL_DAY, 0);

export function staffTick(s: GameState): SimEvent[] {
  const bots = activeBots(s);
  if (!s.staff.length && !bots.length) {
    if (isMonthStart(s.hour)) refreshMarket(s);
    return [];
  }
  const events: SimEvent[] = [];
  const r = hashRng(s.seed, s.hour, 46);
  s.staff = s.staff.map((e) => ({ ...e }));
  for (const e of s.staff) {
    if (e.training && e.training.doneAt <= s.hour) {
      events.push({ app: "Staff", key: "event.trained", params: { name: e.name, task: e.training.task } });
      e.trained = [...e.trained, e.training.task];
      e.training = null;
    }
    if (!e.training) startTraining(s, e);
    if (e.raise && s.hour - e.raise.at >= RAISE_DAYS * DAY) Object.assign(e, { raise: null, refusedAt: s.hour });
    if (s.hour >= e.nextRaiseAt) {
      e.raise = { ask: raiseAsk(e, s.hour), at: s.hour };
      e.nextRaiseAt += YEAR;
      events.push({ app: "Staff", key: "event.raise", params: { name: e.name, salary: monthlyPay({ salary: e.raise.ask, hours: e.hours }) } });
    }
  }
  // A trainer with nobody left to train goes back to normal work.
  for (const e of s.staff) {
    if (e.assignment !== "trainer" || s.staff.some((x) => x.id !== e.id && x.role === e.role && needsTraining(x))) continue;
    e.assignment = "queue";
    events.push({ app: "Staff", key: "event.trainerDone", params: { name: e.name } });
  }
  // Staff take the queue first in their work hours; bots take what is left, day and night.
  const active = [...s.staff.filter((e) => working(e) && !atFair(s, e) && onShift(e, s.hour)), ...bots];
  const support = active.filter((e) => e.role === "support"), clerks = active.filter((e) => e.role === "bookkeeper" || e.role === "accountant");
  const done = [...(support.length ? answerTickets(s, support, r) : []), ...(clerks.length ? chaseInvoices(s, clerks, events) : [])];
  botTrouble(s, events, r, done);
  if (isMonthStart(s.hour)) monthly(s, events, r);
  return events;
}
