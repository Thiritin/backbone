import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { createTicket } from "../src/sim/40-support/tickets";
import { isMonthStart } from "../src/sim/00-core/time";
import { dueStep, type Invoice } from "../src/sim/45-billing/billing";
import {
  COURSE_HOURS, forumAwareness, isWorkHour, MARKET_PER_ROLE, MONTHLY_HOURS, quitChance, ROLES, staffPrice, TASKS, TRAINER_HOURS, visibleCandidates, type Role,
} from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { answerRaise, assign, fire, hire, planTraining, postJobAd } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";

const FEB_1 = 744, MONDAY_9 = 48 + 9;
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };

function hireOne(s: GameState, role: Role, skill = 50): string {
  const c = visibleCandidates(s).find((x) => x.role === role)!;
  const r = hire(s, c.id);
  if (!r.ok) throw new Error(r.error);
  const e = s.staff.find((x) => x.id === r.id)!;
  Object.assign(e, { skill, talent: 100 });
  return e.id;
}
const emp = (s: GameState, id: string) => s.staff.find((e) => e.id === id)!;
const train = (s: GameState, id: string, tasks = TASKS[emp(s, id).role]) => {
  emp(s, id).trained = [...tasks];
};

describe("job market", () => {
  it("lists open applications for every role and refreshes them monthly", () => {
    const s = newGame(3);
    expect(ROLES.map((r) => visibleCandidates(s).filter((c) => c.role === r).length)).toEqual(ROLES.map(() => MARKET_PER_ROLE));
    const first = visibleCandidates(s).map((c) => c.id);
    runTo(s, FEB_1);
    const now = visibleCandidates(s).map((c) => c.id);
    expect(now).toHaveLength(ROLES.length * MARKET_PER_ROLE);
    expect(now.some((id) => first.includes(id))).toBe(false);
  });

  it("asks a salary by skill, juniors cheap and seniors expensive", () => {
    const s = newGame(9);
    for (let m = 0; m < 24; m++) runTo(s, s.hour + 730);
    const all = s.candidates.filter((c) => c.role === "support");
    const junior = all.reduce((a, b) => (a.skill < b.skill ? a : b)), senior = all.reduce((a, b) => (a.skill > b.skill ? a : b));
    expect(senior.salary).toBeGreaterThan(junior.salary);
    expect(Math.round(junior.salary / 100)).toBeGreaterThanOrEqual(24);
  });

  it("charges for a job ad whose candidates arrive over two weeks", () => {
    const s = newGame(4);
    s.cash = 5000;
    expect(postJobAd(s, "support", "premium").ok).toBe(true);
    expect(s.cash).toBe(5000 - staffPrice(2000, 2005));
    expect(s.ledger.at(-1)).toMatchObject({ category: "salaries", key: "ledger.jobAd" });
    const visible = () => visibleCandidates(s).filter((c) => c.role === "support").length;
    expect(visible()).toBeLessThan(MARKET_PER_ROLE + 8);
    runTo(s, 14 * 24);
    expect(visible()).toBe(MARKET_PER_ROLE + 8);
    s.cash = 0;
    expect(postJobAd(s, "support", "standard")).toEqual({ ok: false, error: "error.noCash" });
  });

  it("hires a candidate off the market", () => {
    const s = newGame(5);
    const c = visibleCandidates(s)[0];
    const r = hire(s, c.id);
    expect(r.ok).toBe(true);
    expect(s.staff[0]).toMatchObject({ name: c.name, role: c.role, salary: c.salary, trained: [], assignment: "queue" });
    expect(hire(s, c.id)).toEqual({ ok: false, error: "error.unknownCandidate" });
  });
});

