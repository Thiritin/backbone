import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { LexwearSite } from "../src/ui/apps/browser/sites/lexwear/LexwearSite";

const site = (ym: string, path = "/") => {
  const s = newGame(5);
  s.hour = hourOfMonth(ym);
  return renderToString(<LexwearSite game={s} path={path} go={() => {}} />);
};

describe("Taxware site", () => {
  it("lays the 2005 portal out as a table with a plain edition list", () => {
    const html = site("2007-03");
    expect(html).toContain("tw-classic");
    expect(html).toContain("<table class=\"tw-frame\"");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
    expect(html).toContain("tw-strip");
    expect(html).not.toContain("tw-right");
  });


  it("gives 2009 a product dropdown and a comparison table", () => {
    const html = site("2012-06");
    expect(html).toContain("tw-modern");
    expect(html).toContain("tw-pick");
    expect(html).not.toContain("tw-frame");
    expect(html).toContain("bv-table");
  });

  it("gives 2015 a mega menu", () => {
    const html = site("2016-06");
    expect(html).toContain("tw-flat");
    expect(html).toContain("tw-mega");
    expect(html).not.toContain("tw-pick");
  });

  it.each(["2007-03", "2012-06", "2016-06"])("offers the download button, requirements and install guide in %s", (ym) => {
    const html = site(ym);
    expect(html).toContain("bv-buy");
    expect(html).toContain("System requirements");
    expect(html).toContain("Installation guide");
    expect(html).toContain("href=\"?s=guide\"");
  });

  it("keeps the edition page and the support page", () => {
    expect(site("2012-06", "/edition/buchhalter")).not.toContain("financial office pro");
    expect(site("2007-03", "/support")).not.toContain("bv-edition");
  });
});
