import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { addPackage } from "../src/sim/90-actions/packages";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { lateVersions, panelVm, pinVersion, readyGame, skipTo } from "./fixtures";

// docs/design/software.md, section 10: a year of each console's early look, a year of its late look, and a mark of its page.
const ERAS: Record<string, [number, number, string]> = {
  tcadmen: [2005, 2016, "Game Servers"], multikraft: [2010, 2018, "Servers"], pterodaktyl: [2016, 2021, "Servers"],
};

function render(id: string, year: number, signedIn: boolean, path?: string, version?: string) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const basement = s.clusters.find((c) => c.kind === "cloud")!;
  const host = panelVm(s, basement.id, id), c = s.clusters.find((x) => x.id === host)!;
  if (version) pinVersion(s, c, id, version);
  const View = CONSOLES[id];
  return { year: yearOf(s.hour), html: renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="panel.example.com" path={path} signedIn={signedIn} login={() => {}} logout={() => {}} />) };
}

describe("hosting and game panel consoles", () => {
  it("are drawn by their own component", () => {
    for (const id of Object.keys(ERAS)) expect(CONSOLES[id], id).toBeDefined();
  });

  it("wear the look of the installed version, signed in or not", () => {
    for (const [id, [early, late, mark]] of Object.entries(ERAS)) {
      const [before, from] = lateVersions(id);
      for (const [year, look, version] of [[early, "early", undefined], [late, "early", before], [late, "late", from]] as const) {
        const out = render(id, year, true, undefined, version);
        expect(out.year, id).toBe(year);
        expect(out.html, `${id} ${year}`).toContain(`data-era="${look}"`);
        expect(out.html, `${id} ${year}`).toContain(mark);
        expect(out.html).toContain("panel.example.com");
        const login = render(id, year, false, undefined, version).html;
        expect(login, id).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("draws cPanic in the look of each generation's first version, signed in or not", () => {
    expect(CONSOLES.cpanic).toBeDefined();
    for (const [version, look, year] of [["10", "x3", 2022], ["11.38", "paperLamp", 2022], ["98", "jupitar", 2022]] as const) {
      for (const signedIn of [true, false]) {
        const { html } = render("cpanic", year, signedIn, undefined, version);
        expect(html, version).toContain(`data-era="${look}"`);
        expect(html).toContain("WebHost Manager");
        expect(html).toContain(signedIn ? "List Accounts" : "Password");
      }
    }
  });

  it("lists the software facts, the update tools and the backup schedule on the software page", () => {
    const { html } = render("directadmen", 2005, true);
    expect(html).toContain("Open vulnerabilities");
    expect(html).toContain("Remove host");
    expect(html).toContain("PHP");
    expect(html).toContain("Weekly");
  });

  it("draws the cPanic packages screen in both eras, with and without packages", () => {
    for (const year of [2010, 2016]) {
      const empty = render("cpanic", year, true, "/scripts/addpkg");
      expect(empty.html).toContain("Add a Package");
      expect(empty.html).toContain("Package Name");
      const s = readyGame(1);
      skipTo(s, year);
      const host = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic"), c = s.clusters.find((x) => x.id === host)!;
      addPackage(s, host, { name: "Starter", product: "webHosting", spec: { vcpu: 1, ramGb: 1, diskGb: 10, trafficGb: 100, mailboxes: 5 } });
      const View = CONSOLES.cpanic;
      const html = renderToString(<View game={s} c={c} f={consoleFeatures("cpanic", yearOf(s.hour))} host="panel.example.com" path="/scripts/addpkg" signedIn login={() => {}} logout={() => {}} />);
      expect(html).toContain("Starter");
    }
  });
});
