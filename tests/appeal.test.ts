import { describe, expect, it } from "vitest";
import type { Profile } from "../src/sim/30-customers/customers";
import { serviceOnline } from "../src/sim/40-support/status";
import { supportTick } from "../src/sim/40-support/tick";
import { billingTick, EXTENSION_DAYS, isSuspended, SUSPENDED_PAY_ODDS_HIGH } from "../src/sim/45-billing/billing";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { setBillingRules, suspendServices } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { sendDrafts, withServer } from "./fixtures";

const DAY = 24;
const bill = (s: GameState, hour: number) => { while (s.hour < hour) { s.hour++; billingTick(s); } };
// Billing and support, so queued ticket actions take effect.
const run = (s: GameState, hour: number) => { while (s.hour < hour) { s.hour++; billingTick(s); supportTick(s); } };

// A yearly domain whose invoice is overdue by a day and never paid unless something moves the customer.
function overdue(seed: number, profile: Profile = "enterprise") {
  const s = withServer(newGame(seed));
  // Billing rules run by themselves after the Automation research; staff carry them out before it (staff-time.test.ts).
  s.unlocks = ["people", "monitoring", "automation"];
  const c = addCustomer(s, "Initech", profile, "late");
  const v = addService(s, c, "domain", "initech.com", 12, "year");
  tick(s);
  sendDrafts(s);
  Object.assign(s.invoices[0], { payStep: 4, payAt: null });
  bill(s, s.invoices[0].dueAt + DAY);
  return { s, c, v, inv: () => s.invoices[0], customer: () => s.customers.find((x) => x.id === c)! };
}

// The first seed whose enterprise customer appeals the suspension.
function appealed() {
  for (let seed = 1; ; seed++) {
    const o = overdue(seed);
    suspendServices(o.s, o.inv().id);
    const t = o.s.tickets.find((x) => x.kind === "appeal");
    if (t) return { ...o, ticket: () => o.s.tickets.find((x) => x.id === t.id)! };
  }
}

describe("auto collections", () => {
  it("hands the debt to collections on the configured day once the final notice went out", () => {
    const { s, inv, customer } = overdue(1, "private");
    expect(setBillingRules(s, { autoCollectDays: 50 as 42 })).toEqual({ ok: false, error: "error.billingRule" });
    expect(setBillingRules(s, { autoRemind: true, autoCollectDays: 60 }).ok).toBe(true);
    bill(s, inv().dueAt + 60 * DAY - 1);
    expect(inv().status).toBe("overdue");
    s.hour++;
    expect(billingTick(s)).toEqual([{ app: "Books", key: "event.collected", params: { customer: "Initech", invoice: inv().number } }]);
    expect(inv().status).toBe("writtenOff");
    expect(inv().reminders).toHaveLength(4);
    expect(customer().churnedAt).toBe(s.hour);
  });

  it("waits for the final notice when reminders are sent by hand", () => {
    const { s, inv } = overdue(2, "private");
    setBillingRules(s, { autoCollectDays: 42 });
    bill(s, inv().dueAt + 90 * DAY);
    expect(inv().status).toBe("overdue");
  });
});

describe("suspension by profile", () => {
  it("costs a high-budget customer 30 happiness and a private one 15, and only high budgets appeal", () => {
    let appeals = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      const e = overdue(seed);
      suspendServices(e.s, e.inv().id);
      expect(e.customer().happiness).toBe(40);
      expect(e.s.tickets).toHaveLength(1);
      if (e.s.tickets[0].kind === "appeal") appeals++;
      else expect(e.s.tickets[0]).toMatchObject({ kind: "billing", topic: "suspended" });
      const p = overdue(seed, "private");
      suspendServices(p.s, p.inv().id);
      expect(p.customer().happiness).toBe(55);
      expect(p.s.tickets).toMatchObject([{ kind: "billing", topic: "suspended" }]);
    }
    expect(Math.abs(appeals / runs - 0.6)).toBeLessThan(0.1);
  });

  it("makes a high-budget customer pay quickly once suspended", () => {
    let paid = 0, days = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed++) {
      const { s, inv } = overdue(seed);
      const from = s.hour;
      suspendServices(s, inv().id);
      bill(s, from + 14 * DAY);
      if (inv().status === "paid") { paid++; days += (inv().paidAt! - from) / DAY; }
    }
    expect(paid / runs).toBeGreaterThan(0.99);
    expect(Math.abs(days / paid - 1 / SUSPENDED_PAY_ODDS_HIGH)).toBeLessThan(0.4);
  });
});

describe("suspension appeals", () => {
  it("unsuspends with an extension and suspends again by the rules once it runs out unpaid", () => {
    const { s, v, inv, customer, ticket } = appealed();
    setBillingRules(s, { autoSuspendDays: 7 });
    const before = customer().happiness;
    expect(resolveTicket(s, ticket().id, "unsuspend").ok).toBe(true);
    run(s, s.hour + 1);
    expect(ticket()).toMatchObject({ status: "resolved", outcome: "unsuspended" });
    expect(serviceOnline(s, v)).toBe(true);
    expect(inv().extendedUntil).toBe(s.hour + EXTENSION_DAYS * DAY);
    expect(customer().happiness).toBe(before + 20);
    // The customer misses the extension.
    Object.assign(inv(), { payAt: null });
    bill(s, inv().extendedUntil! - 1);
    expect(isSuspended(s, customer().id)).toBe(false);
    s.hour++;
    expect(billingTick(s)).toEqual([{ app: "Books", key: "event.suspended", params: { customer: "Initech", invoice: inv().number } }]);
    expect(serviceOnline(s, v)).toBe(false);
    // The second suspension of the same invoice brings a billing ticket, and the rule acts only once per extension.
    expect(s.tickets.filter((t) => t.kind === "appeal")).toHaveLength(1);
    expect(s.tickets.at(-1)).toMatchObject({ kind: "billing", topic: "suspended" });
    suspendServices(s, inv().id, false);
    bill(s, s.hour + 2 * DAY);
    expect(inv().suspended).toBe(false);
  });

  it("mostly pays within the extension", () => {
    let appeals = 0, paid = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const o = overdue(seed);
      suspendServices(o.s, o.inv().id);
      const t = o.s.tickets.find((x) => x.kind === "appeal");
      if (!t) continue;
      appeals++;
      resolveTicket(o.s, t.id, "unsuspend");
      run(o.s, o.s.hour + 1);
      bill(o.s, o.inv().extendedUntil!);
      if (o.inv().status === "paid") paid++;
    }
    expect(Math.abs(paid / appeals - 0.85)).toBeLessThan(0.1);
  });

  it("keeps the services off on a refusal", () => {
    const { s, v, customer, ticket } = appealed();
    const before = customer().happiness;
    expect(resolveTicket(s, ticket().id, "keep").ok).toBe(true);
    expect(resolveTicket(s, ticket().id, "credit")).toEqual({ ok: false, error: "error.ticketBusy" });
    run(s, s.hour + 1);
    expect(ticket()).toMatchObject({ status: "resolved", outcome: "kept" });
    expect(serviceOnline(s, v)).toBe(false);
    expect(customer().happiness).toBe(before - 10);
  });

  it("loads old saves without the new fields", () => {
    const { s } = appealed();
    expect(deserialize(serialize(s))).toEqual(s);
    const old = JSON.parse(serialize(s));
    delete old.billingRules.autoCollectDays;
    delete old.invoices[0].extendedUntil;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.billingRules.autoCollectDays).toBe(0);
    expect(loaded.invoices[0].extendedUntil).toBeNull();
  });
});
