import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { OrgaminSite } from "../src/ui/apps/browser/sites/books/OrgaminSite";

const site = (ym: string, path = "/") => {
  const s = newGame(1);
  s.hour = hourOfMonth(ym);
  return renderToString(<OrgaminSite game={s} path={path} go={() => {}} />).replaceAll("<!-- -->", "");
};

describe("orgaMIN site", () => {
  it("is a left-menu home page with a visitor counter and a plain list before 2010", () => {
    const html = site("2007-03");
    expect(html).toContain("om-home");
    expect(html).toContain("om-menu");
    expect(html).toContain("Visitors: 004712");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("is a tabbed portal with three boxes in 2011", () => {
    const html = site("2011-01");
    expect(html).toContain("om-portal");
    expect(html).toContain("om-tabs");
    expect(html).toContain("om-boxes");
    expect(html).not.toContain("om-menu");
  });

  it("shows a rating bar and a price table from 2016 and a chooser from 2021", () => {
    const flat = site("2016-06"), modern = site("2021-01");
    expect(flat).toContain("om-flat");
    expect(flat).toContain("om-stars");
    expect(flat).toContain("bv-table");
    expect(modern).toContain("om-modern");
    expect(modern).toContain("om-cards");
    expect(modern).toContain("bv-table");
  });

  it("sells and links the install guide on every look", () => {
    for (const ym of ["2007-03", "2011-01", "2016-06", "2021-01"]) {
      const html = site(ym);
      expect(html).toContain("bv-buy");
      expect(html).toContain('href="?s=guide"');
      expect(html).toContain("om-download");
      expect(html).toContain("System requirements");
    }
  });

  it("shows only the edition the path names", () => {
    const html = site("2007-03", "/edition/professional");
    expect(html).toContain("Professional");
    expect(html).not.toContain("Enterprise");
  });
});
