import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { SevdeckSite } from "../src/ui/apps/browser/sites/books/SevdeckSite";
import { BOOKS_GUIDE_ROUTE } from "../src/ui/apps/browser/sites/books/guide-route";

const page = (month: string, path = "/") => {
  const s = newGame(13);
  s.hour = hourOfMonth(month);
  return renderToString(<SevdeckSite game={s} path={path} go={() => {}} />);
};

describe("EightDesk site", () => {
  it("wears a different structure in each era", () => {
    const flat = page("2013-06"), dash = page("2019-03"), v2 = page("2024-06");
    expect(flat).toContain("sd-flat");
    expect(flat).toContain("sd-sheet");
    expect(flat).not.toContain("sd-window");
    expect(dash).toContain("sd-dash");
    expect(dash).toContain("sd-window");
    expect(dash).not.toContain("sd-bento");
    expect(v2).toContain("sd-v2");
    expect(v2).toContain("sd-bento");
    expect(v2).not.toContain("sd-sheet");
  });

  it("shows the pricing table with buy buttons in every era", () => {
    for (const m of ["2013-06", "2019-03", "2024-06"]) {
      const html = page(m);
      expect(html).toContain("bv-table");
      expect(html).toContain("bv-buy");
    }
  });

  it("links the install guide and lists system requirements in every era", () => {
    for (const m of ["2013-06", "2019-03", "2024-06"]) {
      const html = page(m);
      expect(html).toContain(`href="${BOOKS_GUIDE_ROUTE}"`);
      expect(html).toContain("Installation guide");
      expect(html).toContain("System requirements");
    }
  });

  it("shows one edition on its edition path", () => {
    const one = page("2015-01", "/edition/buchhaltung");
    expect(one).toContain("Buchhaltung");
    expect(one).not.toContain("Warenwirtschaft");
  });
});
