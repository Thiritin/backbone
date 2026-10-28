import { describe, expect, it } from "vitest";
import { ABANDON_HOURS } from "../src/sim/40-support/abandon";
import { createTicket } from "../src/sim/40-support/tickets";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";

function setup(seed: number) {
  const s = newGame(seed);
  const cus = addCustomer(s, "Jonas Weber", "private");
  const svc = addService(s, cus, "vps", "VPS 512", 0.01, "hour");
  const t = createTicket(s, s.customers.find((c) => c.id === cus)!, "howTo", svc);
  const happy = () => s.customers.find((c) => c.id === cus)!.happiness;
  const get = () => s.tickets.find((x) => x.id === t.id)!;
  return { s, t, happy, get };
}

describe("unanswered tickets", () => {
  it("are closed by the customer once they are overdue for the kind's limit, after the wait penalty", () => {
    const { s, t, happy, get } = setup(3);
    const limit = t.dueAt + ABANDON_HOURS.howTo!;
    while (s.hour < limit - 1) tick(s);
    expect(get().status).toBe("open");
    const before = happy();
    expect(before).toBeLessThan(70);
    tick(s);
    expect(get()).toMatchObject({ status: "closed", outcome: "ignored", unread: false, updatedAt: limit });
    while (s.hour < limit + 24) tick(s);
    expect(happy()).toBeGreaterThanOrEqual(before - 1);
  });

  it("stay open while someone is working on them", () => {
    const { s, t, get } = setup(5);
    while (s.hour < t.dueAt + ABANDON_HOURS.howTo! - 1) tick(s);
    s.tickets = s.tickets.map((x) => (x.id === t.id ? { ...x, work: { op: "reply", arg: "", doneAt: (s.hour + 1000) * 60 } } : x));
    tick(s);
    expect(get().status).toBe("open");
  });
});
