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
  it("keeps its one free edition as a plain list and moves from the forge page to the redesign in 2013", () => {
    const early = page("2006-04");
    expect(early).toContain("gc-forge");
    expect(early).toContain("<li>");
    expect(early).not.toContain("bv-table");
    expect(early).toContain("GnuCache 2.0");
    const late = page("2021-03");
    expect(late).toContain("gc-modern");
    expect(late).toContain("<li>");
    expect(late).not.toContain("bv-table");
    expect(late).toContain("GnuCache 4.0");
  });

  it("shows the edition on its edition path with the nav link back", () => {
    const one = page("2008-01", "/edition/free");
    expect(one).toContain("bv-edition");
    expect(one).not.toContain('aria-current="page"');
    expect(page("2008-01")).toContain('aria-current="page"');
  });
});
