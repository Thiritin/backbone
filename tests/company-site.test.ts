import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "../src/sim/40-support/tickets";
import { HELPDESK_CUSTOMERS, kbArticles, siteContent, sitePages } from "../src/sim/80-business/website";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { companyDomain } from "../src/sim/30-customers/domains";
import { portalPath } from "../src/sim/80-business/portal";
import { readyGame } from "./fixtures";

describe("company site pages", () => {
  it("starts as one page and grows a menu with the web design", () => {
    const s = readyGame(7);
    expect(sitePages(s)).toEqual(["home"]);
    s.marketing.owned = ["website"];
    expect(sitePages(s)).toEqual(["home", "products", "about", "support"]);
  });

  it("adds the knowledge base with the app and the help desk with enough customers", () => {
    const s = readyGame(7);
    s.marketing.owned = ["website"];
    s.installed = [...s.installed, KNOWLEDGE_BASE];
    expect(sitePages(s)).toContain("kb");
    expect(sitePages(s)).not.toContain("helpdesk");
    const c = s.customers[0];
    s.customers = Array.from({ length: HELPDESK_CUSTOMERS }, (_, i) => ({ ...c, id: `c${i}`, churnedAt: null }));
    expect(sitePages(s)).toEqual(["home", "products", "kb", "helpdesk", "about", "support"]);
  });

  it("lists the basic how-to articles with their reads", () => {
    const s = readyGame(7);
    s.kbReads = { upload: 4 };
    const a = kbArticles(s);
    expect(a.find((x) => x.topic === "upload")?.reads).toBe(4);
    expect(a.some((x) => x.topic === "php")).toBe(false);
  });
});

describe("shop order links and pricing page", () => {
  const shopGame = () => {
    const s = readyGame(7);
    s.marketing.owned = ["website"];
    s.marketing.lines = ["webHosting", "vps"];
    s.shop.variant = "whmCache";
    s.shop.readyAt = 0;
    s.shop.productGroups = [{ id: "g1", name: "Hosting", hidden: false }];
    const spec = sizeSpec("webHosting", 0, 2005);
    s.shop.products = [
      { id: "p1", groupId: "g1", name: "Small", line: "webHosting", serverGroupId: null, packageName: null, spec, prices: { monthly: 5, annual: 48 }, setup: 0, stock: "auto", hidden: false, setupMode: "payment" },
      { id: "p2", groupId: "g1", name: "Secret", line: "webHosting", serverGroupId: null, packageName: null, spec, prices: { monthly: 1 }, setup: 0, stock: "auto", hidden: true, setupMode: "payment" },
    ];
    return s;
  };

  it("takes the from price from the cheapest visible product and links its configure page", () => {
    const s = shopGame();
    const web = siteContent(s).lines.find((l) => l.product === "webHosting")!;
    expect(web.from).toBe(4);
    expect(web.link).toBe(`portal.${companyDomain(s)}${portalPath("whmCache", "configure", { group: "g1", product: "p1" })}`);
    expect(siteContent(s).lines.find((l) => l.product === "vps")!.link).toBe(`portal.${companyDomain(s)}${portalPath("whmCache", "store")}`);
  });

  it("shows the pricing page only with a shop and something to sell, and no link without a shop", () => {
    const s = shopGame();
    expect(sitePages(s)).toContain("pricing");
    s.shop.variant = null;
    expect(sitePages(s)).not.toContain("pricing");
    expect(siteContent(s).lines.every((l) => l.link === null)).toBe(true);
  });
});
