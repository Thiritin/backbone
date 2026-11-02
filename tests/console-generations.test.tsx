import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { lookOf, panelMachine } from "../src/sim/60-infra/licence";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { createVm } from "../src/sim/90-actions/clusters";
import type { Cluster } from "../src/sim/60-infra/cluster";
import { type GameState } from "../src/sim/50-state";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { hypervisor, newGame, panelVm, pinVersion, readyGame, skipTo, withServer } from "./fixtures";

// docs/design/software-versions.md, UI generations: each generation's first version, its look, and a mark of the signed-in page.
const GENERATIONS: Record<string, [version: string, look: string][]> = {
  tcadmen: [["1.0", "early"], ["2.0", "late"], ["3.0", "v3"]],
  anyconnekt: [["2.0", "early"], ["4.0", "late"], ["5.0", "secure"]],
  minnio: [["RELEASE.2016-06-03", "early"], ["RELEASE.2021-05-11", "late"], ["RELEASE.2025-05-24", "browser"]],
  veeham: [["1.0", "ribbon"], ["10.0", "refresh"], ["13.0", "web"]],
  openstash: [["Austin", "dashboard"], ["Essex", "early"], ["Havana", "heat"], ["Mitaka", "late"]],
};
const MARK: Record<string, string> = { tcadmen: "Game Servers", anyconnekt: "Device Information", minnio: "MINN", veeham: "Jobs", openstash: "Instances" };
const YEAR = 2026;

function host(id: string): { s: GameState; c: Cluster } {
  if (id === "openstash") {
    const s = withServer(newGame(3));
    skipTo(s, YEAR);
    s.cash = 1_000_000;
    const c = hypervisor(s, ["dev3"], "Cloud 1", id);
    createVm(s, c, { vcpu: 1, ramGb: 1, diskGb: 20 });
    return { s, c: s.clusters.find((x) => x.id === c)! };
  }
  const s = readyGame(1);
  skipTo(s, YEAR);
  s.cash = 1_000_000;
  const id2 = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, id, { vcpu: 4, ramGb: 8, diskGb: 600 });
  return { s, c: s.clusters.find((x) => x.id === id2)! };
}

const render = (id: string, s: GameState, c: Cluster, signedIn: boolean) => {
  const View = CONSOLES[id];
  return renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="look.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />);
};

describe("consoles drawn per UI generation", () => {
  it("pick each generation's look from its first version, signed in or not, in a late year", () => {
    for (const [id, gens] of Object.entries(GENERATIONS)) {
      const { s, c } = host(id);
      for (const [version, look] of gens) {
        pinVersion(s, c, id, version);
        expect(lookOf(s, panelMachine(c)!, id), `${id} ${version}`).toBe(look);
        const page = render(id, s, c, true);
        expect(page, `${id} ${version}`).toContain(`data-era="${look}"`);
        expect(page, `${id} ${version}`).toContain(MARK[id]);
        expect(page).toContain("look.example.com");
        const login = render(id, s, c, false);
        expect(login, `${id} ${version}`).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("names AnyConnekt the Sekure Client from 5.0", () => {
    const { s, c } = host("anyconnekt");
    pinVersion(s, c, "anyconnekt", "4.10");
    expect(render("anyconnekt", s, c, true)).not.toContain("Sekure Client");
    pinVersion(s, c, "anyconnekt", "5.1");
    expect(render("anyconnekt", s, c, true)).toContain("Sekure Client");
  });

  it("keeps Proxmocks Backup Server in its one look", () => {
    const { s, c } = host("proxmocksBackup");
    expect(render("proxmocksBackup", s, c, true)).not.toContain("data-era");
  });
});
