import { afterEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { DeskId } from "../src/sim/10-catalog/desks";
import { openDesk } from "../src/sim/40-support/desk";
import {
  agentCostPerSolved, AGENT_NAME, aiOffered, attemptTokens, botOdds, BOT_RIGHT, BOT_TRIES, costPerSolved, DESK_AI_FEE, draftOf, pricePerMTokens, tokenCost,
} from "../src/sim/40-support/desk-ai";
import { importTicket } from "../src/sim/40-support/desk-work";
import { supportTick } from "../src/sim/40-support/tick";
import { bumpProbe, createTicket, rightTemplate } from "../src/sim/40-support/tickets";
import { activeBots } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setDeskAi } from "../src/sim/90-actions/desk";
import { replyTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const START = hourOf(new Date(Date.UTC(2024, 0, 3, 0)));
const BOT = AGENT_NAME.zendusk;
const runFor = (s: GameState, hours: number) => { const end = s.hour + hours; while (s.hour < end) tick(s); };
const botReplies = (s: GameState) => s.tickets.flatMap((t) => t.replies.filter((r) => r.by === BOT));
const usage = (s: GameState) => s.desk!.ai.usage;

// A hosted Zendusk in 2024 with the Automation skill and a desk ticket per customer.
function withAgent(seed: number, tickets: number, kind: "howTo" | "billing" = "howTo", feature: "autoAnswer" | "drafting" = "autoAnswer", id: DeskId = "zendusk"): GameState {
  const s = { ...newGame(seed), hour: START, cash: 100_000 };
  s.unlocks = ["people", "monitoring", "automation"];
  openDesk(s, id, { kind: "hosted" }, "pxl");
  if (!setDeskAi(s, feature, true).ok) throw new Error("switch");
  for (let i = 0; i < tickets; i++) {
    const cid = addCustomer(s, `Customer ${i}`, "private");
    importTicket(s, createTicket(s, s.customers.find((c) => c.id === cid)!, kind), true);
  }
  return s;
}

afterEach(() => { bumpProbe.fn = null; });

describe("the hosted desks' generative AI", () => {
  it("starts in 2023, only on hosted desks and with the Automation skill", () => {
    const at = (y: number, id: DeskId) => {
      const s = { ...newGame(3), hour: hourOf(new Date(Date.UTC(y, 0, 3))), cash: 1e5 };
      if (id === "zendusk" || id === "freshdusk") openDesk(s, id, { kind: "hosted" }, "pxl");
      else openDesk(s, id);
      return s;
    };
    for (const id of ["zendusk", "freshdusk"] as const) {
      expect(aiOffered(at(2022, id), "autoAnswer")).toBe(false);
      expect(aiOffered(at(2022, id), "drafting")).toBe(false);
      expect(aiOffered(at(2023, id), "autoAnswer")).toBe(true);
      expect(aiOffered(at(2023, id), "drafting")).toBe(true);
    }
    for (const id of ["ostickit", "freescoot"] as const) expect(aiOffered(at(2024, id), "autoAnswer")).toBe(false);
    const s = at(2024, "zendusk");
    expect(setDeskAi(s, "autoAnswer", true)).toEqual({ ok: false, error: "error.needsResearch" });
    expect(activeBots(s)).toEqual([]);
    s.unlocks = ["automation"];
    expect(setDeskAi(s, "autoAnswer", true).ok).toBe(true);
    expect(activeBots(s).map((b) => [b.id, b.name, b.role])).toEqual([["deskAi", BOT, "support"]]);
  });

  it("bills every reply in tokens, and a retry rereads the thread at a higher price", () => {
    const s = withAgent(11, 60);
    runFor(s, 24 * 5);
    const replies = botReplies(s);
    expect(usage(s).attempts).toBe(replies.length);
    expect(replies.length).toBeGreaterThan(60);
    const tokens = s.tickets.reduce((a, t) => a + t.replies.reduce((b, r, i) => b + (r.by === BOT ? attemptTokens(i, 2024) : 0), 0), 0);
    expect(usage(s).tokens).toBe(tokens);
    expect(usage(s).cost).toBeCloseTo(tokenCost(tokens, 2024), 6);
    expect(attemptTokens(2, 2024)).toBeGreaterThan(attemptTokens(1, 2024));
    expect(s.tickets.some((t) => t.replies.filter((r) => r.by === BOT).length >= 2)).toBe(true);
  });

  it("gives up after four replies, leaves the ticket open and costs the customer happiness", () => {
    const s = withAgent(12, 120, "billing");
    const tens: Record<string, number> = {};
    bumpProbe.fn = (c, d) => { if (d === -10) tens[c.id] = (tens[c.id] ?? 0) + 1; };
    runFor(s, 24 * 5);
    const given = s.tickets.filter((t) => t.replies.filter((r) => r.by === BOT && !r.right).length === BOT_TRIES);
    expect(given.length).toBeGreaterThan(3);
    for (const t of given) {
      expect(t.status).toBe("open");
      expect(tens[t.customerId]).toBe(BOT_TRIES + 1);
    }
    const before = given.map((t) => t.replies.length);
    runFor(s, 24 * 5);
    expect(given.map((t) => s.tickets.find((x) => x.id === t.id)!.replies.length)).toEqual(before);
  });

  it("bills last month's usage and the add-on as ledger lines at the month start", () => {
    const s = withAgent(13, 40);
    const monthStart = hourOf(new Date(Date.UTC(2024, 1, 1)));
    runFor(s, monthStart - 1 - s.hour);
    const { cost } = usage(s), cash = s.cash;
    runFor(s, 2);
    const line = s.ledger.find((l) => l.key === "ledger.deskAi")!;
    expect(line).toMatchObject({ category: "ai", hour: monthStart });
    expect(line.amount).toBeCloseTo(-cost, 2);
    expect(s.ledger.find((l) => l.key === "ledger.deskAiAddon")).toMatchObject({ hour: monthStart, amount: -DESK_AI_FEE });
    expect(s.cash).toBeLessThan(cash);
    expect(usage(s).attempts).toBeLessThan(5);
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
    // In the years the desks offer it, salaries have outgrown the token price a little more.
    for (let year = 2023; year <= 2030; year++) for (const kind of ["howTo", "billing"] as const) {
      const share = costPerSolved(kind, year) / agentCostPerSolved(year);
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.5);
    }
    expect(pricePerMTokens(2024)).toBeLessThan(pricePerMTokens(2010));
    const s = withAgent(14, 200);
    runFor(s, 24 * 6);
    expect(usage(s).solved).toBeGreaterThan(100);
    expect(usage(s).cost / usage(s).solved).toBeLessThan(agentCostPerSolved(2024));
  });

  it("drafts the right reply with the agent's odds and bills each draft", () => {
    const s = withAgent(16, 400, "billing", "drafting");
    supportTick(s);
    const open = s.tickets.filter((t) => t.kind === "billing" && t.status === "open");
    const drafts = open.map((t) => [t, draftOf(t)] as const).filter(([, d]) => d);
    expect(drafts.length).toBe(open.length);
    const right = drafts.filter(([t, d]) => d === rightTemplate(s, t)).length / drafts.length;
    expect(right).toBeGreaterThan(BOT_RIGHT.billing - 0.08);
    expect(right).toBeLessThan(BOT_RIGHT.billing + 0.08);
    expect(usage(s)).toMatchObject({ drafts: drafts.length, attempts: 0, tokens: drafts.length * attemptTokens(0, 2024) });
    // The draft stays until the thread changes, and sending it is the usual reply.
    s.hour++;
    supportTick(s);
    expect(usage(s).drafts).toBe(drafts.length);
    const [t, d] = drafts[0];
    expect(replyTicket(s, t.id, d!).ok).toBe(true);
    expect(draftOf(s.tickets.find((x) => x.id === t.id)!)).toBe(null);
  });

  it("loads a save with ChadGPT installed without the bot or a usage line", () => {
    const s = { ...newGame(15), hour: START, cash: 1e5 };
    s.unlocks = ["automation"];
    const data = JSON.parse(serialize(s));
    data.installed = [...data.installed, "chadGpt"];
    data.chadUsage = { attempts: 5, tokens: 30000, cost: 2, solved: 1 };
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.installed).not.toContain("chadGpt");
    expect("chadUsage" in loaded).toBe(false);
    expect(activeBots(loaded)).toEqual([]);
    runFor(loaded, 24 * 31);
    expect(loaded.ledger.some((l) => l.key === "ledger.chadUsage" || l.key === "ledger.deskAi")).toBe(false);
  });
});
