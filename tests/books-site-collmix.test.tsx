import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { CollmixSite } from "../src/ui/apps/browser/sites/books/CollmixSite";
import { BOOKS_GUIDE_ROUTE } from "../src/ui/apps/browser/sites/books/guide-route";

const page = (ym: string, path = "/") => {
  const s = newGame(1);
  s.hour = hourOfMonth(ym);
  return renderToString(<CollmixSite game={s} path={path} go={() => {}} />);
};

describe("Kontomix site", () => {
  it("lays out a 2005 page in tables with the editions as a list", () => {
    const html = page("2008-05");
    expect(html).toContain("cx-plain");
    expect(html).toContain("cx-frame");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
    expect(html).toContain("bv-buy");
  });

  it("shows tabs and a price table around 2010", () => {
    const html = page("2011-06");
    expect(html).toContain("cx-tabs");
    expect(html).toContain("cx-bar");
    expect(html).toContain("bv-table");
    expect(html).not.toContain("cx-frame");
  });

  it("adds the product sidebar from 2015", () => {
    const html = page("2016-03");
    expect(html).toContain("cx-side");
    expect(html).toContain("cx-aside");
    expect(html).toContain("bv-table");
    expect(html).not.toContain("cx-bar");
  });

  it("links the install guide and lists the system requirements in every look", () => {
    for (const ym of ["2006-01", "2012-01", "2019-01"]) {
      const html = page(ym);
      expect(html).toContain(`href="${BOOKS_GUIDE_ROUTE}"`);
      expect(html).toContain("Installation guide");
      expect(html).toContain('id="download"');
    }
  });

  it("shows only the edition its path names", () => {
    const html = page("2008-05", "/edition/plus");
    expect(html.match(/class="bv-edition"/g)).toHaveLength(1);
    expect(html).toContain("<h2>Kontomix plus</h2>");
  });
});
