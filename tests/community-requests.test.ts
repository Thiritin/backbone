import { describe, expect, it } from "vitest";
import { eventById, REQUEST_DAYS } from "../src/sim/80-business/community";
import { reviewScore } from "../src/sim/80-business/marketing";
import { tick } from "../src/sim/88-tick/tick";
import { metrics } from "../src/sim/metrics";
import { readyGame as fresh } from "./fixtures";
import { readyGame, runTo, ticketOf, asked } from "./community.helpers";

describe("community sponsoring requests", () => {
  it("never arrive before Marketing basics", () => {
    const s = fresh(1);
    runTo(s, (REQUEST_DAYS[1] + 1) * 24);
    expect(s.sponsorships).toHaveLength(0);
  });

  it("arrive every 4 to 8 weeks from level 1, seeded", () => {
    let first: unknown;
    for (const seed of [1, 2, 3]) {
      const s = readyGame(seed), at: number[] = [0];
      while (s.hour < 24 * 365 && at.length < 6) {
        const n = s.sponsorships.length;
        tick(s);
        if (s.sponsorships.length > n) {
          at.push(s.hour);
          first ??= structuredClone(s.sponsorships[0]);
        }
      }
      const gaps = at.slice(1).map((h, i) => (h - at[i]) / 24);
      expect(gaps.length).toBeGreaterThanOrEqual(5);
      expect(gaps.every((g) => g >= REQUEST_DAYS[0] && g <= REQUEST_DAYS[1] + 1)).toBe(true);
    }
    const again = readyGame(1);
    while (!again.sponsorships.length) tick(again);
    expect(again.sponsorships[0]).toEqual(first);
  }, 90_000);

  it("send a ticket of kind sponsor with the event, and only small events at level 1", () => {
    const s = asked(4);
    const t = ticketOf(s);
    expect(t).toMatchObject({ kind: "sponsor", customerId: "", status: "open", topic: s.sponsorships[0].event });
    // From the latest first request on, one tick brings it.
    const firstEvent = (seed: number, hour: number, cash?: number) => {
      const g = readyGame(seed);
      g.hour = hour;
      g.cash = cash ?? g.cash;
      const level = metrics(g).level.level;
      while (!g.sponsorships.length) tick(g);
      return { level, event: g.sponsorships[0].event };
    };
    for (let seed = 10; seed < 40; seed++) {
      const { level, event } = firstEvent(seed, REQUEST_DAYS[1] * 24);
      expect(level).toBe(1);
      expect(eventById(event)!.level).toBe(1);
    }
    const big = Array.from({ length: 40 }, (_, i) => {
      const { level, event } = firstEvent(100 + i, 9 * 8760, 1e9);
      expect(level).toBeGreaterThanOrEqual(3);
      return event;
    });
    expect(big).toContain("devOops");
    expect(new Set(big).size).toBeGreaterThan(3);
  });

  it("lapse after two weeks without penalty", () => {
    const s = asked(5), cash = s.cash, score = reviewScore(s);
    const sp = s.sponsorships[0];
    runTo(s, sp.offeredAt + 14 * 24 + 1);
    expect(s.sponsorships[0].status).toBe("declined");
    expect(s.tickets.find((t) => t.id === sp.ticketId)).toMatchObject({ status: "closed", outcome: "ignored" });
    expect(s.cash).toBeGreaterThan(cash - 1000);
    expect(reviewScore(s)).toBe(score);
  });
});
