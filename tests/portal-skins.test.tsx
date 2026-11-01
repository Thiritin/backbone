import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ShopId } from "../src/sim/10-catalog/shops";
import { shopById } from "../src/sim/10-catalog/shops";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup, setProductPrice } from "../src/sim/90-actions/portal";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { shopGame, idOf, render } from "./portal-helpers";

const LABEL: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annually", biennial: "Biennially" };

// Variants that run on the game's first years, then the ones that need a later start.
const LEGACY: ShopId[] = ["handRolled", "modemBill", "clientExit"];
const PRODUCTS_LABEL: Record<string, string> = { handRolled: "Plans", modemBill: "Packages", clientExit: "Product Groups", blessta: "Package Groups", boxBillin: "Product categories", hostBull: "Order pages" };
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
  return renderToString(<Admin game={s} variant={variant} route={route} open={() => {}} />);
};

describe.each([...LEGACY, ...MODERN])("%s skin", (variant) => {
  it("renders its pricing screen with its own cycles", () => {
    const { s, p } = setup(variant);
    const html = admin(s, variant, { s: "product", id: p, tab: "pricing" });
    for (const c of shopById(variant).cycles) expect(html).toContain(LABEL[c]);
    for (const c of ["monthly", "quarterly", "annual", "biennial"]) if (!shopById(variant).cycles.includes(c as never)) expect(html).not.toContain(LABEL[c]);
  });

  it("renders store, configure and client area in its frame", () => {
    const { s, g, p } = setup(variant);
    const store = render(s, variant, "store", { group: g });
    expect(store).toContain("Starter");
    expect(store).toContain(shopById(variant).name.replace("'", "&#x27;"));
    expect(render(s, variant, "configure", { group: g, product: p })).toContain("Add to Cart");
    s.customers.push({ id: "c1", name: "Ada Lovelace", since: 0, churnedAt: null } as never);
    if (variant !== "handRolled") expect(render(s, variant, "client", {}, { c: "c1" }, "Client")).toContain("Ada Lovelace");
  });

  it("names the products screen in the system's own words", () => {
    const { s } = setup(variant);
    expect(admin(s, variant, { s: "products" })).toContain(`>${PRODUCTS_LABEL[variant]}</a>`);
  });
});

describe("flat variants", () => {
  it("list the products without group headings", () => {
    for (const variant of ["handRolled", "boxBillin"] as ShopId[]) {
      const { s, g } = setup(variant);
      const html = render(s, variant, "store", { group: g });
      expect(html).toContain("Starter");
      expect(html).not.toContain("<h2>Shared hosting</h2>");
    }
  });

  it("keep groups on the others", () => {
    const { s, g } = setup("modemBill");
    expect(render(s, "modemBill", "store", { group: g })).toContain("<h2>Shared hosting</h2>");
  });

  it("have no client login in the hand-rolled admin", () => {
    const { s } = setup("handRolled");
    s.customers.push({ id: "c1", name: "Ada Lovelace", since: 0, churnedAt: null } as never);
    expect(admin(s, "handRolled", { s: "client", id: "c1" })).not.toContain("Login as Client");
    expect(admin(s, "clientExit", { s: "client", id: "c1" })).toBeDefined();
  });
});
