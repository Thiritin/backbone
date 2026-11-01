import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop, upgradeShop } from "../src/sim/90-actions/shop";
import { orderBocksSkin } from "../src/ui/apps/browser/sites/portal/orderbocks";
import { OrderBocks } from "../src/ui/apps/browser/sites/shopvendors/orderbocks";
import { readyGame } from "./fixtures";

const shop = (month: string) => {
  const s = readyGame(5);
  s.hour = hourOfMonth(month);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "orderBocks").ok).toBe(true);
  return s;
};
const props = (s: ReturnType<typeof shop>, major: string, area: "admin" | "store" | "client" = "admin") =>
  ({ game: s, variant: "orderBocks" as const, route: { area, query: new URLSearchParams() }, open: () => {}, version: major, major, browse: () => {} });

describe("OrderBocks", () => {
  it("sells from orderbocks.com and moves to the next major for free", () => {
    expect(hostOf("orderBocks")).toBe("orderbocks.com");
    const s = shop("2015-03");
    expect(s.shop.install?.version).toBe("8");
    s.hour = hourOfMonth("2020-01");
    const cash = s.cash;
    expect(upgradeShop(s).ok).toBe(true);
    expect(s.shop.install?.version).toBe("9");
    expect(s.cash).toBe(cash);
  });

  it("changes its admin and store look at majors 7, 8 and 9", () => {
    const s = shop("2020-01");
    for (const [major, era] of [["6.3", "box"], ["7", "gloss"], ["8", "flat"], ["9", "panel"]]) {
      expect(renderToString(<orderBocksSkin.Admin {...props(s, major)} />)).toContain(`ob-${era}`);
      expect(renderToString(<orderBocksSkin.Store {...props(s, major, "store")} />)).toContain(`ob-${era}`);
    }
  });

  it("follows the newest release on its vendor site and offers the upgrade in My account", () => {
    const s = shop("2015-03");
    expect(renderToString(<OrderBocks game={s} path="/" />)).toContain("obv-flat");
    s.hour = hourOfMonth("2020-01");
    const account = renderToString(<OrderBocks game={s} path="/account" />);
    expect(account).toContain("obv-panel");
    expect(account).toContain("Upgrade to 9");
  });
});
