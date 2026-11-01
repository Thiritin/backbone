import { describe, expect, it } from "vitest";
import { emailFor } from "../src/sim/30-market/orders";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { buyModule, chooseShop } from "../src/sim/90-actions/shop";
import { setEmailOrders } from "../src/sim/90-actions/website";
import { readyGame } from "./fixtures";

const game = () => {
  const s = readyGame(3);
  s.cash = 1e6;
  setUpChannel(s, "website");
  return s;
};

describe("orders before a shop system", () => {
  it("arrive by email and cannot be switched off", () => {
    const s = game();
    expect(emailFor(s)).toBe(true);
    expect(setEmailOrders(s, false)).toEqual({ ok: false, error: "error.needsShop" });
    expect(s.marketing.emailOrders).toBe(true);
  });

  it("need the shops research for every variant and a variant for modules", () => {
    const s = game();
    expect(chooseShop(s, "hostBull" as never)).toEqual({ ok: false, error: "error.unknownShop" });
    expect(chooseShop(s, "clientExit")).toEqual({ ok: false, error: "error.needsShopSkill" });
    expect(buyModule(s, "cpanic")).toEqual({ ok: false, error: "error.needsShop" });
    s.unlocks = [...s.unlocks, "shops"];
    expect(chooseShop(s, "clientExit").ok).toBe(true);
    expect(s.shop.readyAt).toBeGreaterThan(s.hour);
  });
});
