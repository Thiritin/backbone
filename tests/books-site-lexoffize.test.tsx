import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { LexoffizeSite } from "../src/ui/apps/browser/sites/books/LexoffizeSite";

const site = (ym: string, path = "/") => {
  const s = newGame(5);
  s.hour = hourOfMonth(ym);
  return renderToString(<LexoffizeSite game={s} path={path} go={() => {}} />);
};

describe("lexoffize site", () => {
  it("shows the pricing table on the 2014 launch site", () => {
    const html = site("2014-05");
    expect(html).toContain("lo-launch");
    expect(html).toContain("bv-table");
    expect(html).not.toContain("bv-edition");
  });

  it("switches to the refreshed look from 2020 on", () => {
    const html = site("2021-02");
    expect(html).toContain("lo-refresh");
    expect(html).toContain("bv-table");
  });

  it("shows only the edition the path names", () => {
    const html = site("2016-01", "/edition/m");
    expect(html).toContain(">M</th>");
    expect(html).not.toContain(">S</th>");
  });
});
