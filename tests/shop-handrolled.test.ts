import { describe, expect, it } from "vitest";
import { SHOPS } from "../src/sim/10-catalog/shops";
import { orderLead } from "../src/sim/30-market/orders";
import { hasOrderForm } from "../src/sim/80-business/marketing";
import { deployable, shopBills, stockOf } from "../src/sim/80-business/shop";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { buyModule, chooseShop } from "../src/sim/90-actions/shop";
import { readyGame } from "./fixtures";

const game = () => {
  const s = readyGame(3);
  s.cash = 1e6;
  setUpChannel(s, "website");
  return s;
};

describe("hand-rolled order form", () => {
  it("is bought once without research and takes orders at once", () => {
    const s = game();
    const cash = s.cash;
    expect(s.unlocks).not.toContain("shops");
    expect(chooseShop(s, "handRolled").ok).toBe(true);
    expect(s.cash).toBe(cash - 900);
    expect(s.shop.readyAt).toBe(s.hour);
    expect(hasOrderForm(s)).toBe(true);
    expect(setUpChannel(s, "orderForm" as never)).toEqual({ ok: false, error: "error.unknownChannel" });
  });

  it("owes no monthly bill and keeps selling from every target", () => {
    const s = game();
    chooseShop(s, "handRolled");
    expect(shopBills(s)).toEqual([]);
    expect(deployable(s, "cl1")).toBe(true);
    expect(stockOf(s, "webHosting")).toBe(10);
    expect(SHOPS.find((v) => v.id === "handRolled")).toMatchObject({ monthly: 0, yearly: 0, extra: 400 });
  });

  it("sells custom scripts and keeps the three day rule when switching to a shop", () => {
    const s = game();
    chooseShop(s, "handRolled");
    expect(buyModule(s, "cpanic").ok).toBe(true);
    s.unlocks = [...s.unlocks, "shops"];
    expect(chooseShop(s, "clientExit").ok).toBe(true);
    expect(hasOrderForm(s)).toBe(false);
  });

  it("does not take stock for a form order", () => {
    const s = game();
    chooseShop(s, "handRolled");
    s.shop.stock = { webHosting: 3 };
    orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 1, sla: "basic" }, false);
    expect(s.shop.stock.webHosting).toBe(3);
  });
});
