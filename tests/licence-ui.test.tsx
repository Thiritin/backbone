import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { panelMachine } from "../src/sim/60-infra/licence";
import { activateLicence } from "../src/sim/90-actions/licence";
import { LicencePage } from "../src/ui/apps/browser/consoles/Readouts";
import { buyKey, panelVm, readyGame, skipTo } from "./fixtures";

function setup(panel: string) {
  const s = readyGame(1);
  skipTo(s, 2020);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, panel);
  const host = () => s.clusters.find((x) => x.id === id)!;
  const view = () => renderToString(<LicencePage game={s} c={host()} />);
  // Puts the panel on a trial until the hour, without its key.
  const trial = (until: number) => {
    const vm = panelMachine(host())!;
    s.licenses = s.licenses.filter((k) => k.machineId !== vm);
    s.trials = [{ machineId: vm, product: panel, until }];
  };
  return { s, id, view, trial };
}

describe("licence page tiers", () => {
  it("shows the edition on trial without a way to switch it", () => {
    const { s, view, trial } = setup("cpanic");
    trial(s.hour + 720);
    const html = view();
    expect(html).toContain("Premier");
    for (const name of ["Solo", "Admin", "Pro"]) expect(html).not.toContain(name);
    expect(html).not.toContain("aria-pressed");
    expect(html).toContain("Trial ends");
    expect(html).toContain("unlimited");
    expect(html).not.toContain("Your license has expired.");
  });

  it("shows accounts against the cap after a downgrade", () => {
    const { s, id, view } = setup("pleskit");
    expect(activateLicence(s, panelMachine(s.clusters.find((x) => x.id === id)!)!, "pleskit", buyKey(s, "pleskit", "webAdmin").key).ok).toBe(true);
    const html = view();
    expect(html).toContain("0 of 10");
    expect(html).toContain("Never");
  });

  it("shows the red notice once the trial is over", () => {
    const { s, view, trial } = setup("directadmen");
    trial(s.hour - 1);
    expect(view()).toContain("Your license has expired.");
  });

  it("shows no editions for a free panel", () => {
    expect(setup("freepanel").view()).not.toContain("Edition");
  });
});
