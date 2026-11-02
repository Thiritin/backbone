import { describe, expect, it } from "vitest";
import { SHOPS, SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { companyDomain } from "../src/sim/30-customers/domains";
import { resolve } from "../src/sim/80-business/browser";
import { parsePortal, portalPath, type PortalArea } from "../src/sim/80-business/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { readyGame, installWithKey } from "./fixtures";

const AREAS: PortalArea[] = ["store", "configure", "cart", "client", "admin"];
const withShop = () => {
  const s = readyGame(3);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.marketing.launched = true;
  s.unlocks = [...s.unlocks, "shops"];
  installWithKey(s, "modemBill");
  return s;
};

describe("portal host", () => {
  it("resolves only with an active shop and follows the site status", () => {
    const s = withShop();
    const url = `portal.${companyDomain(s)}/admin`;
    s.shop.readyAt = s.hour + SHOP_SETUP_HOURS;
    expect(resolve(s, url).page.kind).toBe("notfound");
    s.hour = s.shop.readyAt;
    expect(resolve(s, url)).toMatchObject({ page: { kind: "shop" }, load: "fast" });
    s.shop = { ...s.shop, variant: null };
    expect(resolve(s, url).page.kind).toBe("notfound");
  });

  it("shows the portal as down while the website is down", () => {
    const s = withShop();
    s.hour = s.shop.readyAt;
    const www = resolve(s, companyDomain(s)).load;
    expect(resolve(s, `portal.${companyDomain(s)}/`).load).toBe(www);
  });
});

describe("portal paths", () => {
  it("round trip per shop system", () => {
    for (const v of SHOPS) for (const area of AREAS) {
      const ids = { group: "pg1", product: "prod2" };
      const path = portalPath(v.id, area, ids);
      const route = parsePortal(v.id, path);
      // Single page orders have no cart address of their own.
      const want = area === "cart" && !route?.area.match(/cart/) ? "configure" : area;
      expect(route?.area, `${v.id} ${area} ${path}`).toBe(want);
      if (area === "configure" || (area === "cart" && want === "configure")) expect(route?.product).toBe("prod2");
      if (area === "store" && v.id !== "ubersmyth" && v.id !== "orderBocks" && v.id !== "boxBillin") expect(route?.group).toBe("pg1");
    }
  });

  it("keeps the screen of an admin address", () => {
    const path = portalPath("whmCache", "admin", {}, { s: "product", id: "prod4", tab: "pricing" });
    expect(path).toBe("/admin/?s=product&id=prod4&tab=pricing");
    const r = parsePortal("whmCache", path)!;
    expect(r.area).toBe("admin");
    expect(r.query.get("tab")).toBe("pricing");
    expect(parsePortal("whmCache", "/cart.php")?.area).toBe("store");
    expect(parsePortal("boxBillin", "/nothing")).toBeNull();
  });
});
