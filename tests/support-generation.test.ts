import { newGame } from "./fixtures";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../src/sim/30-customers/customers";
import { type TicketKind } from "../src/sim/40-support/tickets";
import { tick } from "../src/sim/88-tick/tick";
import { FEB_1, crowd, runTo } from "./support.helpers";

const down = vi.hoisted(() => new Set<string>());
vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: (_s: unknown, id: string) => !down.has(id) }));

describe("ticket generation", () => {
  it("follows the monthly rates per technical skill", () => {
    // One game per profile: a tick costs customers squared, so three crowds of 300 are far cheaper than one of 900.
    const games = new Map((["private", "enterprise", "gamer"] as Profile[]).map((profile) => {
      const s = newGame(7);
      crowd(s, profile, 300);
      runTo(s, 730);
      return [profile, s];
    }));
    const count = (profile: Profile, kind: TicketKind) => games.get(profile)!.tickets.filter((t) => t.kind === kind).length;
    const near = (n: number, expected: number) => expect(Math.abs(n - expected)).toBeLessThan(4 * Math.sqrt(expected));
    // New customers ask about 2.3 times the base how-to rate in their first month (tenureFactor).
    near(count("private", "howTo"), 125);
    near(count("private", "billing"), 12);
    near(count("private", "abuse"), 1.5);
    near(count("enterprise", "howTo"), 14);
    near(count("enterprise", "abuse"), 6);
    near(count("gamer", "howTo"), 42);
    near(count("gamer", "abuse"), 6);
  });

  it("drops how-to questions to a trickle once customers are settled", () => {
    const s = newGame(7);
    for (const id of crowd(s, "private", 300)) s.customers.find((c) => c.id === id)!.since = s.hour - 36 * 730;
    runTo(s, 730);
    const n = s.tickets.filter((t) => t.kind === "howTo").length;
    expect(Math.abs(n - 8)).toBeLessThan(4 * Math.sqrt(8));
  }, 60_000);

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
