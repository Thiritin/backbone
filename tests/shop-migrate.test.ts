import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";

const load = (patch: (d: any) => void) => {
  const d = JSON.parse(serialize(newGame(5)));
  patch(d);
  return deserialize(JSON.stringify(d));
};

describe("order form save migration", () => {
  it("loads a saved order form channel as email orders", () => {
    const s = load((d) => { d.marketing.owned = ["website", "orderForm"]; });
    expect(s.shop.variant).toBeNull();
    expect(s.marketing.owned).toEqual(["website"]);
  });

  it("loads the hand-rolled variant as no shop, without its scripts and with email orders on", () => {
    const s = load((d) => { d.marketing.owned = ["website"]; d.marketing.emailOrders = false; d.shop.variant = "hostBull"; d.shop.modules = { cpanic: 0 }; });
    expect(s.shop).toMatchObject({ variant: null, modules: {} });
    expect(s.marketing.emailOrders).toBe(true);
  });

  it("keeps a chosen variant and drops the channel", () => {
    const s = load((d) => { d.marketing.owned = ["website", "orderForm"]; d.shop.variant = "clientExit"; });
    expect(s.shop.variant).toBe("clientExit");
    expect(s.marketing.owned).toEqual(["website"]);
  });

  it("leaves a state with neither unchanged", () => {
    const s = load((d) => { d.marketing.owned = ["website"]; });
    expect(s.shop.variant).toBeNull();
  });
});
