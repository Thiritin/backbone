import { describe, expect, it } from "vitest";
import { createTicket, MINUTES, TEMPLATES } from "../src/sim/40-support/tickets";
import type { Invoice } from "../src/sim/45-billing/billing";
import { ACTION_MINUTES, activityFor } from "../src/sim/47-staff/activity";
import { campaignBoost, forumAwareness, salaryOwed, TASKS, visibleCandidates, type Role } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { sendReminder, setBillingRules, suspendServices } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { changePrice } from "../src/sim/90-actions/sales";
import { assign, hire, setHours } from "../src/sim/90-actions/staff";
import { replyTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 0 is Saturday 1 January 2005.
const FEB_1 = 744, MONDAY = 48, AUTOMATION = ["people", "monitoring", "automation"];
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const dayOf = (hour: number) => Math.floor(hour / 24);

// Skill 50 works at speed 1, so minutes are the table's minutes.
function hireOne(s: GameState, role: Role): string {
  const c = visibleCandidates(s).find((x) => x.role === role)!;
  const r = hire(s, c.id);
  if (!r.ok) throw new Error(r.error);
  Object.assign(s.staff.find((x) => x.id === r.id)!, { skill: 50, talent: 100, trained: [...TASKS[role]], salary: 2000 });
  return r.id!;
}
const emp = (s: GameState, id: string) => s.staff.find((e) => e.id === id)!;

function overdueInvoice(s: GameState, customerId: string, days: number): Invoice {
  const inv: Invoice = {
    id: `inv-${days}`, number: `2005-${days}`, customerId, lines: [{ serviceId: null, key: "x", params: {}, amount: 10 }], issuedAt: 0, dueAt: s.hour - days * 24,
    status: "overdue", reminders: [], suspended: false, suspendedAt: null, payStep: 4, payAt: null, paidAt: null, extendedUntil: null,
  };
  s.invoices = [...s.invoices, inv];
  return inv;
}

describe("working hours", () => {
  it("pays a 2-hour employee a quarter and gives them at most 120 minutes of work a day", () => {
    const s = newGame(41);
    const full = hireOne(s, "support"), part = hireOne(s, "support");
    expect(setHours(s, part, 2).ok).toBe(true);
    expect(setHours(s, part, 3 as 2)).toEqual({ ok: false, error: "error.workHours" });
    assign(s, full, "forum");
    const [fullName, partName] = [emp(s, full).name, emp(s, part).name];
    const c = addCustomer(s, "Queue Filler", "private");
    for (let i = 0; i < 20; i++) createTicket(s, s.customers.find((x) => x.id === c)!, "howTo", null, "upload");
    runTo(s, MONDAY + 17);
    const monday = activityFor(s, c).filter((a) => a.by === partName && dayOf(a.hour) === dayOf(MONDAY));
    expect(monday.reduce((sum, a) => sum + a.minutes, 0)).toBeLessThanOrEqual(120);
    expect(monday.length).toBeGreaterThan(0);
    expect(monday.every((a) => a.hour - MONDAY < 11)).toBe(true);
    // The rest waits for Tuesday.
    expect(s.tickets.some((t) => t.customerId === c && t.status === "open" && !t.work)).toBe(true);
    runTo(s, MONDAY + 24 + 17);
    expect(activityFor(s, c).some((a) => a.by === partName && dayOf(a.hour) === dayOf(MONDAY) + 1)).toBe(true);
    runTo(s, FEB_1);
    const paid = (name: string) => -s.ledger.filter((l) => l.key === "ledger.salary" && l.params.name === name).reduce((sum, l) => sum + l.amount, 0);
    expect(paid(partName)).toBeCloseTo(paid(fullName) / 4, 1);
  });

  it("pays out the old hours when they change, so the month is paid as worked", () => {
    const s = newGame(42);
    const id = hireOne(s, "bookkeeper");
    const e = emp(s, id);
    runTo(s, 372);
    setHours(s, id, 2);
    runTo(s, FEB_1);
    const paid = -s.ledger.filter((l) => l.key === "ledger.salary").reduce((sum, l) => sum + l.amount, 0);
    expect(paid).toBeCloseTo(2000 * (372 / 744) + 500 * (372 / 744), 1);
    expect(salaryOwed({ ...e, hours: 4, hoursFrom: 0 }, 0, 744)).toBe(1000);
  });

  it("scales marketing and forum work with the hours", () => {
    const s = newGame(43);
    const m = hireOne(s, "marketing");
    const full = campaignBoost(s);
    setHours(s, m, 2);
    expect(campaignBoost(s) - 1).toBeCloseTo((full - 1) * (120 / ACTION_MINUTES.campaigns), 6);
    assign(s, m, "forum");
    const two = forumAwareness(s);
    setHours(s, m, 8);
    expect(forumAwareness(s)).toBeCloseTo(4 * two, 6);
  });

  it("loads old saves with 8 hours and an empty activity log", () => {
    const s = newGame(44);
    const id = hireOne(s, "support");
    const old = JSON.parse(serialize(s));
    delete old.activity;
    for (const e of old.staff) { delete e.hours; delete e.hoursFrom; }
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.activity).toEqual([]);
    expect(emp(loaded, id).hours).toBe(8);
    expect(salaryOwed(emp(loaded, id), 0, 744)).toBe(2000);
  });
});

