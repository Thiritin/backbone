import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { attachQuote, createQuote, editQuote } from "../src/sim/90-actions/orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { GameState } from "../src/sim/50-state";
import { openShop, readyGame } from "./fixtures";

const made = (s: GameState, ticketId: string): string => {
  const r = createQuote(s, ticketId);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const lead = (s: GameState) => orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 1, sla: "basic" }, true);

describe("shop quotes", () => {
  it("writes quotes in Books before a shop and in the shop once one is active", () => {
    const s = readyGame(21);
    const before = lead(s);
    const first = made(s, before.ticketId!);
    expect(s.quotes.find((x) => x.id === first)!.origin).toBe("books");
    openShop(s, "whmCache");
    const after = lead(s), id = made(s, after.ticketId!), q = s.quotes.find((x) => x.id === id)!;
    expect(q.origin).toBe("shop");
    expect(editQuote(s, q.id, 25, 0).ok).toBe(true);
    expect(attachQuote(s, q.id, after.ticketId!).ok).toBe(true);
    expect(s.quotes.find((x) => x.id === q.id)!.status).toBe("sent");
  });

  it("keeps a Books draft from before the shop editable in Books", () => {
    const s = readyGame(22);
    const r = lead(s), first = made(s, r.ticketId!);
    openShop(s, "whmCache");
    expect(made(s, r.ticketId!)).toBe(first);
    expect(s.quotes.find((x) => x.id === first)!.origin).toBe("books");
  });

  it("loads quotes saved before the origin as written in Books", () => {
    const s = readyGame(23);
    createQuote(s, lead(s).ticketId!);
    const old = JSON.parse(serialize(s));
    delete old.quotes[0].origin;
    expect(deserialize(JSON.stringify(old)).quotes[0].origin).toBe("books");
  });
});
