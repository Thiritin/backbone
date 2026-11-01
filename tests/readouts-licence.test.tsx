import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { euroCents } from "../src/sim/00-core/money";
import { licenseCost } from "../src/sim/85-products/products";
import { LicencePage } from "../src/ui/apps/browser/consoles/Readouts";
import { panelVm, readyGame, skipTo } from "./fixtures";

function page(panel: string) {
  const s = readyGame(1);
  skipTo(s, 2008);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, panel), c = s.clusters.find((x) => x.id === id)!;
  return { s, c, html: renderToString(<LicencePage game={s} c={c} />) };
}

describe("licence page", () => {
  it("shows the cost licenseCost returns for a server licence", () => {
    const { s, c, html } = page("pleskit");
    expect(html).toContain("Per server");
    expect(html).toContain(euroCents(licenseCost(s, c).panel).replace(/ /g, " "));
  });

  it("shows the per-account kind", () => {
    expect(page("cpanic").html).toContain("Per account");
  });

  it("shows no cost for a free panel", () => {
    const { html } = page("freepanel");
    expect(html).toContain("Free software");
    expect(html).not.toContain("€");
  });

  it("marks a panel past its end of security updates", () => {
    const { s, c } = page("cpanic");
    expect(renderToString(<LicencePage game={s} c={c} />)).not.toContain("Security updates ended");
    s.hour += 10 * 365 * 24;
    expect(renderToString(<LicencePage game={s} c={c} />)).toContain("Security updates ended");
  });
});
