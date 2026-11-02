import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { CollmixSite } from "../src/ui/apps/browser/sites/books/CollmixSite";

const page = (ym: string, path = "/") => {
  const s = newGame(1);
  s.hour = hourOfMonth(ym);
  return renderToString(<CollmixSite game={s} path={path} go={() => {}} />);
};

describe("Collmix site", () => {
  it("lists the editions as a plain list until 2011", () => {
    const html = page("2011-12");
    expect(html).toContain("cx-plain");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("shows a price table from 2012", () => {
    const html = page("2012-01");
    expect(html).toContain("cx-table");
    expect(html).toContain("bv-table");
  });

  it("shows only the edition its path names", () => {
    const html = page("2008-05", "/edition/plus");
    expect(html.match(/class="bv-edition"/g)).toHaveLength(1);
    expect(html).toContain("<h2>Collmix plus</h2>");
  });
});
