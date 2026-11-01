import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { createProduct, createProductGroup, setProductPrice, updateProduct } from "../src/sim/90-actions/portal";
import { idOf, render, shopGame } from "./portal-helpers";

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

  it("totals the cart and offers the order button as a test checkout", () => {
    const s = shopGame();
    const { g, p } = withProduct(s);
    const html = render(s, "whmCache", "cart", { group: g, product: p }, { p, cycle: "annual" });
    expect(html).toContain("Total");
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Complete Order/);
  });

  it("shows the stepper from major 5 on", () => {
    const s = shopGame();
    withProduct(s);
    expect(render(s, "whmCache", "store", {}, undefined, "Store", "4.0")).not.toContain("shop-steps");
    expect(render(s, "whmCache", "store", {}, undefined, "Store", "5.0")).toContain("shop-steps");
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
