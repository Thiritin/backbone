import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { panelVm, readyGame, skipTo } from "./fixtures";

// docs/design/software.md, section 10: the first year of each console's early and late look.
const ERAS: Record<string, [number, number, string]> = {
  cpanic: [2005, 2014, "WebHost Manager"], pleskit: [2005, 2015, "Websites &amp; Domains"], directadmen: [2005, 2018, "Server Manager"],
  freepanel: [2005, 2016, "Software and updates"], tcadmen: [2005, 2016, "Game Servers"], multikraft: [2010, 2018, "Servers"], pterodaktyl: [2016, 2021, "Servers"],
};

function render(id: string, year: number, signedIn: boolean) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const basement = s.clusters.find((c) => c.kind === "cloud")!;
  const host = panelVm(s, basement.id, id), c = s.clusters.find((x) => x.id === host)!;
  const View = CONSOLES[id];
  return { year: yearOf(s.hour), html: renderToString(<View game={s} c={c} f={consoleFeatures(id, yearOf(s.hour))} host="panel.example.com" signedIn={signedIn} login={() => {}} logout={() => {}} />) };
}

describe("hosting and game panel consoles", () => {
  it("are drawn by their own component", () => {
    expect(Object.keys(CONSOLES).sort()).toEqual(Object.keys(ERAS).sort());
  });

  it("wear the early look before the late year and the late look from it, signed in or not", () => {
    for (const [id, [early, late, mark]] of Object.entries(ERAS)) {
      for (const [year, look] of [[early, "early"], [late - 1, "early"], [late, "late"]] as const) {
        const out = render(id, year, true);
        expect(out.year, id).toBe(year);
        expect(out.html, `${id} ${year}`).toContain(`data-era="${look}"`);
        expect(out.html, `${id} ${year}`).toContain(mark);
        expect(out.html).toContain("panel.example.com");
        const login = render(id, year, false).html;
        expect(login, id).toContain(`data-era="${look}"`);
        expect(login).toContain("Password");
      }
    }
  });

  it("lists the software facts and the update tools on the software page", () => {
    const { html } = render("directadmen", 2005, true);
    expect(html).toContain("Open vulnerabilities");
    expect(html).toContain("Remove host");
  });
});
