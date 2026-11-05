import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { GnuCacheSite } from "../src/ui/apps/browser/sites/books/GnuCacheSite";

const page = (month: string, path = "/") => {
  const s = newGame(13);
  s.hour = hourOfMonth(month);
  return renderToString(<GnuCacheSite game={s} path={path} go={() => {}} />);
};

describe("GnuCache site", () => {
  it("keeps its one free edition as a plain list in all three eras", () => {
    const early = page("2006-04"), mid = page("2014-04"), late = page("2021-03");
    expect(early).toContain("gc-forge");
    expect(early).toContain("gc-frame");
    expect(early).toContain("GnuCache 2.0");
    expect(mid).toContain("gc-wiki");
    expect(mid).toContain("gc-gallery");
    expect(late).toContain("gc-modern");
    expect(late).toContain("gc-cards");
    expect(late).toContain("GnuCache 4.0");
    for (const html of [early, mid, late]) {
      expect(html).toContain("<li>");
      expect(html).not.toContain("bv-table");
      expect(html).toContain("bv-buy");
      expect(html).toContain("gc-req");
      expect(html).toContain('href="?s=guide"');
    }
    expect(early).not.toContain("gc-gallery");
    expect(mid).not.toContain("gc-cards");
  });

  it("shows the edition on its edition path with the nav link back", () => {
    const one = page("2008-01", "/edition/free");
    expect(one).toContain("bv-edition");
    expect(one).not.toContain('aria-current="page"');
    expect(page("2008-01")).toContain('aria-current="page"');
  });
});
