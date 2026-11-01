import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { LicenceScreen, NotTakingOrders, UpdatesScreen, VersionFooter } from "../src/ui/apps/browser/sites/portal/shared/Licence";
import { readyGame } from "./fixtures";

const shop = () => {
  const s = readyGame(5);
  s.hour = hourOfMonth("2009-05");
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "whmCache", true).ok).toBe(true);
  return s;
};

describe("shared shop admin screens", () => {
  it("show the key, the updates window, the installed version and the closed store", () => {
    const s = shop(), key = s.licenses.find((k) => k.product === "whmCache")!.key;
    expect(renderToString(<LicenceScreen game={s} />)).toContain(key);
    const updates = renderToString(<UpdatesScreen game={s} />);
    expect(updates).toContain("3.0");
    expect(updates).toContain("Renew updates for 45");
    expect(renderToString(<VersionFooter game={s} variant="whmCache" />)).toContain("WHMCache 3.0");
    s.shop = { ...s.shop, install: null };
    expect(renderToString(<NotTakingOrders game={s} />)).toContain("The shop system is not installed.");
  });
});
