import { START_CASH } from "../src/sim/10-catalog/economy";
import { hourOf } from "../src/sim/00-core/time";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../src/sim/30-customers/customers";
import { createTicket, monthlyValue, rightTemplate, shownTemplates, SHORT_REPLIES, type Ticket, type TicketKind } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { closeTicket, escalateTicket, readTicket, replyTicket, resolveTicket, retainTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";

const down = vi.hoisted(() => new Set<string>());
vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: (_s: unknown, id: string) => !down.has(id) }));

const FEB_1 = 744, MAR_1 = 744 + 672;

function crowd(s: GameState, profile: Profile, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addCustomer(s, `${profile} ${i}`, profile));
}

function one(seed = 1, profile: Profile = "private") {
  const s = newGame(seed);
  const cus = addCustomer(s, "Jonas Weber", profile);
  const svc = addService(s, cus, "vps", "VPS 512", 0.01, "hour");
  const c = () => s.customers.find((x) => x.id === cus)!;
  return { s, cus, svc, c };
}

const ticketOf = (s: GameState, kind: TicketKind, topic: string, cus: string, svc: string | null): Ticket => {
  const t = createTicket(s, s.customers.find((c) => c.id === cus)!, kind, svc);
  t.topic = topic;
  return t;
};
const get = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };

describe("ticket generation", () => {
  it("follows the monthly rates per technical skill", () => {
    const s = newGame(7);
    crowd(s, "private", 1000);
    crowd(s, "enterprise", 1000);
    crowd(s, "gamer", 1000);
    runTo(s, 730);
    const count = (profile: Profile, kind: TicketKind) =>
      s.tickets.filter((t) => t.kind === kind && s.customers.find((c) => c.id === t.customerId)!.profile === profile).length;
    const near = (n: number, expected: number) => expect(Math.abs(n - expected)).toBeLessThan(4 * Math.sqrt(expected));
    near(count("private", "howTo"), 180);
    near(count("private", "billing"), 40);
    near(count("private", "abuse"), 5);
    near(count("enterprise", "howTo"), 20);
    near(count("enterprise", "abuse"), 20);
    near(count("gamer", "howTo"), 60);
    near(count("gamer", "abuse"), 20);
  });

  it("notifies Support about new tickets", () => {
    const s = newGame(3);
    crowd(s, "private", 500);
    const events = Array.from({ length: 48 }, () => tick(s)).flat().filter((e) => e.app === "Support");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.key === "event.ticket" || e.key === "event.tickets")).toBe(true);
  });

  it("creates nothing without customers", () => {
    const s = newGame(1);
    runTo(s, FEB_1);
    // Order emails come from leads, not customers.
    expect(s.tickets.filter((t) => t.kind !== "order")).toEqual([]);
  });
});

describe("happiness and churn", () => {
  it("drops by the wait penalty for each hour a ticket is overdue", () => {
    const { s, cus, svc, c } = one(2, "private");
    ticketOf(s, "howTo", "upload", cus, svc);
    runTo(s, 114);
    expect(s.tickets).toHaveLength(1);
    expect(c().happiness).toBeCloseTo(70 - 0.3 * 8, 6);
  });

  it("files a cancellation for a very unhappy customer and processes it at the next billing date", () => {
    const { s, cus, svc, c } = one(4);
    c().happiness = 10;
    runTo(s, FEB_1);
    const cancel = s.tickets.find((t) => t.kind === "cancellation")!;
    expect(cancel.customerId).toBe(cus);
    expect(c().churnedAt).toBeNull();
    runTo(s, MAR_1);
    expect(c().churnedAt).toBe(MAR_1);
    expect(get(s, cancel.id)).toMatchObject({ status: "closed", outcome: "cancelled" });
    expect(s.services.find((v) => v.id === svc)!.endedAt).toBe(MAR_1);
  });

  it("rolls monthly churn from base churn and happiness", () => {
    const rate = (h: number) => {
      const s = newGame(11);
      runTo(s, FEB_1 - 1);
      crowd(s, "private", 2000).forEach((id) => (s.customers.find((c) => c.id === id)!.happiness = h));
      runTo(s, FEB_1);
      return s.tickets.filter((t) => t.kind === "cancellation").length;
    };
    const happy = rate(90), unhappy = rate(30);
    expect(Math.abs(happy - 50)).toBeLessThan(4 * Math.sqrt(50));
    expect(Math.abs(unhappy - 450)).toBeLessThan(4 * Math.sqrt(450));
  });
});

