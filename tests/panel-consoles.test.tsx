import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { addPackage } from "../src/sim/90-actions/packages";
import { reboot } from "../src/sim/90-actions/hardware";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { useSoftware } from "../src/ui/apps/browser/consoles/PanelBase";
import { UpdatesPage } from "../src/ui/apps/browser/consoles/UpdatesPage";
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
  const host = panelVm(s, basement.id, id, { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === host)!;
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

  it("shows the installed version in the PowerDNZ stats, not the year", () => {
    const [, from] = lateVersions("powerdnz");
    const out = render("powerdnz", 2020, true, undefined, from).html;
    expect(out).toContain(`<b class="num">${from}</b>`);
    expect(out).not.toContain('<b class="num">2020</b>');
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

  it("keeps the facts, PHP and the server restart on a web panel's software page", () => {
    const { html } = render("directadmen", 2005, true);
    expect(html).toContain("Open vulnerabilities");
    expect(html).toContain("PHP");
    expect(html).toContain("Restart server");
    for (const gone of ["Remove host", "Resize", "Take sites offline", "Weekly", "Update channel", "automatic updates", "Oversell"]) expect(html, gone).not.toContain(gone);
  });

  it("offers no resize, remove or offline actions on any web panel", () => {
    for (const id of ["cpanic", "pleskit", "directadmen", "freepanel"]) {
      const s = readyGame(1);
      skipTo(s, 2020);
      s.cash = 1_000_000;
      const host = panelVm(s, s.clusters.find((k) => k.kind === "cloud")!.id, id, { vcpu: 4, ramGb: 8, diskGb: 100 }), c = s.clusters.find((x) => x.id === host)!;
      const Ids = () => <>{useSoftware(s, c, consoleFeatures(id, 2020)).actions.map((a) => a.id).join(",")}</>;
      const ids = renderToString(<Ids />).split(",");
      expect(ids, id).toContain("restart");
      for (const gone of ["resize", "remove", "offline", "update", "auto"]) expect(ids, id).not.toContain(gone);
      const server = s.devices.find((d) => d.id === s.workloads.find((w) => w.id === c.vm)?.deviceId)!;
      expect(reboot(s, server.id).ok, id).toBe(true);
      expect(server.bootUntil, id).toBeGreaterThan(s.hour);
    }
  });

  it("shows the Updates page only in the years the panel updates itself", () => {
    const tab: Record<string, [string, number, number]> = { cpanic: ["Update Preferences", 2007, 2008], pleskit: [">Updates<", 2013, 2014], directadmen: [">Updates<", 2018, 2019] };
    for (const [id, [mark, before, from]] of Object.entries(tab)) {
      expect(render(id, before, true).html, `${id} ${before}`).not.toContain(mark);
      expect(render(id, from, true).html, `${id} ${from}`).toContain(mark);
    }
    expect(render("freepanel", 2025, true).html).not.toContain("Upgrade");
  });

  it("draws the version, release channel, automatic updates and the update due on the Updates page", () => {
    const s = readyGame(1);
    skipTo(s, 2015);
    s.cash = 1_000_000;
    const host = panelVm(s, s.clusters.find((k) => k.kind === "cloud")!.id, "pleskit"), c = s.clusters.find((x) => x.id === host)!;
    c.version = 2010;
    const html = renderToString(<UpdatesPage game={s} c={c} />);
    for (const mark of ["Version", "Last update", "Update channel", "Automatic updates", "Update to 2015"]) expect(html, mark).toContain(mark);
  });

  it("draws the cPanic packages screen in both eras, with and without packages", () => {
    for (const year of [2010, 2016]) {
      const empty = render("cpanic", year, true, "/scripts/addpkg");
      expect(empty.html).toContain("Add a Package");
      expect(empty.html).toContain("Package Name");
      const s = readyGame(1);
      skipTo(s, year);
      const host = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic", { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === host)!;
      addPackage(s, host, { name: "Starter", product: "webHosting", spec: { vcpu: 1, ramGb: 1, diskGb: 10, trafficGb: 100, mailboxes: 5 } });
      const View = CONSOLES.cpanic;
      const html = renderToString(<View game={s} c={c} f={consoleFeatures("cpanic", yearOf(s.hour))} host="panel.example.com" path="/scripts/addpkg" signedIn login={() => {}} logout={() => {}} />);
      expect(html).toContain("Starter");
    }
  });
});
