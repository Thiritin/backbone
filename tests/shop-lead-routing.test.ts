import { describe, expect, it } from "vitest";
import { salesTick } from "../src/sim/30-market/sales";
import { syncTicketMail } from "../src/sim/42-mail/tickets";
import type { GameState } from "../src/sim/50-state";
import { openShop, readyGame } from "./fixtures";

const YEAR = 8760;

// Runs the lead flow for a while with every profile aware of the company and returns the requests that ask for a quote.
function asks(s: GameState, hours = 1500) {
  s.marketing = { ...s.marketing, awareness: Object.fromEntries(Object.keys(s.marketing.awareness).map((p) => [p, 1])) as typeof s.marketing.awareness };
  const from = s.sales.requests.length;
  for (let i = 0; i < hours; i++) { s.hour++; salesTick(s); }
  return s.sales.requests.slice(from).filter((r) => r.kind === "order" && !r.shop);
}
const shopGame = (seed: number, emailOrders: boolean) => {
  const s = openShop(readyGame(seed), "whmCache");
  s.hour = YEAR;
  s.marketing = { ...s.marketing, emailOrders };
  // The mail walk delivers every ticket opened from here on.
  s.mail = { ...s.mail, seen: 1 };
  return s;
};
const mailed = (s: GameState, ticketId: string | null) => Object.values(s.mail.msgs).some((box) => box.some((m) => m.ticket === ticketId));

describe("lead routing with a shop", () => {
  it("sends every quote request through the shop and none by email with email orders off", () => {
    const s = shopGame(5, false);
    const got = asks(s);
    syncTicketMail(s);
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((r) => r.viaShop)).toBe(true);
    expect(got.some((r) => mailed(s, r.ticketId))).toBe(false);
  });

  it("keeps an email share of quote requests by email with email orders on", () => {
    const s = shopGame(5, true), got = asks(s);
    syncTicketMail(s);
    expect(got.some((r) => r.viaShop)).toBe(true);
    expect(got.filter((r) => !r.viaShop).some((r) => mailed(s, r.ticketId))).toBe(true);
  });

  it("sends quote requests by email before a shop", () => {
    const s = readyGame(5);
    s.hour = YEAR;
    expect(asks(s).some((r) => r.viaShop)).toBe(false);
  });
});
