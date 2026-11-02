import { newGame } from "./fixtures";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../src/sim/30-customers/customers";
import { monthlyRate } from "../src/sim/40-support/tick";
import { tick } from "../src/sim/88-tick/tick";
import { FEB_1, crowd, runTo } from "./support.helpers";

const down = vi.hoisted(() => new Set<string>());
vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: (_s: unknown, id: string) => !down.has(id) }));

describe("ticket generation", () => {
  // Expected tickets from 300 customers in their first hours, summed hour by hour from the rate the hourly roll uses.
  const month = (profile: Profile, kind: "howTo" | "billing" | "abuse", settled = false, hours = 730) => {
    const s = newGame(7);
    const [id] = crowd(s, profile, 1);
    const c = s.customers.find((x) => x.id === id)!;
    if (settled) c.since = s.hour - 36 * 730;
    let n = 0;
    for (let h = 0; h < hours; h++) { s.hour = h; n += monthlyRate(s, c, kind) / 730; }
    return 300 * n;
  };

  it("follows the monthly rates per technical skill", () => {
    const close = (n: number, expected: number) => expect(n).toBeCloseTo(expected, 0);
    // New customers ask about 2.3 times the base how-to rate in their first month (tenureFactor).
    close(month("private", "howTo"), 62);
    close(month("private", "billing"), 6);
    expect(month("private", "abuse")).toBeCloseTo(0.75, 2);
    close(month("enterprise", "howTo"), 7);
    close(month("enterprise", "abuse"), 3);
    close(month("gamer", "howTo"), 21);
    close(month("gamer", "abuse"), 3);
    // The hourly roll turns the rate into tickets, checked on 200 customers over ten days.
    const s = newGame(7);
    crowd(s, "private", 200);
    runTo(s, 240);
    const expected = (month("private", "howTo", false, 240) * 2) / 3;
    expect(Math.abs(s.tickets.filter((t) => t.kind === "howTo").length - expected)).toBeLessThan(3 * Math.sqrt(expected));
  });

  it("drops how-to questions to a trickle once customers are settled", () => {
    expect(month("private", "howTo", true)).toBeCloseTo(4, 0);
  });

  it("notifies Support about new tickets", () => {
    const s = newGame(3);
    crowd(s, "private", 500);
    const events = Array.from({ length: 48 }, () => tick(s)).flat().filter((e) => e.app === "Support");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.key === "event.ticket" || e.key === "event.tickets")).toBe(true);
  });

  it("names the ticket a single new-ticket notification is about", () => {
    const s = newGame(3);
    crowd(s, "private", 500);
    const one = Array.from({ length: 48 }, () => tick(s)).flat().filter((e) => e.key === "event.ticket");
    expect(one.length).toBeGreaterThan(0);
    for (const e of one) expect(s.tickets.some((t) => t.id === e.params.ticketId)).toBe(true);
  });

  it("creates nothing without customers", () => {
    const s = newGame(1);
    runTo(s, FEB_1);
    // Order emails come from leads, not customers.
    expect(s.tickets.filter((t) => t.kind !== "order")).toEqual([]);
  });
});
