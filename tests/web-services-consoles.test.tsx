import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { CustomBuild } from "../src/ui/apps/browser/consoles/directadmen/CustomBuild";
import { UserLevel } from "../src/ui/apps/browser/consoles/directadmen/UserLevel";
import { SubscriptionList } from "../src/ui/apps/browser/consoles/pleskit/SubscriptionList";
import type { Row } from "../src/ui/apps/browser/consoles/PanelBase";
import { panelVm, readyGame, skipTo } from "./fixtures";

const DA = Object.keys(CONSOLES).find((k) => k.startsWith("direct"))!;

function setup(id: string, year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const host = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, id), c = s.clusters.find((x) => x.id === host)!;
  return { s, c };
}

describe("web service consoles", () => {
  it("offer two login levels on the DirectAdmen sign-in", () => {
    const { s, c } = setup(DA, 2010);
    const View = CONSOLES[DA];
    const html = renderToString(<View game={s} c={c} f={consoleFeatures(DA, yearOf(s.hour))} host="panel.example.com" signedIn={false} login={() => {}} logout={() => {}} />);
    expect(html).toContain("Login as");
    expect(html).toContain("Admin");
    expect(html).toContain("User");
    expect(html).not.toContain("Reseller");
  });

  it("draws CustomBuild as the option list early and as a table late", () => {
    const early = setup(DA, 2010), late = setup(DA, 2019);
    const a = renderToString(<CustomBuild game={early.s} c={early.c} late={false} />);
    expect(a).toContain("php1_release=");
    expect(a).toContain("Rebuild");
    const b = renderToString(<CustomBuild game={late.s} c={late.c} late />);
    expect(b).toContain("<table");
    expect(b).toContain("PHP 1");
    expect(b).toContain("Rebuild");
  });

  it("lists the host's users on the user level", () => {
    const { s, c } = setup(DA, 2010);
    const w = s.workloads.find((x) => x.clusterId === c.id && x.serviceId);
    const rows = w ? [{ id: w.id, name: "ada.de", cpu: [1, 2], ram: [1, 2], disk: [1, 2] } as unknown as Row] : [];
    const html = renderToString(<UserLevel game={s} c={c} rows={rows} />);
    expect(html).toContain("Select a user");
    if (w) expect(html).toContain("ada.de");
  });

  it("draws the Pleskit objects as clients early and as a subscriptions table late", () => {
    const PK = Object.keys(CONSOLES).find((k) => k.startsWith("pleskit"))!;
    const early = setup(PK, 2010), late = setup(PK, 2019);
    expect(renderToString(<SubscriptionList game={early.s} c={early.c} rows={[]} late={false} />)).toContain("Clients");
    const html = renderToString(<SubscriptionList game={late.s} c={late.c} rows={[]} late />);
    expect(html).toContain("Service plan");
    expect(html).not.toContain("Clients");
  });
});
