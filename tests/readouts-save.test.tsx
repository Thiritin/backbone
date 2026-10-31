import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

describe("task page on the web panels", () => {
  it("renders from a reloaded save in every panel", () => {
    for (const id of ["cpanic", "pleskit", "directadmen", "freepanel"]) {
      const s = readyGame(1);
      skipTo(s, 2012);
      s.cash = 1_000_000;
      const c0 = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, id), g = deserialize(serialize(s));
      const c = g.clusters.find((x) => x.id === c0)!;
      const View = CONSOLES[id];
      const html = renderToString(<View game={g} c={c} f={consoleFeatures(id, yearOf(g.hour))} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
      expect(html).toContain(id === "freepanel" ? "Webmin Actions Log" : "Task log");
      expect(html).toContain(id === "freepanel" ? "System Logs" : "Logs");
    }
  });
});
