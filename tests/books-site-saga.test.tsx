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

describe("Thyme site", () => {
  it("lists the editions as plain bullets until 2009 and compares them in a table from 2010", () => {
    const early = page("2009-11");
    expect(early).toContain("sg-classic");
    expect(early).toContain("<li>");
    expect(early).not.toContain("bv-table");
    expect(early).toContain("<h2>Thyme 50 Quantum</h2>");
    expect(early).not.toContain("Quantum Quantum");
    const late = page("2010-02");
    expect(late).toContain("sg-modern");
    expect(late).toContain("bv-table");
  });

  it("shows one edition on its edition path", () => {
    const one = page("2006-05", "/edition/office-line-plus");
    expect(one).toContain("Thyme 50 Quantum");
    expect(one.match(/class="bv-edition"/g)).toHaveLength(1);
  });

  it("gives each era its own structure", () => {
    const classic = page("2007-01");
    expect(classic).toContain("sg-cards");
    expect(classic).toContain("sg-links");
    expect(classic).not.toContain("sg-side");
    const modern = page("2012-01");
    expect(modern).toContain("sg-tiles");
    expect(modern).toContain("sg-side");
    const flat = page("2018-01");
    expect(flat).toContain("sg-hero");
    expect(flat).not.toContain("sg-tiles");
  });

  it.each(["2007-01", "2012-01", "2018-01"])("offers the download button, requirements and install guide in %s", (ym) => {
    const html = page(ym);
    expect(html).toContain("bv-buy");
    expect(html).toContain("Windoors");
    expect(html).toContain("System requirements");
    expect(html).toContain("Installation guide");
    expect(html).toContain("href=\"?s=guide\"");
  });
});
