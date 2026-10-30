import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "../src/sim/40-support/tickets";
import { HELPDESK_CUSTOMERS, kbArticles, sitePages } from "../src/sim/80-business/website";
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
