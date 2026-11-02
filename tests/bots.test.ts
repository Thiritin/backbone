import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { skillFor } from "../src/sim/10-catalog/research";
import { storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { hourOf } from "../src/sim/00-core/time";
import { openDesk } from "../src/sim/40-support/desk";
import { AGENT_NAME } from "../src/sim/40-support/desk-ai";
import { importTicket } from "../src/sim/40-support/desk-work";
import { createTicket, type TicketKind } from "../src/sim/40-support/tickets";
import type { Invoice } from "../src/sim/45-billing/billing";
import { activeBots, BOT_RIGHT, isWorkHour } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setDeskAi } from "../src/sim/90-actions/desk";
import { cancel, install } from "../src/sim/90-actions/store";

const FEB_1 = 744;
const runTo = (s: GameState, hour: number, events: SimEvent[] = []) => { while (s.hour < hour) events.push(...tick(s)); };

const customer = (s: GameState, name: string) => {
  const id = addCustomer(s, name, "private");
  return s.customers.find((x) => x.id === id)!;
};

// A hosted Zendusk in 2024 whose AI agent answers the desk's tickets.
const AGENT = AGENT_NAME.zendusk, Y2024 = hourOf(new Date(Date.UTC(2024, 0, 3, 0)));
function withAgent(seed: number): GameState {
  const s = { ...newGame(seed), hour: Y2024, cash: 100_000 };
  s.unlocks = ["people", "monitoring", "automation"];
  openDesk(s, "zendusk", { kind: "hosted" }, "pxl");
  if (!setDeskAi(s, "autoAnswer", true).ok) throw new Error("switch");
  return s;
}
const deskTicket = (s: GameState, c: Parameters<typeof createTicket>[1], kind: TicketKind) => {
  const t = createTicket(s, c, kind);
  importTicket(s, t, true);
  return t;
};

function withBot(seed: number, id: string): GameState {
  const s = newGame(seed);
  s.cash = 100_000;
  s.unlocks = ["people", "monitoring", "automation"];
  const r = install(s, id);
  if (!r.ok) throw new Error(r.error);
  return s;
}

describe("AI bots", () => {
  it("come with the Automation skill and bill per bot every month with the Pear price rise", () => {
    expect(skillFor("clipsy")!.id).toBe("automation");
    expect(storeItem("chadGpt")).toBeUndefined();
    const s = newGame(1);
    s.cash = 10_000;
    expect(install(s, "clipsy")).toEqual({ ok: false, error: "error.needsResearch" });
    s.unlocks = ["people", "monitoring", "automation"];
    expect(install(s, "clipsy").ok).toBe(true);
    expect(activeBots(s).map((b) => b.name)).toEqual(["Clipsy Reminders"]);
    runTo(s, FEB_1 + 1);
    const bills = s.ledger.filter((l) => l.key === "ledger.subscription" && l.hour === FEB_1).map((l) => l.params.name);
    expect(bills).toEqual(expect.arrayContaining(["Clipsy Reminders"]));
    expect(subscriptionPrice(storeItem("clipsy")!, 2010)).toBeCloseTo(100 * 1.08 ** 5, 2);
    expect(cancel(s, "clipsy").ok).toBe(true);
    expect(activeBots(s)).toEqual([]);
  });

  it("answers routine tickets around the clock and leaves the rest", () => {
    const s = withAgent(2);
    const night = Y2024 + 2;
    expect(isWorkHour(night)).toBe(false);
    const c = customer(s, "Night Owl");
    const howTo = deskTicket(s, c, "howTo"), outage = deskTicket(s, c, "outage");
    runTo(s, night);
    tick(s);
    const t = s.tickets.find((x) => x.id === howTo.id)!;
    expect(t.replies.length + (t.work ? 1 : 0)).toBeGreaterThan(0);
    expect(s.tickets.find((x) => x.id === outage.id)!.replies).toHaveLength(0);
    expect(s.tickets.find((x) => x.id === outage.id)!.work).toBeNull();
  });

  it("answers fast with a fixed mediocre hit rate and never learns", () => {
    const s = withAgent(3);
    for (let i = 0; i < 300; i++) {
      const c = customer(s, `Customer ${i}`);
      deskTicket(s, c, i % 2 ? "howTo" : "billing");
    }
    runTo(s, Y2024 + 24 * 7);
    const firsts = (kind: "howTo" | "billing") => s.tickets.filter((t) => t.kind === kind).map((t) => t.replies[0]).filter((r) => r?.by === AGENT);
    expect(s.tickets.flatMap((t) => t.replies).filter((r) => r.by === AGENT).length).toBeGreaterThan(300);
    for (const kind of ["howTo", "billing"] as const) {
      const right = firsts(kind).filter((r) => r.right).length / firsts(kind).length;
      expect(right).toBeGreaterThan(BOT_RIGHT[kind] - 0.1);
      expect(right).toBeLessThan(BOT_RIGHT[kind] + 0.1);
    }
    expect(activeBots(s)[0].skill).toBe(0);
  });

  it("sends payment reminders at night", () => {
    const s = withBot(4, "clipsy");
    const c = addCustomer(s, "Late Payer", "private");
    const inv: Invoice = {
      id: "inv-1", number: "2005-1", customerId: c, lines: [{ serviceId: null, key: "x", params: {}, amount: 10 }], issuedAt: 0, dueAt: -8 * 24,
      status: "overdue", reminders: [], suspended: false, suspendedAt: null, payStep: 4, payAt: null, paidAt: null, extendedUntil: null,
    };
    s.invoices = [inv];
    runTo(s, 3);
    expect(s.invoices[0].reminders).toHaveLength(1);
  });

  it("now and then does something memorable that angers a customer", () => {
    const s = withAgent(5);
    for (let i = 0; i < 1500; i++) {
      const c = customer(s, `Customer ${i}`);
      deskTicket(s, c, "howTo");
    }
    const events: SimEvent[] = [];
    runTo(s, Y2024 + 24 * 20, events);
    const incident = events.find((e) => e.key.startsWith("event.botIncident"));
    expect(incident).toBeDefined();
    expect(incident!.params.bot).toBe(AGENT);
    const c = s.customers.find((x) => x.name === incident!.params.customer)!;
    expect(s.tickets.some((t) => t.customerId === c.id && t.kind === "billing")).toBe(true);
  });
});
