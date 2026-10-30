import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { setLine } from "../src/sim/90-actions/website";
import { Shop } from "../src/ui/apps/marketing/Shop";
import { readyGame } from "./fixtures";

describe("shop section", () => {
  it("shows the variants, modules and stock of the chosen shop", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    setUpChannel(s, "website");
    setUpChannel(s, "orderForm");
    expect(s.marketing.owned).toEqual(["website", "orderForm"]);
    let html = renderToString(<Shop game={s} />);
    expect(html).toContain("Hand-rolled order form");
    expect(html).toContain("Custom scripts");
    expect(html).not.toContain("WHMCache");
    s.unlocks = [...s.unlocks, "shops"];
    expect(chooseShop(s, "whmCache").ok).toBe(true);
    setLine(s, "webHosting", true);
    html = renderToString(<Shop game={s} />);
    expect(html).toContain("WHMCache");
    expect(html).toContain("Included");
    expect(html).toContain("Free capacity");
    expect(html).toContain("Server groups");
    expect(html).toContain("Deploy automatic orders");
  });
});