describe("support actions", () => {
  it("marks a ticket read", () => {
    const { s, cus, svc } = one();
    const t = ticketOf(s, "howTo", "upload", cus, svc);
    expect(t.unread).toBe(true);
    expect(readTicket(s, t.id).ok).toBe(true);
    expect(get(s, t.id).unread).toBe(false);
  });

  it("queues replies on the player's time and applies them once done", () => {
    const { s, cus, svc } = one();
    const ids = Array.from({ length: 4 }, () => ticketOf(s, "howTo", "upload", cus, svc).id);
    ids.forEach((id) => expect(replyTicket(s, id, "ftp").ok).toBe(true));
    expect(s.playerBusyUntil).toBe(80);
    expect(get(s, ids[3]).work).toEqual({ op: "reply", arg: "ftp", doneAt: 80 });
    tick(s);
    expect(ids.map((id) => get(s, id).status)).toEqual(["waiting", "waiting", "waiting", "open"]);
    tick(s);
    expect(get(s, ids[3]).status).toBe("waiting");
  });

  it("resolves a right answer with +5", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "billing", "copy", cus, svc);
    replyTicket(s, t.id, "resend");
    tick(s);
    expect(get(s, t.id).replies[0]).toMatchObject({ template: "resend", right: true });
    expect(resolveTicket(s, t.id).ok).toBe(true);
    expect(get(s, t.id).status).toBe("resolved");
    expect(c().happiness).toBe(75);
  });

  it("resolves a waiting ticket by itself after two days", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "howTo", "dns", cus, svc);
    replyTicket(s, t.id, "dns");
    runTo(s, 1 + 48);
    expect(get(s, t.id).status).toBe("resolved");
    expect(c().happiness).toBe(75);
  });

  it("reopens the thread with -10 after a wrong answer", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "howTo", "email", cus, svc);
    readTicket(s, t.id);
    replyTicket(s, t.id, "ftp");
    tick(s);
    expect(get(s, t.id)).toMatchObject({ status: "open", unread: true, dueAt: 89 });
    expect(get(s, t.id).replies[0].right).toBe(false);
    expect(c().happiness).toBe(60);
  });

  it("issues a credit of 10% of the monthly fee", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "outage", "down", cus, svc);
    const fee = monthlyValue(s.services, cus);
    expect(resolveTicket(s, t.id, "credit").ok).toBe(true);
    tick(s);
    expect(get(s, t.id)).toMatchObject({ status: "resolved", outcome: "credit" });
    expect(s.cash).toBeCloseTo(START_CASH - fee * 0.1, 2);
    expect(s.ledger.at(-1)).toMatchObject({ category: "credit", key: "ledger.credit" });
    expect(c().happiness).toBe(78);
  });

  it("processes a cancellation and closes the customer's other tickets", () => {
    const { s, cus, svc, c } = one();
    const other = ticketOf(s, "howTo", "upload", cus, svc);
    const t = ticketOf(s, "cancellation", "leave", cus, null);
    resolveTicket(s, t.id, "cancel");
    tick(s);
    expect(get(s, t.id)).toMatchObject({ status: "resolved", outcome: "cancelled" });
    expect(get(s, other.id).status).toBe("closed");
    expect(c().churnedAt).toBe(1);
    expect(s.services[0].endedAt).toBe(1);
  });

  it("keeps some customers with a retention offer", () => {
    const s = newGame(5);
    const ids = crowd(s, "smallBiz", 40);
    ids.forEach((id) => addService(s, id, "webHosting", "Web S", 0.005, "hour"));
    const tickets = ids.map((id) => ticketOf(s, "cancellation", "leave", id, null));
    tickets.forEach((t) => retainTicket(s, t.id, "free"));
    runTo(s, 12);
    const kept = tickets.filter((t) => get(s, t.id).outcome === "retained");
    expect(kept.length).toBeGreaterThan(10);
    expect(kept.length).toBeLessThan(36);
    for (const t of tickets) expect(s.customers.find((c) => c.id === t.customerId)!.churnedAt === null).toBe(get(s, t.id).outcome === "retained");
  });

  it("escalates outages to a technician until the service is back", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "outage", "down", cus, svc);
    expect(escalateTicket(s, ticketOf(s, "howTo", "upload", cus, svc).id)).toEqual({ ok: false, error: "error.cannotEscalate" });
    down.add(svc);
    expect(escalateTicket(s, t.id).ok).toBe(true);
    tick(s);
    tick(s);
    expect(get(s, t.id).status).toBe("escalated");
    down.clear();
    tick(s);
    expect(get(s, t.id).status).toBe("resolved");
    expect(c().happiness).toBe(70 + 5);
  });

  it("closes an unanswered ticket with -10 and a cancellation by processing it", () => {
    const { s, cus, svc, c } = one();
    const t = ticketOf(s, "billing", "charge", cus, svc);
    expect(closeTicket(s, t.id).ok).toBe(true);
    expect(get(s, t.id).status).toBe("closed");
    expect(c().happiness).toBe(60);
    const cancel = ticketOf(s, "cancellation", "leave", cus, null);
    closeTicket(s, cancel.id);
    expect(c().churnedAt).toBe(0);
  });

  it("rejects actions that do not fit", () => {
    const { s, cus, svc } = one();
    const t = ticketOf(s, "howTo", "upload", cus, svc);
    expect(replyTicket(s, "tkt0", "ftp")).toEqual({ ok: false, error: "error.unknownTicket" });
    expect(replyTicket(s, t.id, "resend")).toEqual({ ok: false, error: "error.unknownTemplate" });
    expect(resolveTicket(s, t.id)).toEqual({ ok: false, error: "error.ticketNotAnswered" });
    expect(resolveTicket(s, t.id, "credit")).toEqual({ ok: false, error: "error.unknownTicketAction" });
    replyTicket(s, t.id, "ftp");
    expect(closeTicket(s, t.id)).toEqual({ ok: false, error: "error.ticketBusy" });
    tick(s);
    expect(replyTicket(s, t.id, "ftp")).toEqual({ ok: false, error: "error.ticketNotOpen" });
    resolveTicket(s, t.id);
    expect(closeTicket(s, t.id)).toEqual({ ok: false, error: "error.ticketDone" });
  });
});

