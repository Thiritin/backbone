import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { Login } from "../src/ui/apps/browser/sites/portal/Login";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { PortalSite } from "../src/ui/apps/browser/sites/portal/PortalSite";
import { parsePortal } from "../src/sim/80-business/portal";
import { readyGame } from "./fixtures";

const shopGame = (id: Parameters<typeof chooseShop>[1] = "whmCache") => {
  const s = readyGame(2);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  chooseShop(s, id);
  s.hour += SHOP_SETUP_HOURS;
  return s;
};

describe("portal shell", () => {
  it("shows the login first", () => {
    const html = renderToString(<PortalSite game={shopGame()} host="portal.x.test" path="/admin/" go={() => {}} />);
    expect(html).toContain("Username");
    expect(html).toContain("admin");
    expect(html).toContain('type="password"');
    expect(html).toContain("Login");
  });

  it("renders the plain admin home after the login", () => {
    const s = shopGame();
    const route = parsePortal("whmCache", "/admin/")!;
    const { Admin } = skinOf("whmCache");
    const out = renderToString(<Admin game={s} variant="whmCache" route={route} open={() => {}} version="" major="" browse={() => {}} />);
    expect(out).toContain("Pending Orders");
    expect(out).toContain("Products/Services");
  });

  it("renders the store and client areas for every shop system", () => {
    const s = shopGame();
    for (const v of ["modemBill", "whmCache"] as const) {
      const { Store, Client } = skinOf(v);
      expect(renderToString(<Store game={s} variant={v} route={{ area: "store", query: new URLSearchParams() }} open={() => {}} version="" major="" browse={() => {}} />)).toContain("portal");
      expect(renderToString(<Client game={s} variant={v} route={{ area: "client", query: new URLSearchParams() }} open={() => {}} version="" major="" browse={() => {}} />)).toContain("Client area");
    }
  });

  it("renders the login form on its own", () => {
    expect(renderToString(<Login variant="whmCache" onLogin={() => {}} />)).toContain("WHMCache");
  });
});
