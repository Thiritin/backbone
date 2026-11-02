import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { resolve } from "../src/sim/80-business/browser";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { parsePortal, portalPath, type PortalArea } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup, setProductPrice } from "../src/sim/90-actions/portal";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { Ubersmyth } from "../src/ui/apps/browser/sites/shopvendors/ubersmyth";
import { useStore } from "../src/ui/store";
import { withCard } from "./fixtures";
import { idOf, shopGame } from "./portal-helpers";

const game = (year: number) => {
  const s = shopGame("ubersmyth", year);
  const p = idOf(createProduct(s, idOf(createProductGroup(s, "Dedicated")), "Forge One", "dedicated"));
  setProductPrice(s, p, "monthly", 90);
  s.customers.push({ id: "c1", name: "Ada Lovelace", since: 0, churnedAt: null } as never);
  return s;
};
const skin = skinOf("ubersmyth");
const page = (s: ReturnType<typeof game>, area: PortalArea, major: string, screen?: Record<string, string>, part: "Admin" | "Store" | "Client" = "Admin") => {
  const route = parsePortal("ubersmyth", portalPath("ubersmyth", area, {}, screen))!;
  const Part = skin[part];
  return renderToString(<Part game={s} variant="ubersmyth" route={route} open={() => {}} version="" major={major} browse={() => {}} />);
};

describe("Ubersmyth portal", () => {
  it.each(["2", "3", "4", "5"])("frames the admin, store and client portal of major %s in its own look", (major) => {
    const s = game(2016);
    const admin = page(s, "admin", major, { s: "servers" });
    expect(admin).toContain(`ubs-${major}`);
    const labels = major === "5" ? ["Overview", "Billing", "Catalogue", "Infrastructure", "System"] : ["Dashboard", "Client Manager", "Device Manager", "Licence", "Updates"];
    for (const label of labels) expect(admin).toContain(label);
    expect(page(s, "store", major, undefined, "Store")).toContain("Forge One");
    expect(page(s, "client", major, undefined, "Client")).toContain("Ada Lovelace");
    expect(page(s, "client", major, { c: "c1" }, "Client")).toContain("Sign out");
    const Login = skin.Login!;
    expect(renderToString(<Login game={s} variant="ubersmyth" route={{ area: "admin", query: new URLSearchParams() }} open={() => {}} version="" major={major} browse={() => {}} onLogin={() => {}} />)).toContain("Staff login");
  });
});

describe("ubersmyth.com", () => {
  it("sells keys on its own site and lists them under My account", () => {
    const s = withCard(game(2006));
    s.hour = hourOfMonth("2013-03");
    expect(hostOf("ubersmyth")).toBe("ubersmyth.com");
    expect(resolve(s, "ubersmyth.com/account").page).toEqual({ kind: "shopVendor", id: "ubersmyth" });
    useStore.setState({ game: s });
    const at = (path: string) => renderToString(<Ubersmyth game={s} path={path} go={() => {}} />);
    expect(at("/pricing")).toContain("Add to cart");
    expect(at("/releases")).toContain("3.0");
    expect(at("/addons")).toContain("Shop link");
    expect(addToCart(s, "ubersmyth", "standard").ok).toBe(true);
    expect(checkout(s, "ubersmyth.com", "card").ok).toBe(true);
    const account = at("/account");
    expect(account).toContain("Standard");
    expect(account).toContain("Copy key");
  });
});
