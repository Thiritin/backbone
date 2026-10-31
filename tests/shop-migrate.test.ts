import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";

const load = (patch: (d: any) => void) => {
  const d = JSON.parse(serialize(newGame(5)));
  patch(d);
  return deserialize(JSON.stringify(d));
};

describe("order form save migration", () => {
  it("loads a saved order form as the hand-rolled variant", () => {
    const s = load((d) => { d.marketing.owned = ["website", "orderForm"]; });
    expect(s.shop).toMatchObject({ variant: "handRolled", since: 0, readyAt: 0 });
    expect(s.marketing.owned).toEqual(["website"]);
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
