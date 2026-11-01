import { describe, expect, it } from "vitest";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { marketPrice } from "../src/sim/10-catalog/products";
import { yearOf } from "../src/sim/00-core/time";
import { termPrice } from "../src/sim/30-market/cycles";
import { acceptChance } from "../src/sim/30-market/market";
import { attachQuote, createQuote, effectiveMonthly, setQuoteCycle } from "../src/sim/90-actions/orders";
import { emailRate, orderLead } from "../src/sim/30-market/orders";
import { offerPrice } from "../src/sim/30-market/spec";
import { discountFor } from "../src/sim/80-business/marketing";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { setRate } from "../src/sim/90-actions/rates";
import { setOptionDiscount } from "../src/sim/90-actions/portal";
import type { GameState } from "../src/sim/50-state";
import { automate, readyGame, installWithKey } from "./fixtures";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };
const quoted = (s: GameState) => {
  const r = orderLead(s, "private", "Frankfurt", [], web, true);
  return { r: s.sales.requests.find((x) => x.id === r.id)!, discount: discountFor(s, "private") };
};

describe("email quotes and option discounts", () => {
  it("quote at the market rate without a shop, even with saved rates", () => {
    const s = automate(readyGame(4));
    setRate(s, "webHosting", "base", 99);
    const { r, discount } = quoted(s);
    expect(offerPrice(s, "webHosting", r.spec)).not.toBeCloseTo(marketPrice("webHosting", r.spec, yearOf(s.hour)), 2);
    expect(emailRate(s, "webHosting", r.spec, "basic")).toBe(marketPrice("webHosting", r.spec, yearOf(s.hour), "basic"));
    expect(r.quote).toBe(Math.round(marketPrice("webHosting", r.spec, yearOf(s.hour), "basic") * (1 - discount) * 100) / 100);
  });

  it("quote at the configurable option rates once a shop is active", () => {
    const s = automate(readyGame(4));
    s.cash = 1e6;
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    installWithKey(s, "modemBill");
    s.hour += SHOP_SETUP_HOURS;
    setRate(s, "webHosting", "base", 99);
    const { r, discount } = quoted(s);
    expect(r.quote).toBe(Math.round(offerPrice(s, "webHosting", r.spec, "basic") * (1 - discount) * 100) / 100);
    expect(emailRate(s, "webHosting", r.spec, "basic")).toBe(offerPrice(s, "webHosting", r.spec, "basic"));
  });

  it("set the term price of a custom configuration with the cycle discount", () => {
    const s = readyGame(4);
    expect(setOptionDiscount(s, "annual", 0.2)).toMatchObject({ ok: false, error: "error.needsShop" });
    s.cash = 1e6;
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    installWithKey(s, "modemBill");
    expect(termPrice(s, 10, "annual")).toBe(108);
    expect(setOptionDiscount(s, "annual", 0.2).ok).toBe(true);
    expect(termPrice(s, 10, "annual")).toBe(96);
    expect(setOptionDiscount(s, "annual", 0.6)).toMatchObject({ ok: false, error: "error.badDiscount" });
    expect(setOptionDiscount(s, "biennial", 0.1)).toMatchObject({ ok: false, error: "error.cycleNotSupported" });
    expect(setOptionDiscount(s, "annual", null).ok).toBe(true);
    expect(termPrice(s, 10, "annual")).toBe(108);
  });
});

describe("email quote with a billing cycle", () => {
  it("offers a prepaid term at the discount and the customer weighs the discounted price", () => {
    const s = readyGame(4);
    s.cash = 1e6;
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    installWithKey(s, "whmCache");
    s.shop.variant = "whmCache";
    const { r } = quoted(s);
    const t = s.tickets.find((x) => x.id === r.ticketId)!;
    const qid = (createQuote(s, t.id) as { id: string }).id;
    expect(setQuoteCycle(s, qid, "monthly")).toMatchObject({ ok: false, error: "error.cycleNotSupported" });
    expect(setQuoteCycle(s, qid, "triennial").ok).toBe(true);
    const q = s.quotes.find((x) => x.id === qid)!;
    expect(q.lines.find((l) => l.key === "invoice.line.firstTerm")!.amount).toBe(Math.round(effectiveMonthly(s, q.monthly, "triennial") * 36 * 100) / 100);
    expect(attachQuote(s, qid, t.id).ok).toBe(true);
    const sent = s.sales.requests.find((x) => x.id === r.id)!;
    expect(sent.cycle).toBe("triennial");
    expect(sent.quote).toBe(Math.round(q.monthly * 0.8 * 100) / 100);
    expect(acceptChance(s, sent, sent.quote!)).toBeGreaterThan(acceptChance(s, sent, q.monthly));
  });

  it("refuses a cycle the shop does not sell", () => {
    const s = readyGame(4);
    s.cash = 1e6;
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    installWithKey(s, "modemBill");
    const { r } = quoted(s);
    const qid = (createQuote(s, r.ticketId!) as { id: string }).id;
    expect(setQuoteCycle(s, qid, "triennial")).toMatchObject({ ok: false, error: "error.cycleNotSupported" });
    expect(setQuoteCycle(s, qid, "annual").ok).toBe(true);
  });
});