describe("billing rules", () => {
  it("need a bookkeeper or accountant before the Automation research and run by themselves after it", () => {
    const s = newGame(45);
    const c = addCustomer(s, "Late Payer", "private");
    setBillingRules(s, { autoRemind: true, autoSuspendDays: 7 });
    s.hour = MONDAY + 9;
    const a = overdueInvoice(s, c, 8);
    tick(s);
    expect(s.invoices[0].reminders).toHaveLength(0);
    const book = hireOne(s, "bookkeeper"), acc = hireOne(s, "accountant");
    tick(s);
    expect(s.invoices[0].reminders).toHaveLength(1);
    // One action per invoice and hour: the suspension follows an hour later.
    tick(s);
    expect(s.invoices[0].suspended).toBe(true);
    const log = activityFor(s, c);
    expect(log.filter((x) => x.by === emp(s, book).name).map((x) => [x.key, x.minutes])).toEqual([
      ["activity.reminder", ACTION_MINUTES.reminder], ["activity.checkInvoice", ACTION_MINUTES.checkInvoice]]);
    expect(log.filter((x) => x.by === emp(s, acc).name).map((x) => [x.key, x.minutes])).toEqual([
      ["activity.suspend", ACTION_MINUTES.suspend], ["activity.checkInvoice", ACTION_MINUTES.checkInvoice]]);

    const auto = newGame(45);
    auto.unlocks = AUTOMATION;
    const d = addCustomer(auto, "Late Payer", "private");
    setBillingRules(auto, { autoRemind: true });
    auto.hour = 3;
    overdueInvoice(auto, d, 8);
    tick(auto);
    expect(auto.invoices[0].reminders).toHaveLength(1);
    expect(activityFor(auto, d).map((x) => [x.by, x.key, x.minutes])).toEqual([["Automation", "activity.reminder", 0]]);
    expect(a.reminders).toHaveLength(0);
  });

  it("carries billing work beyond the day's minutes to the next workday", () => {
    const s = newGame(46);
    const c = addCustomer(s, "Late Payer", "private");
    setBillingRules(s, { autoRemind: true });
    s.hour = MONDAY + 8;
    for (let i = 0; i < 10; i++) overdueInvoice(s, c, 8 + i);
    const book = hireOne(s, "bookkeeper");
    setHours(s, book, 2);
    runTo(s, MONDAY + 24);
    // A reminder with its check takes 21 minutes, so five fit in two hours.
    expect(s.invoices.filter((i) => i.reminders.length).length).toBe(5);
    runTo(s, MONDAY + 48);
    expect(s.invoices.filter((i) => i.reminders.length).length).toBe(10);
  });
});

describe("activity log", () => {
  it("records the player's ticket, invoice and service actions by customer and service", () => {
    const s = newGame(47);
    const c = addCustomer(s, "Ada", "private");
    const v = addService(s, c, "webHosting", "ada.example", 10 / 730, "hour");
    const w = addService(s, c, "webHosting", "ada-shop.example", 10 / 730, "hour");
    const t = createTicket(s, s.customers.find((x) => x.id === c)!, "howTo", v, "upload");
    expect(replyTicket(s, t.id, TEMPLATES.howTo[0]).ok).toBe(true);
    const inv = overdueInvoice(s, c, 8);
    expect(sendReminder(s, inv.id).ok).toBe(true);
    expect(suspendServices(s, inv.id).ok).toBe(true);
    expect(changePrice(s, w, 12).ok).toBe(true);
    const all = activityFor(s, c);
    expect(all.every((a) => a.by === null)).toBe(true);
    expect(all.map((a) => a.key)).toEqual(["activity.price", "activity.suspend", "activity.reminder", "activity.reply"]);
    expect(all.find((a) => a.key === "activity.suspend")!.minutes).toBe(ACTION_MINUTES.suspend);
    const onV = activityFor(s, c, v).map((a) => a.key);
    expect(onV).toContain("activity.suspend");
    expect(onV).not.toContain("activity.price");
    expect(activityFor(s, c, w).map((a) => a.key)).toContain("activity.price");
    expect(all.at(-1)!.minutes).toBe(MINUTES.howTo);
  });
});
