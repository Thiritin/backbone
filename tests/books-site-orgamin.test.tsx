import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { OrgaminSite } from "../src/ui/apps/browser/sites/books/OrgaminSite";

const site = (ym: string, path = "/") => {
  const s = newGame(5);
  s.hour = hourOfMonth(ym);
  return renderToString(<OrgaminSite game={s} path={path} go={() => {}} />);
};

describe("orgaMIN site", () => {
  it("lists the edition features as a plain list before 2011", () => {
    const html = site("2010-12");
    expect(html).toContain("om-home");
    expect(html).toContain("<li>");
    expect(html).not.toContain("bv-table");
  });

  it("shows a price table from 2011 on", () => {
    const html = site("2011-01");
    expect(html).toContain("om-relaunch");
    expect(html).toContain("bv-table");
    expect(html).not.toContain("<li>");
  });

  it("shows only the edition the path names", () => {
    const html = site("2007-03", "/edition/professional");
    expect(html).toContain("Professional");
    expect(html).not.toContain("Enterprise");
  });
});
