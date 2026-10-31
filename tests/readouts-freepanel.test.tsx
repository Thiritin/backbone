import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

function render(year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "freepanel"), c = s.clusters.find((x) => x.id === id)!;
  const View = CONSOLES.freepanel;
  return renderToString(<View game={s} c={c} f={consoleFeatures("freepanel", yearOf(s.hour))} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
}

describe("FreePanel module tree", () => {
  it("opens on System Information with its categories in both eras", () => {
    for (const year of [2008, 2022]) {
      const html = render(year);
      for (const text of ["Dashboard", "Virtualmin", "List Virtual Servers", "Software and updates", "System Logs", "Webmin Actions Log", "Check Licence", "CPU load average", "Real memory", "Package updates", "panel.example.com"]) {
        expect(html, `${year} ${text}`).toContain(text);
      }
    }
  });
});
