import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { SagaSite } from "../src/ui/apps/browser/sites/books/SagaSite";

const page = (month: string, path = "/") => {
  const s = newGame(17);
  s.hour = hourOfMonth(month);
  return renderToString(<SagaSite game={s} path={path} go={() => {}} />);
};

describe("Saga site", () => {
  it("lists the editions as plain bullets until 2009 and compares them in a table from 2010", () => {
    const early = page("2009-11");
    expect(early).toContain("sg-classic");
    expect(early).toContain("<li>");
    expect(early).not.toContain("bv-table");
    expect(early).toContain("<h2>Saga Office Line Plus</h2>");
    expect(early).not.toContain("Office Line Office Line");
    const late = page("2010-02");
    expect(late).toContain("sg-modern");
    expect(late).toContain("bv-table");
  });

  it("shows one edition on its edition path", () => {
    const one = page("2006-05", "/edition/office-line-plus");
    expect(one).toContain("Office Line Plus");
    expect(one.match(/class="bv-edition"/g)).toHaveLength(1);
  });
});
