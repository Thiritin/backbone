import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { WizoSite } from "../src/ui/apps/browser/sites/books/WizoSite";

const page = (ym: string, path = "/") => {
  const s = newGame(1);
  s.hour = hourOfMonth(ym);
  return renderToString(<WizoSite game={s} path={path} go={() => {}} />).replaceAll("<!-- -->", "");
};

describe("WARUM site", () => {
  it("is a framed layout table with a plain edition list in 2006", () => {
    const html = page("2006-03");
    expect(html).toContain("wz-portal");
    expect(html).toContain("wz-layout");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("is a rounded shop with a starburst in 2011", () => {
    const html = page("2011-01");
    expect(html).toContain("wz-shop");
    expect(html).toContain("wz-burst");
    expect(html).not.toContain("wz-layout");
  });

  it("compares the editions in a table on the flat and the dark site", () => {
    const flat = page("2016-01"), modern = page("2021-01");
    expect(flat).toContain("wz-flat");
    expect(flat).toContain("bv-table");
    expect(modern).toContain("wz-modern");
    expect(modern).toContain("wz-cookies");
    expect(modern).toContain("bv-table");
  });

  it("sells and links the install guide on every look", () => {
    for (const ym of ["2006-03", "2011-01", "2016-01", "2021-01"]) {
      const html = page(ym);
      expect(html).toContain("bv-buy");
      expect(html).toContain('href="?s=guide"');
      expect(html).toContain("wz-download");
      expect(html).toContain("System requirements");
    }
  });

  it("shows only the edition its path names", () => {
    const html = page("2006-03", "/edition/l");
    expect(html).toContain("WARUM Mein Büro L");
    expect(html).not.toContain("WARUM Mein Büro S");
  });
});
