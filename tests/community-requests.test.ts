import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { eventById, REQUEST_DAYS } from "../src/sim/80-business/community";
import { reviewScore } from "../src/sim/80-business/marketing";
import { communityTick } from "../src/sim/80-business/sponsoring";
import { metrics } from "../src/sim/metrics";
import { readyGame as fresh } from "./fixtures";
import { readyGame, ticketOf } from "./community.helpers";

// Only the community step runs, hour by hour, as tick runs it after advancing the hour.
const step = (s: GameState) => { s.hour++; communityTick(s); };
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) step(s); };
const firstRequest = (s: GameState) => { while (!s.sponsorships.length) step(s); return s; };

describe("community sponsoring requests", () => {
  it("never arrive before Marketing basics", () => {
    const s = fresh(1);
    runTo(s, (REQUEST_DAYS[1] + 1) * 24);
    expect(s.sponsorships).toHaveLength(0);
  });

  it("arrive every 4 to 8 weeks from level 1, seeded", () => {
    let first: unknown;
    for (const seed of [1, 3, 4]) {
      const s = readyGame(seed), at: number[] = [0];
      while (s.hour < 24 * 365 && at.length < 6) {
        const n = s.sponsorships.length;
        step(s);
        if (s.sponsorships.length > n) {
          at.push(s.hour);
          first ??= structuredClone(s.sponsorships[0]);
        }
      }
      const gaps = at.slice(1).map((h, i) => (h - at[i]) / 24);
      expect(gaps.length).toBeGreaterThanOrEqual(5);
      expect(gaps.every((g) => g >= REQUEST_DAYS[0] && g <= REQUEST_DAYS[1] + 1)).toBe(true);
    }
    expect(firstRequest(readyGame(1)).sponsorships[0]).toEqual(first);
  });

  it("send a ticket of kind sponsor with the event, and only small events at level 1", () => {
    const s = firstRequest(readyGame(4));
    const t = ticketOf(s);
    expect(t).toMatchObject({ kind: "sponsor", customerId: "", status: "open", topic: s.sponsorships[0].event });
    // From the latest first request on, one step brings it. The draw hashes the seed, so a copy with another seed draws anew;
    // each base steps once first, so the copies skip the sponsor board's catch-up.
    const at = (hour: number, cash?: number) => {
      const g = readyGame(4);
      g.unlocks = g.unlocks.filter((u) => u !== "marketingBasics");
      g.hour = hour - 2;
      g.cash = cash ?? g.cash;
      step(g);
      g.unlocks.push("marketingBasics");
      return g;
    };
    const small = at(REQUEST_DAYS[1] * 24), large = at(9 * 8760, 1e9);
    const firstEvent = (seed: number, base: GameState) => {
      const g = structuredClone(base);
      g.seed = seed;
      const level = metrics(g).level.level;
      firstRequest(g);
      return { level, event: g.sponsorships[0].event };
    };
    for (let seed = 10; seed < 40; seed++) {
      const { level, event } = firstEvent(seed, small);
      expect(level).toBe(1);
      expect(eventById(event)!.level).toBe(1);
    }
    const big = Array.from({ length: 40 }, (_, i) => {
      const { level, event } = firstEvent(100 + i, large);
      expect(level).toBeGreaterThanOrEqual(3);
      return event;
    });
    expect(big).toContain("devOops");
    expect(new Set(big).size).toBeGreaterThan(3);
  });

  it("lapse after two weeks without penalty", () => {
    const s = firstRequest(readyGame(5)), cash = s.cash, score = reviewScore(s);
    const sp = s.sponsorships[0];
    runTo(s, sp.offeredAt + 14 * 24 + 1);
    expect(s.sponsorships[0].status).toBe("declined");
    expect(s.tickets.find((t) => t.id === sp.ticketId)).toMatchObject({ status: "closed", outcome: "ignored" });
    expect(s.cash).toBe(cash);
    expect(reviewScore(s)).toBe(score);
  });
});
