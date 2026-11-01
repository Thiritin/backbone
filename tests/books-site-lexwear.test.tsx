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

describe("Lexwear site", () => {
  it("lists the edition features as a plain list before 2010", () => {
    const html = site("2007-03");
    expect(html).toContain("lx-classic");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("shows a comparison table from 2010 on", () => {
    const html = site("2012-06");
    expect(html).toContain("lx-modern");
    expect(html).toContain("bv-table");
  });

  it("keeps the edition page and the support page", () => {
    expect(site("2012-06", "/edition/buchhalter")).not.toContain("financial office pro");
    expect(site("2007-03", "/support")).not.toContain("bv-edition");
  });
});
