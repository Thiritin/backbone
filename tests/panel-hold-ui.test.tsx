import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { suspendService } from "../src/sim/90-actions/holds";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

function render(id: string, hold: boolean) {
  const s = readyGame(1);
  skipTo(s, 2012);
  s.cash = 1_000_000;
  const host = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, id), c = s.clusters.find((x) => x.id === host)!;
  s.clusters = s.clusters.filter((x) => x.kind !== "panel" || x.id === host);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const r = provisionService(s, cus, id === "tcadmen" ? "gameServer" : "webHosting", { label: "a.com" });
  if (!r.ok) throw new Error(r.error);
  if (hold) suspendService(s, r.id!, "manual");
  const View = CONSOLES[id];
  return renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
}

describe("hold buttons on account rows", () => {
  it("shows Suspend and Terminate on a cPanic row", () => {
    const html = render("cpanic", false);
    expect(html).toContain("Suspend");
    expect(html).toContain("Terminate");
    expect(html).not.toContain("Unsuspend");
  });

  it("shows the held state and Unsuspend on a held cPanic row", () => {
    const html = render("cpanic", true);
    expect(html).toContain("Suspended (Other)");
    expect(html).toContain("Unsuspend");
  });

  it("uses the game panel's own words on a TCAdmen row", () => {
    expect(render("tcadmen", false)).toContain("Delete server");
  });
});
