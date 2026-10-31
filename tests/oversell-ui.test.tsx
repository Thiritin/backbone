import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { oversellRatio } from "../src/sim/60-infra/oversell";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setOversell } from "../src/sim/90-actions/oversell";
import { Oversell } from "../src/ui/apps/browser/consoles/HostSettings";
import { panelVm, readyGame } from "./fixtures";

function setup(panel: string) {
  const s = readyGame(1);
  const host = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, panel);
  s.clusters = s.clusters.filter((x) => x.kind !== "panel" || x.id === host);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  for (const label of ["a.com", "b.com"]) provisionService(s, cus, "webHosting", { label });
  const view = () => renderToString(<Oversell game={s} c={s.clusters.find((x) => x.id === host)!} />);
  return { s, host, view };
}

describe("oversell readout", () => {
  it("shows accounts, the booked ratio and no cap by default", () => {
    const { s, host, view } = setup("freepanel");
    const html = view();
    expect(html).toContain("Booked per physical vCPU");
    expect(html).toContain(`${+oversellRatio(s, s.clusters.find((x) => x.id === host)!).cpu.toFixed(2)} : 1`);
    expect(html).toContain("Oversell cap");
    expect(html).toContain("No cap");
  });

  it("shows the cap the player set", () => {
    const { s, host, view } = setup("freepanel");
    expect(setOversell(s, host, 2.5).ok).toBe(true);
    expect(view()).toContain('value="2.5"');
  });

  it("names the field Overallocate in percent on Pterodaktyl", () => {
    const { s, host, view } = setup("pterodaktyl");
    setOversell(s, host, 1.5);
    const html = view();
    expect(html).toContain("Overallocate (%)");
    expect(html).toContain('value="150"');
  });
});
