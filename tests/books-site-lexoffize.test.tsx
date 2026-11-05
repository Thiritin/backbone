import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { LexoffizeSite } from "../src/ui/apps/browser/sites/books/LexoffizeSite";

const site = (ym: string, path = "/") => {
  const s = newGame(5);
  s.hour = hourOfMonth(ym);
  return renderToString(<LexoffizeSite game={s} path={path} go={() => {}} />);
};

describe("Rexoffice site", () => {
  it("shows the pricing table, download and guide link on the 2014 launch site", () => {
    const html = site("2014-05");
    expect(html).toContain("lo-launch");
    expect(html).toContain("lo-feats");
    expect(html).toContain("bv-table");
    expect(html).toContain("bv-buy");
    expect(html).toContain("lo-dl");
    expect(html).toContain('href="?s=guide"');
    expect(html).not.toContain("bv-edition");
  });

  it("builds a different page for the 2017 dashboard pitch and the 2023 corporate site", () => {
    const dash = site("2018-02"), corp = site("2024-02");
    expect(dash).toContain("lo-dash");
    expect(dash).toContain("lo-board");
    expect(dash).not.toContain("lo-feats");
    expect(corp).toContain("lo-corp");
    expect(corp).toContain("lo-faq");
    expect(corp).not.toContain("lo-board");
    for (const html of [dash, corp]) {
      expect(html).toContain("bv-table");
      expect(html).toContain("bv-buy");
      expect(html).toContain('href="?s=guide"');
    }
  });

  it("shows only the edition the path names", () => {
    const html = site("2016-01", "/edition/m");
    expect(html).toContain(">M</th>");
    expect(html).not.toContain(">S</th>");
  });
});
