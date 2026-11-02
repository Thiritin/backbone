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

describe("WIZO site", () => {
  it("lists the editions as a plain bulleted list until 2010", () => {
    const html = page("2010-06");
    expect(html).toContain("wz-classic");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("compares the editions in a pricing table from 2011", () => {
    const html = page("2011-01");
    expect(html).toContain("wz-modern");
    expect(html).toContain("bv-table");
  });

  it("shows only the edition its path names", () => {
    const html = page("2006-03", "/edition/l");
    expect(html).toContain("WIZO Mein Büro L");
    expect(html).not.toContain("WIZO Mein Büro S");
  });
});
