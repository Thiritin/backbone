import { describe, expect, it } from "vitest";
import { marketPrice } from "../src/sim/10-catalog/products";
import { yearOf } from "../src/sim/00-core/time";
import { termPrice } from "../src/sim/30-market/cycles";
import { emailRate, orderLead } from "../src/sim/30-market/orders";
import { offerPrice } from "../src/sim/30-market/spec";
import { discountFor } from "../src/sim/80-business/marketing";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { setRate } from "../src/sim/90-actions/rates";
import { setOptionDiscount } from "../src/sim/90-actions/portal";
import { chooseShop } from "../src/sim/90-actions/shop";
import type { GameState } from "../src/sim/50-state";
import { automate, readyGame } from "./fixtures";

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
    chooseShop(s, "handRolled");
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
    chooseShop(s, "handRolled");
    expect(termPrice(s, 10, "annual")).toBe(108);
    expect(setOptionDiscount(s, "annual", 0.2).ok).toBe(true);
    expect(termPrice(s, 10, "annual")).toBe(96);
    expect(setOptionDiscount(s, "annual", 0.6)).toMatchObject({ ok: false, error: "error.badDiscount" });
    expect(setOptionDiscount(s, "biennial", 0.1)).toMatchObject({ ok: false, error: "error.cycleNotSupported" });
    expect(setOptionDiscount(s, "annual", null).ok).toBe(true);
    expect(termPrice(s, 10, "annual")).toBe(108);
  });
});
