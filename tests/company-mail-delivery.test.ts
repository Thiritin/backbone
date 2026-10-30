import { describe, expect, it } from "vitest";
import { mailDelay, mailImpaired, mailShare } from "../src/sim/80-business/mail";
import { issueInvoice } from "../src/sim/30-market/manual";
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

  it("brings fewer order emails than external mail over the same weeks", () => {
    const orders = (impaired: boolean) => {
      let n = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const s = readyGame(seed);
        s.marketing.owned = ["website"];
        if (impaired) {
          selfHosted(s);
          s.homeLine = { id: "dsl-16", next: null };
        }
        run(s, 24 * 90);
        n += s.sales.requests.filter((r) => r.kind === "order").length;
      }
      return n;
    };
    const healthy = orders(false), impaired = orders(true);
    expect(healthy).toBeGreaterThan(0);
    expect(impaired).toBeLessThan(healthy);
  }, 60_000);

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
