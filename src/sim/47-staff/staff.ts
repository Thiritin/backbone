import { hashRng, rand, type Rng } from "../00-core/rng";
import { dateOf, hourOf, isMonthStart, yearOf } from "../00-core/time";
import { monthlySalary, priceAt } from "../10-catalog/economy";
import { cents, dueStep, sendStep } from "../45-billing/billing";
import { storeItem } from "../10-catalog/store";
import { bump, createTicket, MINUTES, rightTemplate, TEMPLATES, type Ticket, type TicketKind } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { isWorkHour } from "../00-core/workhours";
import { orderError } from "../30-market/orders";

export type Role = "support" | "bookkeeper" | "accountant" | "marketing" | "technician";
export type Task = TicketKind | "reminder" | "dunning" | "final" | "campaigns" | "reviews" | "fairs" | "hardware" | "servers" | "panels";
// queue: works the role's tasks. trainer: trains colleagues of the same role. forum: posts in hosting and gaming forums.
export type Assignment = "queue" | "trainer" | "forum";

// talent is the hidden cap skill never passes; busyUntil is in game minutes like the player's queue. location is the
// location id a technician works at, null for every other role.
export interface Employee {
  id: string; name: string; role: Role; skill: number; talent: number; salary: number; hiredAt: number; assignment: Assignment; location: string | null;
  trained: Task[]; plan: Task[]; training: { task: Task; startedAt: number; doneAt: number } | null; busyUntil: number;
  raise: { ask: number; at: number } | null; nextRaiseAt: number; refusedAt: number | null;
  // Set on the stand-ins activeBots builds for store bots; never saved.
  bot?: true;
}
export interface Candidate { id: string; name: string; role: Role; skill: number; talent: number; salary: number; arriveAt: number; leaveAt: number }

export const ROLES: Role[] = ["support", "bookkeeper", "accountant", "marketing", "technician"];
export const TASKS: Record<Role, Task[]> = {
  support: ["howTo", "billing", "outage", "upgrade", "cancellation", "abuse", "appeal", "order"],
  bookkeeper: ["reminder"],
  accountant: ["dunning", "final"],
  marketing: ["campaigns", "reviews", "fairs"],
  // Hardware: part swaps and power. Servers: draining nodes. Panels: PHP upgrades.
  technician: ["hardware", "servers", "panels"],
};
// economy.md, Back-office tasks: minutes per dunning step, in STEPS order.
const STEP_TASK: Task[] = ["reminder", "dunning", "final"];
const STEP_MINUTES = [3, 10, 15];

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

// Salary owed since the later of the hire and the start of the period, as a share of that month.
export function salaryOwed(e: Employee, from: number, to: number): number {
  const hours = to - Math.max(e.hiredAt, from);
  return hours > 0 ? cents((e.salary * hours) / (monthStart(from, 1) - from)) : 0;
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
  trained: b.tasks, plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, bot: true,
}));

// An employee at a trade fair does no other work for the fair's days.
export const atFair = (s: GameState, e: Employee): boolean => s.fairs.some((b) => b.employeeId === e.id && b.start <= s.hour && s.hour < b.end);

export const hasMarketingManager = (s: GameState): boolean => s.staff.some((e) => e.role === "marketing");
// The best working marketing manager trained on the task, or none.
const manager = (s: GameState, task: Task): Employee | undefined =>
  s.staff.filter((e) => e.role === "marketing" && working(e) && !atFair(s, e) && e.trained.includes(task)).sort((a, b) => b.skill - a.skill)[0];
// Campaigns bring 5% to 15% more leads with a manager trained on them, by skill.
export const campaignBoost = (s: GameState): number => {
  const e = manager(s, "campaigns");
  return e ? 1.05 + 0.1 * (e.skill / 100) : 1;
};
export const REVIEW_INVITE_BOOST = 1.5;
export const reviewBoost = (s: GameState): number => (manager(s, "reviews") ? REVIEW_INVITE_BOOST : 1);

const speed = (e: Employee) => (e.bot ? BOT_SPEED : 0.5 + e.skill / 100);
const rightChance = (e: Employee) => (e.bot ? BOT_RIGHT : 0.75 + 0.25 * (e.skill / 100));

