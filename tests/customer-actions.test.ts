import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { serviceOnline } from "../src/sim/40-support/status";
import { createTicket } from "../src/sim/40-support/tickets";
import { activityFor } from "../src/sim/47-staff/activity";
import { TASKS, visibleCandidates, type Role } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService, creditCustomer, suspendCustomer } from "../src/sim/90-actions/customers";
import { hire } from "../src/sim/90-actions/staff";
import { assignTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";

const MONDAY = 48;
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const customer = (s: GameState, id: string) => s.customers.find((c) => c.id === id)!;

function hireSupport(s: GameState, role: Role = "support"): string {
  const c = visibleCandidates(s).find((x) => x.role === role)!;
  const r = hire(s, c.id);
  if (!r.ok) throw new Error(r.error);
  Object.assign(s.staff.find((x) => x.id === r.id)!, { skill: 50, talent: 100, trained: [...TASKS[role]], salary: 2000 });
  return r.id!;
}

describe("customer credit", () => {
  it("lowers the next invoice by the credit and leaves nothing behind", () => {
    const s = newGame(7);
    const a = addCustomer(s, "Credited", "private"), b = addCustomer(s, "Plain", "private");
    addService(s, a, "vps", "vm a", 120, "year");
    addService(s, b, "vps", "vm b", 120, "year");
    expect(creditCustomer(s, a, 0)).toEqual({ ok: false, error: "error.creditAmount" });
    expect(creditCustomer(s, "nobody", 5)).toEqual({ ok: false, error: "error.unknownCustomer" });
    expect(creditCustomer(s, a, 20).ok).toBe(true);
    expect(creditCustomer(s, a, 5).ok).toBe(true);
    expect(customer(s, a).credit).toBe(25);
    tick(s);
    const lines = (id: string) => s.invoices.find((i) => i.customerId === id)!.lines.map((l) => [l.key, l.amount]);
    expect(lines(b)).toEqual([["invoice.line.year", 120]]);
    expect(lines(a)).toEqual([["invoice.line.year", 120], ["invoice.line.credit", -25]]);
    expect(customer(s, a).credit).toBe(0);
  });

  it("keeps what an invoice is too small to take and survives a save", () => {
    const s = newGame(7);
    const a = addCustomer(s, "Small", "private");
    addService(s, a, "vps", "vm a", 10, "year");
    creditCustomer(s, a, 30);
    tick(s);
    expect(s.invoices.find((i) => i.customerId === a)!.lines.at(-1)!.amount).toBe(-10);
    expect(customer(deserialize(serialize(s)), a).credit).toBe(20);
  });
});

describe("customer suspension", () => {
  it("stops every service of the customer and unsuspending restores them", () => {
    const s = newGame(8);
    const a = addCustomer(s, "Held", "private"), b = addCustomer(s, "Other", "private");
    const mine = [addService(s, a, "vps", "vm 1", 1, "hour"), addService(s, a, "vps", "vm 2", 1, "hour")], theirs = addService(s, b, "vps", "vm 3", 1, "hour");
    expect(mine.every((id) => serviceOnline(s, id))).toBe(true);
    const happy = customer(s, a).happiness, tickets = s.tickets.length;
    expect(suspendCustomer(s, a, true).ok).toBe(true);
    expect(mine.some((id) => serviceOnline(s, id))).toBe(false);
    expect(serviceOnline(s, theirs)).toBe(true);
    expect(customer(s, a).happiness).toBeLessThan(happy);
    expect(s.tickets.length).toBe(tickets + 1);
    // A repeat changes nothing.
    expect(suspendCustomer(s, a, true).ok).toBe(true);
    expect(s.tickets.length).toBe(tickets + 1);
    expect(suspendCustomer(s, a, false).ok).toBe(true);
    expect(mine.every((id) => serviceOnline(s, id))).toBe(true);
    expect(suspendCustomer(s, "nobody", true)).toEqual({ ok: false, error: "error.unknownCustomer" });
  });
});

describe("ticket assignment", () => {
  it("lets the assigned agent answer their ticket before the rest of the queue", () => {
    const run = (assign: boolean) => {
      const s = newGame(41);
      const agent = hireSupport(s), name = s.staff.find((e) => e.id === agent)!.name;
      const filler = addCustomer(s, "Queue Filler", "private"), mine = addCustomer(s, "Assigned", "private");
      for (let i = 0; i < 12; i++) createTicket(s, customer(s, filler), "howTo", null, "upload");
      const t = createTicket(s, customer(s, mine), "howTo", null, "upload");
      t.dueAt += 100;
      if (assign) expect(assignTicket(s, t.id, agent).ok).toBe(true);
      runTo(s, MONDAY + 10);
      return activityFor(s, mine).some((a) => a.by === name);
    };
    expect(run(false)).toBe(false);
    expect(run(true)).toBe(true);
  });

  it("holds an assigned ticket for its agent, hands it back and rejects strangers", () => {
    const s = newGame(41);
    const agent = hireSupport(s), other = hireSupport(s), clerk = hireSupport(s, "bookkeeper");
    const c = addCustomer(s, "Someone", "private");
    const t = createTicket(s, customer(s, c), "howTo", null, "upload");
    expect(assignTicket(s, t.id, clerk)).toEqual({ ok: false, error: "error.unknownEmployee" });
    expect(assignTicket(s, t.id, "emp-x")).toEqual({ ok: false, error: "error.unknownEmployee" });
    expect(assignTicket(s, "tkt-x", agent)).toEqual({ ok: false, error: "error.unknownTicket" });
    expect(assignTicket(s, t.id, agent).ok).toBe(true);
    expect(deserialize(serialize(s)).tickets.find((x) => x.id === t.id)!.assignee).toBe(agent);
    expect(assignTicket(s, t.id, null).ok).toBe(true);
    expect(s.tickets.find((x) => x.id === t.id)!.assignee).toBeNull();
    expect(other).not.toBe(agent);
  });
});
