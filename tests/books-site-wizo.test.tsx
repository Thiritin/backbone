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
    expect(html).toContain("wrm-portal");
    expect(html).toContain("wrm-layout");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
    expect(html).toContain("wrm-worlds");
    expect(html).not.toContain("wrm-right");
  });

  it("draws an icon for every feature from 2010 on", () => {
    for (const ym of ["2011-01", "2016-01", "2021-01"]) expect(page(ym).match(/<svg class="wrm-ico"/g)).toHaveLength(3);
  });


  it("is a rounded shop with a starburst in 2011", () => {
    const html = page("2011-01");
    expect(html).toContain("wrm-shop");
    expect(html).toContain("wrm-burst");
    expect(html).not.toContain("wrm-layout");
  });

  it("compares the editions in a table on the flat and the dark site", () => {
    const flat = page("2016-01"), modern = page("2021-01");
    expect(flat).toContain("wrm-flat");
    expect(flat).toContain("bv-table");
    expect(modern).toContain("wrm-modern");
    expect(modern).toContain("wrm-cookies");
    expect(modern).toContain("bv-table");
  });

  it("sells and links the install guide on every look", () => {
    for (const ym of ["2006-03", "2011-01", "2016-01", "2021-01"]) {
      const html = page(ym);
      expect(html).toContain("bv-buy");
      expect(html).toContain('href="?s=guide"');
      expect(html).toContain("wrm-download");
      expect(html).toContain("System requirements");
    }
  });

  it("shows only the edition its path names", () => {
    const html = page("2006-03", "/edition/l");
    expect(html).toContain("WARUM Mein Büro L");
    expect(html).not.toContain("WARUM Mein Büro S");
  });
});
