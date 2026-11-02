import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { SevdeckSite } from "../src/ui/apps/browser/sites/books/SevdeckSite";

const page = (month: string, path = "/") => {
  const s = newGame(13);
  s.hour = hourOfMonth(month);
  return renderToString(<SevdeckSite game={s} path={path} go={() => {}} />);
};

describe("sevDeck site", () => {
  it("shows a pricing table from 2013 and rebrands in 2020", () => {
    const early = page("2013-06");
    expect(early).toContain("bv-table");
    expect(early).toContain("sd-flat");
    expect(early).not.toContain("sd-brand");
    const late = page("2021-03");
    expect(late).toContain("bv-table");
    expect(late).toContain("sd-brand");
  });

  it("shows one edition on its edition path", () => {
    const one = page("2015-01", "/edition/buchhaltung");
    expect(one).toContain("Buchhaltung");
    expect(one).not.toContain("Warenwirtschaft");
  });
});
