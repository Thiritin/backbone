import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { createProduct, createProductGroup, setOptionDiscount, setProductPrice, updateProduct } from "../src/sim/90-actions/portal";
import { chooseShop, createGroup } from "../src/sim/90-actions/shop";
import { setLine } from "../src/sim/90-actions/website";
import { Shop } from "../src/ui/apps/marketing/Shop";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { readyGame } from "./fixtures";

const shopGame = (): GameState => {
  const s = readyGame(4);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "hostBull");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, "whmCache").ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  setLine(s, "webHosting", true);
  return s;
};
const idOf = (r: { ok: boolean; id?: string }) => { expect(r.ok).toBe(true); return r.id!; };
const page = (s: GameState, screen: Record<string, string>) => {
  const route = parsePortal("whmCache", portalPath("whmCache", "admin", {}, screen))!;
  const { Admin } = skinOf("whmCache");
  return renderToString(<Admin game={s} variant="whmCache" route={route} open={() => {}} />);
};

describe("WHMCache admin", () => {
  it("reads groups and products from the shop", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Shared hosting"));
    const p = idOf(createProduct(s, g, "Starter", "webHosting"));
    const html = page(s, { s: "products" });
    expect(html).toContain("Shared hosting");
    expect(html).toContain("Starter");
    expect(html).toContain("Create a New Group");
    expect(html).toContain("Create a New Product");
    expect(page(s, { s: "product", id: p, tab: "details" })).toContain("Starter");
  });

  it("shows only the supported cycles in the pricing tab and writes through the actions", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    const p = idOf(createProduct(s, g, "Starter", "webHosting"));
    const html = page(s, { s: "product", id: p, tab: "pricing" });
    for (const label of ["Monthly", "Quarterly", "Annually", "Biennially"]) expect(html).toContain(label);
    expect(setProductPrice(s, p, "annual", 77).ok).toBe(true);
    expect(page(s, { s: "product", id: p, tab: "pricing" })).toContain('value="77"');
    expect(updateProduct(s, p, { setupMode: "accept" }).ok).toBe(true);
    expect(page(s, { s: "product", id: p, tab: "module" })).toMatch(/checked[^>]*>[^<]*<\/label>|checked=""/);
  });

  it("moves the rates and the cycle discounts into the options", () => {
    const s = shopGame();
    expect(setOptionDiscount(s, "annual", 0.12).ok).toBe(true);
    const html = page(s, { s: "options" });
    expect(html).toContain("Billing cycles");
    expect(html).toContain('value="12"');
    expect(html).toContain("vCPU");
  });

  it("holds the server group editor and lists orders, clients and invoices", () => {
    const s = shopGame();
    createGroup(s, "panel", "Web servers");
    expect(page(s, { s: "servers" })).toContain("Web servers");
    expect(page(s, { s: "orders" })).toContain("Date");
    expect(page(s, { s: "clients" })).toContain("Client");
    expect(page(s, { s: "invoices" })).toContain("Invoice");
  });

  it("keeps Marketing to the choice of shop system and its modules", () => {
    const s = shopGame();
    const html = renderToString(<Shop game={s} />);
    expect(html).toContain("Open admin");
    expect(html).not.toContain("Server groups");
  });
});
