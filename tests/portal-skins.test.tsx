import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ShopId } from "../src/sim/10-catalog/shops";
import { shopById } from "../src/sim/10-catalog/shops";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup, setProductPrice } from "../src/sim/90-actions/portal";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { shopGame, idOf, render } from "./portal-helpers";

const LABEL: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", semiannual: "Semi-annually", annual: "Annually", biennial: "Biennially", triennial: "Triennially" };

// Variants that run on the game's first years, then the ones that need a later start.
const LEGACY: ShopId[] = ["modemBill", "clientExit"];
const PRODUCTS_LABEL: Record<string, string> = { modemBill: "Packages", clientExit: "Product Groups", blessta: "Package Groups", boxBillin: "Products", hostBull: "Order pages" };
const MODERN: ShopId[] = ["blessta", "boxBillin", "hostBull"];

const setup = (variant: ShopId): { s: GameState; g: string; p: string } => {
  const v = shopById(variant);
  const s = shopGame(variant, Math.max(2005, v.from));
  const g = idOf(createProductGroup(s, "Shared hosting"));
  const p = idOf(createProduct(s, g, "Starter", "webHosting"));
  for (const c of v.cycles) setProductPrice(s, p, c, c === "monthly" ? 5 : 40);
  return { s, g, p };
};

const admin = (s: GameState, variant: ShopId, screen: Record<string, string>) => {
  const route = parsePortal(variant, portalPath(variant, "admin", {}, screen))!;
  const { Admin } = skinOf(variant);
  return renderToString(<Admin game={s} variant={variant} route={route} open={() => {}} version="" major="" browse={() => {}} />);
};

describe.each([...LEGACY, ...MODERN])("%s skin", (variant) => {
  it("renders its pricing screen with its own cycles", () => {
    const { s, p } = setup(variant);
    const html = admin(s, variant, { s: "product", id: p, tab: "pricing" });
    for (const c of shopById(variant).cycles) expect(html).toContain(LABEL[c]);
    for (const c of ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"]) if (!shopById(variant).cycles.includes(c as never)) expect(html).not.toContain(LABEL[c]);
  });

  it("renders store, configure and client area in its frame", () => {
    const { s, g, p } = setup(variant);
    const store = render(s, variant, "store", { group: g });
    expect(store).toContain("Starter");
    expect(store).toContain(shopById(variant).name.replace("'", "&#x27;"));
    expect(render(s, variant, "configure", { group: g, product: p })).toContain("Add to Cart");
    s.customers.push({ id: "c1", name: "Ada Lovelace", since: 0, churnedAt: null } as never);
    expect(render(s, variant, "client", {}, { c: "c1" }, "Client")).toContain("Ada Lovelace");
  });

  it("names the products screen in the system's own words", () => {
    const { s } = setup(variant);
    expect(admin(s, variant, { s: "products" })).toContain(`>${PRODUCTS_LABEL[variant]}</a>`);
  });
});

describe("store groups", () => {
  it("keep group headings", () => {
    for (const variant of ["modemBill", "boxBillin"] as ShopId[]) {
      const { s, g } = setup(variant);
      expect(render(s, variant, "store", { group: g })).toContain("<h2>Shared hosting</h2>");
    }
  });

});