describe("outages", () => {
  it("lowers happiness per hour down and lets high-budget customers write three times", () => {
    const s = newGame(8);
    // Tuesday 10:00, when shops look at their sites.
    s.hour = hourOf(new Date(Date.UTC(2005, 0, 11, 10)));
    const ids = crowd(s, "onlineShop", 20);
    const svcs = ids.map((id) => addService(s, id, "vps", "Shop VPS", 0.05, "hour"));
    svcs.forEach((v) => down.add(v));
    tick(s);
    tick(s);
    down.clear();
    const outages = s.tickets.filter((t) => t.kind === "outage");
    expect(outages.length % 3).toBe(0);
    expect(outages.length / 3).toBeGreaterThan(14);
    expect(s.customers.filter((c) => c.happiness === 70 - 2 * 10).length).toBeGreaterThan(14);
    expect(Object.keys(s.downSince)).toHaveLength(20);
  });

  it("expects an acknowledgement while the service is down", () => {
    const { s, cus, svc } = one();
    const t = ticketOf(s, "outage", "down", cus, svc);
    down.add(svc);
    replyTicket(s, t.id, "back");
    tick(s);
    down.clear();
    expect(get(s, t.id).replies[0].right).toBe(false);
  });
});

describe("support saves", () => {
  it("loads a save from before customers and tickets", () => {
    const old = JSON.parse(serialize(newGame(6)));
    for (const k of ["customers", "services", "tickets", "playerBusyUntil", "downSince"]) delete old[k];
    const s = deserialize(JSON.stringify(old));
    expect(s).toMatchObject({ customers: [], services: [], tickets: [], playerBusyUntil: 0, downSince: {} });
    runTo(s, 5);
  });

  it("round-trips customers, services and tickets", () => {
    const s = newGame(9);
    crowd(s, "private", 300).forEach((id) => addService(s, id, "webHosting", "Web S", 0.004, "hour"));
    runTo(s, 400);
    replyTicket(s, s.tickets[0].id, "ftp");
    expect(s.tickets.length).toBeGreaterThan(10);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});

describe("short reply list", () => {
  it("keeps the settling reply when the desk shows only a few", () => {
    const { s, cus, svc } = one();
    for (const [kind, topic] of [["howTo", "panel"], ["billing", "price"], ["howTo", "upload"]] as const) {
      const t = ticketOf(s, kind, topic, cus, svc);
      const shown = shownTemplates(s, t, false);
      expect(shown).toHaveLength(SHORT_REPLIES);
      expect(shown).toContain(rightTemplate(s, t));
    }
  });
});