describe("training", () => {
  it("runs one course per task type, with a fee, before the employee handles it", () => {
    const s = newGame(6);
    s.cash = 2000;
    const id = hireOne(s, "support");
    expect(planTraining(s, id, ["howTo", "billing"]).ok).toBe(true);
    const fee = staffPrice(250, 2005);
    expect(s.cash).toBe(2000 - fee);
    expect(emp(s, id).training).toMatchObject({ task: "howTo", doneAt: COURSE_HOURS });
    const events = [];
    while (s.hour < COURSE_HOURS) events.push(...tick(s));
    expect(events).toContainEqual({ app: "Staff", key: "event.trained", params: { name: emp(s, id).name, task: "howTo" } });
    expect(emp(s, id).trained).toEqual(["howTo"]);
    expect(emp(s, id).training?.task).toBe("billing");
    expect(s.ledger.filter((l) => l.key === "ledger.training")).toHaveLength(2);
    expect(planTraining(s, id, ["reminder"])).toEqual({ ok: false, error: "error.unknownTask" });
  });

  it("lets a fully trained colleague train others faster and for free, then return to the queue", () => {
    const s = newGame(7);
    const a = hireOne(s, "support"), b = hireOne(s, "support");
    expect(assign(s, a, "trainer")).toEqual({ ok: false, error: "error.notFullyTrained" });
    train(s, a);
    expect(assign(s, a, "trainer")).toEqual({ ok: false, error: "error.nobodyToTrain" });
    s.cash = 0;
    expect(planTraining(s, b, ["howTo"])).toEqual({ ok: false, error: "error.noCash" });
    emp(s, b).plan = ["howTo", "abuse"];
    expect(assign(s, a, "trainer").ok).toBe(true);
    expect(planTraining(s, b, ["howTo", "abuse"]).ok).toBe(true);
    expect(s.cash).toBe(0);
    expect(emp(s, b).training).toMatchObject({ task: "howTo", doneAt: TRAINER_HOURS });
    const events = [];
    while (s.hour < 2 * TRAINER_HOURS + 1) events.push(...tick(s));
    expect(emp(s, b).trained).toEqual(["howTo", "abuse"]);
    expect(emp(s, a).assignment).toBe("queue");
    expect(events).toContainEqual({ app: "Staff", key: "event.trainerDone", params: { name: emp(s, a).name } });
  });
});

describe("work", () => {
  it("only works weekdays from 9 to 17", () => {
    expect([0, 24, MONDAY_9 - 1, MONDAY_9, 48 + 16, 48 + 17].map(isWorkHour)).toEqual([false, false, false, true, true, false]);
  });

  it("answers open tickets of trained types, mostly right, at the work rate", () => {
    const s = newGame(8);
    const cus = Array.from({ length: 40 }, (_, i) => addCustomer(s, `Customer ${i}`, "hobbyDev"));
    const id = hireOne(s, "support", 100);
    train(s, id, ["howTo"]);
    for (const c of cus) createTicket(s, s.customers.find((x) => x.id === c)!, "howTo", null);
    createTicket(s, s.customers[0], "abuse", null);
    runTo(s, MONDAY_9 - 1);
    expect(s.tickets.filter((t) => t.customerId).every((t) => t.status === "open")).toBe(true);
    runTo(s, MONDAY_9 + 1);
    // Skill 100 works at 1.5x: 20-minute tickets take 13.3 minutes, so 5 start in the first hour.
    expect(s.tickets.filter((t) => t.work).length).toBe(5);
    runTo(s, 48 + 18);
    const howTo = s.tickets.filter((t) => t.kind === "howTo" && t.replies.length);
    expect(howTo.length).toBeGreaterThanOrEqual(35);
    expect(howTo.every((t) => t.replies.every((r) => r.right && r.by === emp(s, id).name))).toBe(true);
    expect(s.tickets.find((t) => t.kind === "abuse" && t.createdAt === 0)!.replies).toEqual([]);
  });

  it("makes mistakes at low skill that bring follow-ups", () => {
    const s = newGame(10);
    const cus = Array.from({ length: 60 }, (_, i) => addCustomer(s, `Customer ${i}`, "hobbyDev"));
    const id = hireOne(s, "support", 0);
    train(s, id, ["howTo"]);
    for (const c of cus) createTicket(s, s.customers.find((x) => x.id === c)!, "howTo", null);
    runTo(s, 48 + 24 * 5);
    const replies = s.tickets.flatMap((t) => t.replies);
    const wrong = replies.filter((r) => !r.right).length / replies.length;
    expect(replies.length).toBeGreaterThan(40);
    expect(wrong).toBeGreaterThan(0.12);
    expect(wrong).toBeLessThan(0.4);
  });

  it("stops queue work while training, as a trainer or in the forums", () => {
    const s = newGame(11);
    addCustomer(s, "Customer", "hobbyDev");
    const id = hireOne(s, "support");
    train(s, id, ["howTo"]);
    emp(s, id).assignment = "forum";
    createTicket(s, s.customers[0], "howTo", null);
    runTo(s, MONDAY_9 + 2);
    expect(s.tickets[0].replies).toEqual([]);
    expect(forumAwareness(s)).toBeCloseTo(2);
    emp(s, id).skill = 100;
    expect(forumAwareness(s)).toBeCloseTo(3);
  });

  it("sends payment reminders and dunning notices by role when the rules ask for them", () => {
    const s = newGame(12);
    const c = addCustomer(s, "Late Payer", "private");
    const inv = (n: number, dueAt: number): Invoice => ({
      id: `inv-${n}`, number: `2005-${n}`, customerId: c, lines: [{ serviceId: null, key: "x", params: {}, amount: 10 }], issuedAt: 0, dueAt,
      status: "overdue", reminders: [], suspended: false, suspendedAt: null, payStep: 4, payAt: null, paidAt: null, extendedUntil: null,
    });
    s.invoices = [inv(1, -8 * 24), { ...inv(2, -15 * 24), reminders: [-24] }];
    s.billingRules.autoRemind = true;
    // Two seats on a plan without automatic reminders.
    s.books = { vendor: "sevdeck", installedAt: 0, edition: "rechnung", seats: 2, download: null };
    const book = hireOne(s, "bookkeeper"), acc = hireOne(s, "accountant");
    train(s, book);
    runTo(s, MONDAY_9 + 1);
    expect(s.invoices[0].reminders).toHaveLength(1);
    expect(s.invoices[1].reminders).toHaveLength(1);
    expect(dueStep(s.invoices[1], s.hour)).toBe(1);
    train(s, acc);
    runTo(s, MONDAY_9 + 2);
    expect(s.invoices[1].reminders).toHaveLength(2);
    expect(s.invoices[1].lines.at(-1)!.amount).toBe(5);
  });
});

