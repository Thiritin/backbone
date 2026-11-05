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
  it("lists the one free edition as a download table in 2005 and as a panel or section later", () => {
    const early = page("2006-04"), mid = page("2014-04", "/download"), late = page("2021-03");
    expect(early).toContain("gn-forge");
    expect(early).toContain("gn-frame");
    expect(early).toContain("GnuCache 2.0");
    expect(early).toContain("bv-table");
    expect(early).toContain("gn-files");
    expect(mid).toContain("gn-wiki");
    expect(mid).toContain("gn-panel");
    expect(late).toContain("gn-modern");
    expect(late).toContain("gn-cards");
    expect(late).toContain("GnuCache 4.0");
    for (const html of [early, mid, late]) {
      expect(html).toContain("bv-buy");
      expect(html).toContain("gn-req");
      expect(html).toContain('href="?s=guide"');
    }
    expect(early).not.toContain("gn-gallery");
    expect(mid).not.toContain("gn-cards");
  });

  it("gives the 2011 wiki a start page with news, features and screenshots and the download on its own page", () => {
    const home = page("2014-04"), dl = page("2014-04", "/download");
    expect(home).toContain("gn-gallery");
    expect(home).toContain("gn-fetch");
    expect(home).not.toContain("bv-buy");
    expect(home).not.toContain("gn-panel");
    expect(dl).toContain("bv-buy");
    expect(dl).toContain("gn-panel");
    expect(dl).not.toContain("gn-gallery");
    expect(page("2014-04", "/edition/free")).toContain("bv-buy");
  });

  it("shows the edition on its edition path with the nav link back", () => {
    const one = page("2008-01", "/edition/free");
    expect(one).toContain("bv-table");
    expect(one).toContain("bv-buy");
    expect(one).not.toContain('aria-current="page"');
    expect(page("2008-01")).toContain('aria-current="page"');
  });
});
