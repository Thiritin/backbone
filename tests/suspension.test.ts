import { describe, expect, it } from "vitest";
import type { PaymentHabit } from "../src/sim/30-customers/customers";
import { serviceOnline } from "../src/sim/40-support/status";
import { billingTick, freeRiding, invoiceTotal, isSuspended, SUSPENDED_PAY_ODDS } from "../src/sim/45-billing/billing";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { setBillingRules, suspendServices } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";

const DAY = 24;
// Billing only, so support churn and tickets don't move happiness.
const bill = (s: GameState, hour: number) => { while (s.hour < hour) { s.hour++; billingTick(s); } };

// A yearly domain whose invoice is overdue by a day and never paid unless something moves the customer.
function overdue(seed: number, habit: PaymentHabit = "prompt") {
  const s = newGame(seed);
  // Billing rules run by themselves after the Automation research; staff carry them out before it (staff-time.test.ts).
  s.unlocks = ["people", "monitoring", "automation"];
  const c = addCustomer(s, "Ada", "private", habit);
  const v = addService(s, c, "domain", "ada.example", 12, "year");
  tick(s);
  Object.assign(s.invoices[0], { payStep: 4, payAt: null });
  bill(s, s.invoices[0].dueAt + DAY);
  return { s, c, v, inv: () => s.invoices[0], customer: () => s.customers.find((x) => x.id === c)! };
}

describe("suspension", () => {
  it("takes the services offline, costs 15 happiness and opens one billing ticket", () => {
    const { s, v, inv, customer } = overdue(1);
    expect(serviceOnline(s, v)).toBe(true);
    expect(suspendServices(s, inv().id).ok).toBe(true);
    expect(serviceOnline(s, v)).toBe(false);
    expect(customer().happiness).toBe(55);
    expect(s.tickets).toMatchObject([{ kind: "billing", topic: "suspended", customerId: customer().id }]);
    expect(suspendServices(s, inv().id, false).ok).toBe(true);
    expect(serviceOnline(s, v)).toBe(true);
  });

  it("makes a customer pay faster than one left alone", () => {
    const runs = 300;
    for (const habit of ["prompt", "bad"] as const) {
      let alone = 0, paid = 0, days = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const a = overdue(seed, habit);
        bill(a.s, a.s.hour + 30 * DAY);
        if (a.inv().status === "paid") alone++;
        const b = overdue(seed, habit);
        const from = b.s.hour;
        suspendServices(b.s, b.inv().id);
        bill(b.s, from + 30 * DAY);
        if (b.inv().status === "paid") { paid++; days += (b.inv().paidAt! - from) / DAY; }
      }
      expect(alone).toBe(0);
      expect(paid / runs).toBeGreaterThan(habit === "prompt" ? 0.97 : 0.8);
      // Daily odds p mean about 1/p days to pay.
      expect(Math.abs(days / paid - 1 / SUSPENDED_PAY_ODDS[habit])).toBeLessThan(0.8);
    }
  });

  it("resumes the services once the invoice is paid", () => {
    const { s, v, inv } = overdue(2);
    suspendServices(s, inv().id);
    inv().payAt = s.hour + 3;
    bill(s, s.hour + 3);
    expect(inv()).toMatchObject({ status: "paid", suspended: false });
    expect(serviceOnline(s, v)).toBe(true);
  });

  it("loses about half the bad payers still suspended after 14 days to collections", () => {
    let left = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      for (const habit of ["bad", "late"] as const) {
        const { s, v, inv, customer } = overdue(seed, habit);
        suspendServices(s, inv().id);
        // Skip the daily payment rolls of the first 13 days.
        inv().suspendedAt = s.hour - 14 * DAY + 1;
        bill(s, s.hour + 1);
        if (habit === "late") { expect(customer().churnedAt).toBeNull(); continue; }
        if (customer().churnedAt === null) continue;
        left++;
        expect(inv()).toMatchObject({ status: "writtenOff", suspended: false, payAt: s.hour + 30 * DAY });
        expect(s.services.find((x) => x.id === v)!.endedAt).toBe(s.hour);
      }
    }
    expect(Math.abs(left / runs - 0.5)).toBeLessThan(0.1);
  });
});

describe("billing rules", () => {
  it("suspends automatically on the configured day", () => {
    const { s, inv, customer } = overdue(3);
    expect(setBillingRules(s, { autoSuspendDays: 10 as 7 })).toEqual({ ok: false, error: "error.billingRule" });
    expect(setBillingRules(s, { autoSuspendDays: 14 }).ok).toBe(true);
    bill(s, inv().dueAt + 14 * DAY - 1);
    expect(isSuspended(s, customer().id)).toBe(false);
    s.hour++;
    expect(billingTick(s)).toEqual([{ app: "Billing", key: "event.suspended", params: { customer: "Ada", invoice: inv().number } }]);
    expect(inv()).toMatchObject({ suspended: true, suspendedAt: s.hour });
    expect(customer().happiness).toBe(55);
    // A suspension the player lifts stays lifted.
    suspendServices(s, inv().id, false);
    bill(s, s.hour + 2);
    expect(inv().suspended).toBe(false);
  });

  it("sends reminders, dunning and final notices on schedule but leaves collections to the player", () => {
    const { s, inv } = overdue(4);
    setBillingRules(s, { autoRemind: true });
    const due = inv().dueAt;
    bill(s, due + 50 * DAY);
    expect(inv().reminders).toEqual([due + 7 * DAY, due + 14 * DAY, due + 28 * DAY]);
    expect(inv().status).toBe("overdue");
  });

  it("leaves overdue invoices open and counts what the served customers owe", () => {
    const { s, inv, customer } = overdue(5);
    bill(s, s.hour + 90 * DAY);
    expect(inv().status).toBe("overdue");
    expect(freeRiding(s)).toEqual({ customers: [customer().id], owed: invoiceTotal(inv()) });
    suspendServices(s, inv().id);
    expect(freeRiding(s)).toEqual({ customers: [], owed: 0 });
  });

  it("keeps the rules through save and load and defaults them in old saves", () => {
    const { s, inv } = overdue(6);
    setBillingRules(s, { autoRemind: true, autoSuspendDays: 30 });
    suspendServices(s, inv().id);
    expect(deserialize(serialize(s))).toEqual(s);
    const old = JSON.parse(serialize(s));
    delete old.billingRules;
    delete old.invoices[0].suspendedAt;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.billingRules).toEqual({ autoRemind: false, autoSuspendDays: 0, autoCollectDays: 0 });
    expect(loaded.invoices[0].suspendedAt).toBe(s.hour);
  });
});
