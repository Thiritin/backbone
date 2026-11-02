import { describe, expect, it } from "vitest";
import { mailDelay, mailImpaired, mailShare } from "../src/sim/80-business/mail";
import { issueInvoice } from "../src/sim/30-market/manual";
import { salesTick } from "../src/sim/30-market/sales";
import { type GameState } from "../src/sim/50-state";
import { readyGame } from "./fixtures";
import { run, selfHosted } from "./company-mail.helpers";

describe("impaired delivery", () => {
  it("lists a mail server on a dynamic line and halves email orders", () => {
    const s = readyGame(4);
    selfHosted(s);
    expect(mailImpaired(s)).toBe(false);
    expect(mailShare(s)).toBe(1);
    s.homeLine = { id: "dsl-16", next: null };
    run(s, 2);
    expect(mailImpaired(s)).toBe(true);
    expect(mailShare(s)).toBe(0.5);
  });

  it("is impaired while the mail host is down", () => {
    const s = readyGame(4);
    selfHosted(s);
    expect(mailImpaired(s)).toBe(false);
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, on: false } : d));
    expect(mailImpaired(s)).toBe(true);
  });

  it("brings fewer order emails than external mail over the same days", () => {
    const orders = (impaired: boolean) => {
      const s = readyGame(3);
      if (impaired) {
        selfHosted(s);
        s.homeLine = { id: "dsl-16", next: null };
        run(s, 2);
      }
      s.marketing = { ...s.marketing, campaigns: Array.from({ length: 20 }, () => ({ channel: "search" as const, profiles: ["smallBiz" as const], budget: 5000, discount: 0 })) };
      for (let h = 0; h < 72; h++) { s.hour++; salesTick(s); }
      return s.sales.requests.filter((r) => r.kind === "order").length;
    };
    const healthy = orders(false);
    expect(healthy).toBeGreaterThan(10);
    expect(orders(true)).toBeLessThan(healthy * 0.75);
  });

  it("pays invoices sent in that window three days later", () => {
    const s = readyGame(5), c = s.customers[0];
    const pay = (x: GameState) => {
      x.rng = { ...x.rng, s: 12345 };
      return issueInvoice(x, c.id, [{ serviceId: null, key: "invoice.line.firstMonth", params: { label: "x" }, amount: 10 }]);
    };
    const copy = structuredClone(s);
    const base = pay(s);
    expect(base.payStep).toBe(0);
    selfHosted(copy);
    copy.homeLine = { id: "dsl-16", next: null };
    run(copy, 2);
    expect(mailDelay(copy)).toBe(72);
    const hour = copy.hour;
    const late = pay(copy);
    expect(late.payStep).toBe(0);
    expect(late.payAt! - hour).toBe(base.payAt! - s.hour + 72);
  });
});
