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
    let html = renderToString(<Shop game={s} />);
    expect(html).not.toContain("WHMCache");
    s.unlocks = [...s.unlocks, "shops"];
    expect(chooseShop(s, "whmCache").ok).toBe(true);
    setLine(s, "webHosting", true);
    html = renderToString(<Shop game={s} />);
    expect(html).toContain("WHMCache");
    expect(html).toContain("Included");
    expect(html).not.toContain("Server groups");
    expect(html).not.toContain("Pricing");
  });
});
