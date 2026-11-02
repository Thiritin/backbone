import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { Customer } from "../src/ui/apps/browser/consoles/cpanic/Customer";
import { ServiceManager } from "../src/ui/apps/browser/consoles/cpanic/ServiceManager";
import { setSitesOffline } from "../src/sim/90-actions/security";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host(year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "cpanic", { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === id)!;
  s.services.push({ id: "svc-x", domain: "shop.example.com", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 3, app: "wordpass" } } as never);
  s.workloads.push({ id: "w-x", serviceId: "svc-x", clusterId: c.id, diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never);
  return { s, c };
}

describe("cPanic customer side", () => {
  it("shows the Log in as user button on each account in both eras", () => {
    for (const year of [2008, 2022]) {
      const { s, c } = host(year), View = CONSOLES.cpanic;
      const html = renderToString(<View game={s} c={c} f={consoleFeatures("cpanic", yearOf(s.hour))} host="p.example.com" signedIn login={() => {}} logout={() => {}} />);
      expect(html, String(year)).toContain("Log in as user");
      expect(html).toContain("Service Manager");
    }
  });

  it("draws the account's icons, domain and statistics", () => {
    const { s, c } = host(2008), html = renderToString(<Customer game={s} c={c} workloadId="w-x" />);
    for (const label of ["File Manager", "Email Accounts", "Zone Editor", "phpMyAdmin", "Raw Access", "Errors", "shop.example.com"]) expect(html).toContain(label);
  });

  it("shows the unavailable page when the host's sites are offline", () => {
    const { s, c } = host(2008);
    setSitesOffline(s, c.id, true);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" />)).toContain("currently unavailable");
  });

  it("lists the web server as stopped once the sites are offline", () => {
    const { s, c } = host(2008);
    expect(renderToString(<ServiceManager game={s} c={c} />)).not.toContain("Stopped");
    setSitesOffline(s, c.id, true);
    expect(renderToString(<ServiceManager game={s} c={c} />)).toContain("Stopped");
  });
});
