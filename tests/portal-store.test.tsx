import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { createProduct, createProductGroup, setProductPrice, updateProduct } from "../src/sim/90-actions/portal";
import { chooseShop } from "../src/sim/90-actions/shop";
import { setLine } from "../src/sim/90-actions/website";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { readyGame } from "./fixtures";

export const shopGame = (variant = "whmCache"): GameState => {
  const s = readyGame(4);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "handRolled");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, variant as never).ok || variant === "handRolled").toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  setLine(s, "webHosting", true);
  return s;
};
export const idOf = (r: { ok: boolean; id?: string }) => { expect(r.ok).toBe(true); return r.id!; };
export const render = (s: GameState, variant: string, area: "store" | "configure" | "cart" | "client", ids: { group?: string; product?: string } = {}, screen?: string | Record<string, string>, part: "Store" | "Client" = "Store") => {
  const route = parsePortal(variant as never, portalPath(variant as never, area, ids, screen)) ?? { area, query: new URLSearchParams() };
  const Skin = skinOf(variant as never)[part];
  return renderToString(<Skin game={s} variant={variant as never} route={route} open={() => {}} />);
};

const withProduct = (s: GameState) => {
  const g = idOf(createProductGroup(s, "Shared hosting"));
  const p = idOf(createProduct(s, g, "Starter", "webHosting"));
  setProductPrice(s, p, "monthly", 5);
  setProductPrice(s, p, "annual", 54);
  return { g, p };
};

describe("WHMCache store front", () => {
  it("lists groups and products with the price from", () => {
    const s = shopGame();
    withProduct(s);
    const html = render(s, "whmCache", "store");
    expect(html).toContain("Shared hosting");
    expect(html).toContain("Starter");
    expect(html).toContain("from");
  });

  it("greys a product that is sold out", () => {
    const s = shopGame();
    const { p } = withProduct(s);
    expect(updateProduct(s, p, { stock: 0 }).ok).toBe(true);
    const html = render(s, "whmCache", "store");
    expect(html).toContain("Sold out");
    expect(html).toContain("gone");
  });

  it("offers the cycles with their price and savings on the configure page", () => {
    const s = shopGame();
    const { g, p } = withProduct(s);
    const html = render(s, "whmCache", "configure", { group: g, product: p });
    expect(html).toContain("Monthly");
    expect(html).toContain("Annually");
    expect(html).toContain("Save 10 %");
    expect(html).toContain("Domain");
  });

  it("totals the cart and keeps the order button disabled", () => {
    const s = shopGame();
    const { g, p } = withProduct(s);
    const html = render(s, "whmCache", "cart", { group: g, product: p }, { p, cycle: "annual" });
    expect(html).toContain("Total");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Complete Order/);
  });

  it("shows the stepper from 2013 only", () => {
    const s = shopGame();
    withProduct(s);
    expect(render(s, "whmCache", "store")).not.toContain("shop-steps");
    s.hour += 9 * 365 * 24;
    expect(render(s, "whmCache", "store")).toContain("shop-steps");
  });
});

describe("client area", () => {
  it("lists a customer's services and invoices under the admin banner", () => {
    const s = shopGame();
    s.customers.push({ id: "c1", name: "Ada Lovelace", since: 0, churnedAt: null } as never);
    s.services.push({ id: "v1", customerId: "c1", product: "webHosting", label: "Blog", price: 4, endedAt: null, cycle: "annual", termEnd: s.hour + 24 * 100, domain: "ada.example" } as never);
    s.invoices.push({ id: "i1", number: "RE-1", customerId: "c1", status: "open", issuedAt: 0, lines: [], reminders: [] } as never);
    s.tickets.push({ id: "t1", customerId: "c1", status: "open", topic: "Mail is slow", replies: [] } as never);
    const html = render(s, "whmCache", "client", {}, { c: "c1" }, "Client");
    expect(html).toContain("Logged in as an administrator");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Blog");
    expect(html).toContain("ada.example");
    expect(html).toContain("Annually");
    expect(html).toContain("RE-1");
    expect(html).toContain("Pay");
  });
});
