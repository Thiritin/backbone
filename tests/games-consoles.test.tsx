import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { GameDetails, GameNodes } from "../src/ui/apps/browser/consoles/GamePanel";
import { panelVm, readyGame, skipTo } from "./fixtures";

function setup(panel: string, year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, panel), c = s.clusters.find((x) => x.id === id)!;
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const r = provisionService(s, cus, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, yearOf(s.hour)), clusterId: id, title: "blockcraft" });
  if (!r.ok) throw new Error(r.error);
  return { s, c, serviceId: r.id! };
}

const view = (panel: string, year: number) => {
  const { s, c, serviceId } = setup(panel, year), View = CONSOLES[panel];
  const html = renderToString(<View game={s} c={c} f={consoleFeatures(panel, yearOf(s.hour))} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
  return { s, c, serviceId, html };
};

describe("game panel screens", () => {
  it.each([["tcadmen", 2010], ["tcadmen", 2018], ["multikraft", 2014], ["pterodaktyl", 2020]] as const)("%s %i lists the title, the players and a manage action without raw keys", (panel, year) => {
    const { html } = view(panel, year);
    expect(html).toContain("Blockcraft");
    expect(html).toContain("Manage");
    expect(html).not.toMatch(/games\.[a-z]+/);
  });

  it("names the tabs of each panel in its own words", () => {
    const tc = view("tcadmen", 2010), mk = view("multikraft", 2014), pt = view("pterodaktyl", 2020);
    const tabs = (v: typeof tc, panel: string) => renderToString(<GameDetails game={v.s} serviceId={v.serviceId} panel={panel} />);
    expect(tabs(tc, "tcadmen")).toContain("Game Settings");
    expect(tabs(mk, "multikraft")).toContain("Plugins");
    expect(tabs(pt, "pterodaktyl")).toContain("Crash detection");
    expect(tabs(pt, "pterodaktyl")).toContain("Allocations");
  });

  it("shows the Wings daemon and port pool per node on Pterodaktyl", () => {
    const { s, c } = view("pterodaktyl", 2020);
    const html = renderToString(<GameNodes game={s} c={c} />);
    expect(html).toContain("Online");
    expect(html).toContain("/100");
  });

  it("gives a service without a title no manage action", () => {
    const { s, c, serviceId } = setup("tcadmen", 2010);
    s.gameServers = [];
    const View = CONSOLES.tcadmen;
    const html = renderToString(<View game={s} c={c} f={consoleFeatures("tcadmen", 2010)} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
    expect(serviceId).toBeTruthy();
    expect(html).not.toContain("Manage");
    expect(html).toContain("Unknown");
  });
});