describe("pay, raises and quitting", () => {
  it("bills salaries monthly to the ledger for the hours worked in the first month", () => {
    const s = newGame(13);
    runTo(s, FEB_1 / 2);
    const id = hireOne(s, "support");
    const salary = emp(s, id).salary;
    const events = [];
    while (s.hour < FEB_1) events.push(...tick(s));
    const line = s.ledger.find((l) => l.key === "ledger.salary")!;
    expect(line.category).toBe("salaries");
    // Hired on Sunday 16 January: eleven office days of 8 hours follow.
    expect(-line.amount).toBeCloseTo((salary * 88) / MONTHLY_HOURS, 0);
    expect(events.find((e) => e.key === "event.salaries")).toBeTruthy();
    runTo(s, FEB_1 + 24 * 14);
    const cash = s.cash;
    expect(fire(s, id).ok).toBe(true);
    // Ten office days from 1 to 14 February.
    expect(cash - s.cash).toBeCloseTo((salary * 80) / MONTHLY_HOURS, 0);
    expect(s.staff).toEqual([]);
  });

  it("grows skill with tenure up to the talent cap", () => {
    const s = newGame(14);
    const id = hireOne(s, "support", 20);
    emp(s, id).talent = 40;
    emp(s, id).salary = 1e6;
    runTo(s, 8760);
    expect(emp(s, id).skill).toBeCloseTo(32);
    runTo(s, 2 * 8760);
    expect(emp(s, id).skill).toBe(40);
  });

  it("asks for a raise yearly; refusing raises the quit chance", () => {
    const s = newGame(15);
    const id = hireOne(s, "support", 20);
    const events = [];
    while (s.hour < 8760) events.push(...tick(s));
    const e = emp(s, id);
    expect(e.raise).not.toBeNull();
    expect(e.raise!.ask).toBeGreaterThan(e.salary * 1.03);
    expect(events.find((x) => x.key === "event.raise")).toBeTruthy();
    const before = quitChance(e, s.hour);
    expect(answerRaise(s, id, false).ok).toBe(true);
    expect(quitChance(emp(s, id), s.hour)).toBeCloseTo(before + 0.05);
    expect(answerRaise(s, id, true)).toEqual({ ok: false, error: "error.noRaise" });
  });

  it("accepting a raise sets the new salary", () => {
    const s = newGame(16);
    const id = hireOne(s, "bookkeeper", 30);
    runTo(s, 8760);
    const ask = emp(s, id).raise!.ask;
    answerRaise(s, id, true);
    expect(emp(s, id)).toMatchObject({ salary: ask, raise: null, refusedAt: null });
  });

  it("loses underpaid staff faster", () => {
    let left = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = newGame(seed);
      for (let i = 0; i < 6; i++) emp(s, hireOne(s, ROLES[i % 3])).salary = 100;
      // Before its first raise an employee only quits at a month start, so the hours between are skipped.
      for (let h = FEB_1; h <= FEB_1 + 730 * 3; h++) if (isMonthStart(h)) { s.hour = h - 1; tick(s); }
      left += 6 - s.staff.length;
    }
    // About 3.5% a month over 4 month starts for 240 employees.
    expect(left).toBeGreaterThan(15);
    expect(left).toBeLessThan(60);
  });
});

describe("saves", () => {
  it("keeps staff through a save and loads saves without them", () => {
    const s = newGame(17);
    hireOne(s, "support");
    expect(deserialize(serialize(s)).staff).toEqual(s.staff);
    const old = JSON.parse(serialize(newGame(17)));
    delete old.staff;
    delete old.candidates;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.staff).toEqual([]);
    expect(loaded.candidates.length).toBe(ROLES.length * MARKET_PER_ROLE);
  });
});
