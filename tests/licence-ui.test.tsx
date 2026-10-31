import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setLicenceTier } from "../src/sim/90-actions/licence";
import { LicencePage } from "../src/ui/apps/browser/consoles/Readouts";
import { panelVm, readyGame, skipTo } from "./fixtures";

function setup(panel: string) {
  const s = readyGame(1);
  skipTo(s, 2008);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, panel);
  const view = () => renderToString(<LicencePage game={s} c={s.clusters.find((x) => x.id === id)!} />);
  return { s, id, view };
}

describe("licence page tiers", () => {
  it("lists the editions of cPanic with their fees and the trial", () => {
    const { s, id, view } = setup("cpanic");
    s.clusters = s.clusters.map((x) => (x.id === id ? { ...x, licence: { tier: "premier", trialUntil: s.hour + 720, lapsedAt: null } } : x));
    const html = view();
    for (const name of ["Solo", "Admin", "Pro", "Premier"]) expect(html).toContain(name);
    expect(html).toContain("per account");
    expect(html).toContain("Trial ends");
    expect(html).toContain("unlimited");
    expect(html).not.toContain("Your license has expired.");
  });

  it("shows accounts against the cap after a downgrade", () => {
    const { s, id, view } = setup("pleskit");
    expect(setLicenceTier(s, id, "webAdmin").ok).toBe(true);
    const html = view();
    expect(html).toContain("0 of 10");
    expect(html).toContain("Never");
  });

  it("shows the red notice once the trial is over", () => {
    const { s, id, view } = setup("directadmen");
    const c = s.clusters.find((x) => x.id === id)!;
    s.clusters = s.clusters.map((x) => (x === c ? { ...x, licence: { ...x.licence!, trialUntil: s.hour - 1 } } : x));
    expect(view()).toContain("Your license has expired.");
  });

  it("shows no editions for a free panel", () => {
    expect(setup("freepanel").view()).not.toContain("Edition");
  });
});