// A support agent queues a reply or action on the ticket the same way the player does; finishWork in the support tick applies it.
function choose(s: GameState, e: Employee, t: Ticket, r: Rng): { op: "reply" | "resolve"; arg: string } {
  if (t.kind === "cancellation") return { op: "resolve", arg: "retain" };
  if (t.kind === "order") return { op: "resolve", arg: "accept" };
  const right = rightTemplate(s, t);
  if (!right) return { op: "resolve", arg: "unsuspend" };
  if (rand(r) < rightChance(e)) return { op: "reply", arg: right };
  return { op: "reply", arg: pick(r, TEMPLATES[t.kind].filter((x) => x !== right)) };
}

interface BotTask { bot: Employee; customerId: string; reminder: boolean }

function answerTickets(s: GameState, agents: Employee[], r: Rng): BotTask[] {
  const end = (s.hour + 1) * 60;
  const churned = new Set(s.customers.filter((c) => c.churnedAt !== null).map((c) => c.id));
  const queue = s.tickets.filter((t) => t.status === "open" && !t.work && !churned.has(t.customerId)).sort((a, b) => a.dueAt - b.dueAt);
  const taken = new Map<string, Ticket["work"]>(), byBot: BotTask[] = [];
  for (const e of agents) {
    let at = Math.max(e.busyUntil, s.hour * 60);
    for (const t of queue) {
      if (at >= end) break;
      // An order that cannot be set up waits for the player.
      if (taken.has(t.id) || !e.trained.includes(t.kind) || (t.kind === "order" && orderError(s, t))) continue;
      at += MINUTES[t.kind] / speed(e);
      taken.set(t.id, { ...choose(s, e, t, r), doneAt: Math.ceil(at), by: e.name });
      if (e.bot) byBot.push({ bot: e, customerId: t.customerId, reminder: false });
    }
    e.busyUntil = at;
  }
  if (taken.size) s.tickets = s.tickets.map((t) => (taken.has(t.id) ? { ...t, work: taken.get(t.id)!, unread: false } : t));
  return byBot;
}

// Bookkeepers send payment reminders, accountants the dunning and final notices; collections stays with the player and the rules.
function chaseInvoices(s: GameState, clerks: Employee[]): BotTask[] {
  const end = (s.hour + 1) * 60;
  const due = s.invoices.map((inv) => ({ inv, step: dueStep(inv, s.hour) })).filter((x): x is { inv: typeof x.inv; step: number } => x.step !== null && x.step < STEP_TASK.length)
    .sort((a, b) => a.inv.dueAt - b.inv.dueAt);
  const sent = new Map<string, number>(), byBot: BotTask[] = [];
  for (const e of clerks) {
    let at = Math.max(e.busyUntil, s.hour * 60);
    for (const { inv, step } of due) {
      if (at >= end) break;
      if (sent.has(inv.id) || !e.trained.includes(STEP_TASK[step])) continue;
      at += STEP_MINUTES[step] / speed(e);
      sent.set(inv.id, step);
      if (e.bot) byBot.push({ bot: e, customerId: inv.customerId, reminder: true });
    }
    e.busyUntil = at;
  }
  if (!sent.size) return byBot;
  s.invoices = s.invoices.map((inv) => {
    if (!sent.has(inv.id)) return inv;
    const copy = { ...inv };
    sendStep(s, copy, sent.get(inv.id)!);
    return copy;
  });
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
  s.staff.filter((e) => e.assignment === "forum").reduce((sum, e) => sum + FORUM_LEADS * speed(e), 0);

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
      events.push({ app: "Staff", key: "event.raise", params: { name: e.name, salary: e.raise.ask } });
    }
  }
  // A trainer with nobody left to train goes back to normal work.
  for (const e of s.staff) {
    if (e.assignment !== "trainer" || s.staff.some((x) => x.id !== e.id && x.role === e.role && needsTraining(x))) continue;
    e.assignment = "queue";
    events.push({ app: "Staff", key: "event.trainerDone", params: { name: e.name } });
  }
  // Staff take the queue first in office hours; bots take what is left, day and night.
  const active = [...(isWorkHour(s.hour) ? s.staff.filter((e) => working(e) && !atFair(s, e)) : []), ...bots];
  const support = active.filter((e) => e.role === "support"), clerks = active.filter((e) => e.role === "bookkeeper" || e.role === "accountant");
  const done = [...(support.length ? answerTickets(s, support, r) : []), ...(clerks.length ? chaseInvoices(s, clerks) : [])];
  botTrouble(s, events, r, done);
  if (isMonthStart(s.hour)) monthly(s, events, r);
  return events;
}
