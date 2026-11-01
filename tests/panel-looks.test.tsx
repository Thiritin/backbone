import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { UI_LOOKS } from "../src/sim/10-catalog/software-versions";
import { lookOf, panelMachine } from "../src/sim/60-infra/licence";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { Facts, useSoftware } from "../src/ui/apps/browser/consoles/PanelBase";
import type { GameState } from "../src/sim/50-state";
import type { Cluster } from "../src/sim/60-infra/cluster";
import { panelVm, pinVersion, readyGame, skipTo } from "./fixtures";

// docs/design/software.md, section 10: every generation's look and a mark of the console's first page.
const LOOKS: Record<string, [look: string[], mark: string]> = {
  pleskit: [["reload", "parallax", "twelve", "onyx", "obsidian"], "Websites &amp; Domains"],
  directadmen: [["classic", "enhanced", "evolution"], "Server Manager"],
  freepanel: [["gray", "authentic"], "Software and updates"],
};
const LATE = 2025;

function host(id: string, version: string) {
  const s = readyGame(1);
  skipTo(s, LATE);
  s.cash = 1_000_000;
  const vm = panelVm(s, s.clusters.find((k) => k.kind === "cloud")!.id, id), c = s.clusters.find((x) => x.id === vm)!;
  pinVersion(s, c, id, version);
  return { s, c };
}
const render = (id: string, s: GameState, c: Cluster, signedIn: boolean) => {
  const View = CONSOLES[id];
  return renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="panel.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />);
};
const SoftwareFacts = ({ s, c, id }: { s: GameState; c: Cluster; id: string }) => <Facts facts={useSoftware(s, c, consoleFeatures(id, yearOf(s.hour))).facts} />;

describe("Pleskit, DirectAdmen and FreePanel looks", () => {
  it("draw every generation from its first version, signed in or not, whatever the year", () => {
    for (const [id, [looks, mark]] of Object.entries(LOOKS)) {
      expect(UI_LOOKS[id].map(([, look]) => look), id).toEqual(looks);
      for (const [version, look] of UI_LOOKS[id]) {
        const { s, c } = host(id, version);
        expect(lookOf(s, panelMachine(c)!, id), `${id} ${version}`).toBe(look);
        const html = render(id, s, c, true);
        expect(html, `${id} ${version}`).toContain(`data-era="${look}"`);
        expect(html, `${id} ${version}`).toContain(mark);
        const login = render(id, s, c, false);
        expect(login, `${id} ${version}`).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("shows the installed version on the software page", () => {
    const { s, c } = host("pleskit", "12.5");
    const facts = renderToString(<SoftwareFacts s={s} c={c} id="pleskit" />);
    expect(facts).toContain('<th>Version</th><td class="num">12.5</td>');
    const da = host("directadmen", "1.40");
    expect(render("directadmen", da.s, da.c, true)).toContain('<dt>Version</dt><dd class="num">1.40</dd>');
  });
});
