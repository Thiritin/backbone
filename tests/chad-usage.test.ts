import { afterEach, describe, expect, it } from "vitest";
import { bumpProbe, createTicket } from "../src/sim/40-support/tickets";
import { agentCostPerSolved, attemptTokens, botOdds, BOT_TRIES, costPerSolved, pricePerMTokens, tokenCost } from "../src/sim/47-staff/chad";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { install } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";

const BOT = "ChadGPT Support";
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const botReplies = (s: GameState) => s.tickets.flatMap((t) => t.replies.filter((r) => r.by === BOT));

function withChad(seed: number, tickets: number, kind: "howTo" | "billing" = "howTo"): GameState {
  const s = newGame(seed);
  s.cash = 100_000;
  s.unlocks = ["people", "monitoring", "automation"];
  if (!install(s, "chadGpt").ok) throw new Error("install");
  for (let i = 0; i < tickets; i++) {
    const id = addCustomer(s, `Customer ${i}`, "private");
    createTicket(s, s.customers.find((c) => c.id === id)!, kind);
  }
  return s;
}

afterEach(() => { bumpProbe.fn = null; });

describe("ChadGPT usage", () => {
  it("bills every reply in tokens, and a retry rereads the thread at a higher price", () => {
    const s = withChad(11, 60);
    runTo(s, 24 * 5);
    const replies = botReplies(s);
    expect(s.chadUsage.attempts).toBe(replies.length);
    expect(replies.length).toBeGreaterThan(60);
    // Each reply is billed at the thread length it read.
    const tokens = s.tickets.reduce((a, t) => a + t.replies.reduce((b, r, i) => b + (r.by === BOT ? attemptTokens(i, 2005) : 0), 0), 0);
    expect(s.chadUsage.tokens).toBe(tokens);
    expect(s.chadUsage.cost).toBeCloseTo(tokenCost(tokens, 2005), 6);
    expect(attemptTokens(2, 2005)).toBeGreaterThan(attemptTokens(1, 2005));
    expect(s.tickets.some((t) => t.replies.filter((r) => r.by === BOT).length >= 2)).toBe(true);
  });

  it("gives up after four replies, leaves the ticket open and costs the customer happiness", () => {
    const s = withChad(12, 120, "billing");
    const tens: Record<string, number> = {};
    bumpProbe.fn = (c, d) => { if (d === -10) tens[c.id] = (tens[c.id] ?? 0) + 1; };
    runTo(s, 24 * 5);
    const given = s.tickets.filter((t) => t.replies.filter((r) => r.by === BOT && !r.right).length === BOT_TRIES);
    expect(given.length).toBeGreaterThan(3);
    for (const t of given) {
      expect(t.status).toBe("open");
      expect(tens[t.customerId]).toBe(BOT_TRIES + 1);
    }
    const before = given.map((t) => t.replies.length);
    runTo(s, 24 * 10);
    expect(given.map((t) => s.tickets.find((x) => x.id === t.id)!.replies.length)).toEqual(before);
  });

  it("bills last month's usage as one ledger line at the month start", () => {
    const s = withChad(13, 40);
    runTo(s, 700);
    const { cost } = s.chadUsage, cash = s.cash;
    runTo(s, 745);
    const line = s.ledger.find((l) => l.key === "ledger.chadUsage")!;
    expect(line).toMatchObject({ category: "ai", hour: 744 });
    expect(line.amount).toBeCloseTo(-cost, 2);
    expect(s.cash).toBeLessThan(cash);
    expect(s.chadUsage.attempts).toBe(0);
  });

  it("solves a ticket in 1.5 to 2.5 replies and costs 30% to 60% of a support agent per solved ticket", () => {
    expect(botOdds("howTo").attempts / botOdds("howTo").solved).toBeGreaterThan(1.5);
    expect(botOdds("billing").attempts / botOdds("billing").solved).toBeLessThan(2.5);
    expect(botOdds("billing").attempts).toBeGreaterThan(botOdds("howTo").attempts);
    for (let year = 2006; year <= 2018; year++) for (const kind of ["howTo", "billing"] as const) {
      const share = costPerSolved(kind, year) / agentCostPerSolved(year);
      expect(share).toBeGreaterThan(0.3);
      expect(share).toBeLessThan(0.6);
    }
    expect(pricePerMTokens(2020)).toBeLessThan(pricePerMTokens(2010));
    // The sim's own bill per solved ticket stays under the agent's.
    const s = withChad(14, 200);
    runTo(s, 24 * 6);
    expect(s.chadUsage.solved).toBeGreaterThan(100);
    expect(s.chadUsage.cost / s.chadUsage.solved).toBeLessThan(agentCostPerSolved(2005));
  });

  it("keeps an installed ChadGPT working on a save from before usage billing", () => {
    const s = withChad(15, 20);
    const data = JSON.parse(serialize(s));
    delete data.chadUsage;
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.chadUsage).toEqual({ attempts: 0, tokens: 0, cost: 0, solved: 0 });
    runTo(loaded, 24);
    expect(loaded.chadUsage.attempts).toBeGreaterThan(0);
  });
});
