import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

const IDS = ["tcadmen", "multikraft", "pterodaktyl", "powerdnz", "mailpig", "openveepeen", "anyconnekt", "minnio", "ownclod", "backula"];

function render(id: string, year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const host = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, id, { vcpu: 4, ramGb: 8, diskGb: 600 }), c = s.clusters.find((x) => x.id === host)!;
  const View = CONSOLES[id];
  return renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="panel.example.com" signedIn login={() => {}} logout={() => {}} />);
}

describe("infrastructure and game consoles", () => {
  it("offer the task log, logs and licence pages in the early and late look", () => {
    for (const id of IDS) {
      for (const year of [2008, 2022]) {
        const html = render(id, year);
        for (const label of ["Task log", "Logs", "Licence"]) expect(html, `${id} ${year} ${label}`).toContain(label);
      }
    }
  });
});
