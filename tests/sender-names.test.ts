import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import { senderFor } from "../src/sim/30-market/market";

describe("sender names", () => {
  it("draws a wide spread of contacts and companies at home and in the US", () => {
    for (const us of [false, true]) {
      const r = createRng(42);
      const contacts = new Set<string>(), shops = new Set<string>(), trades = new Set<string>();
      for (let i = 0; i < 2000; i++) {
        contacts.add(senderFor(r, "private", false, us).contact);
        shops.add(senderFor(r, "onlineShop", false, us).company!);
        trades.add(senderFor(r, "soleProp", false, us).company!.split(" ").slice(1).join(" "));
      }
      expect(contacts.size).toBeGreaterThan(1500);
      expect(shops.size).toBe(12);
      expect(trades.size).toBe(16);
    }
  });
});
