import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { Customer } from "../src/ui/apps/browser/consoles/pleskit/Customer";
import { setSitesOffline } from "../src/sim/90-actions/security";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host(year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "pleskit", { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === id)!;
  s.services.push({ id: "svc-x", product: "webHosting", customerId: s.customers[0]?.id, domain: "shop.example.com", label: "shop.example.com", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 3, app: "wordpass" } } as never);
  s.workloads.push({ id: "w-x", serviceId: "svc-x", clusterId: c.id, diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never);
  return { s, c };
}

describe("Pleskit customer side", () => {
  it("shows Log in as Customer on each subscription in early and late eras", () => {
    for (const year of [2008, 2022]) {
      const { s, c } = host(year), View = CONSOLES.pleskit;
      const html = renderToString(<View game={s} c={c} f={consoleFeatures("pleskit", yearOf(s.hour))} host="p.example.com" signedIn login={() => {}} logout={() => {}} />);
      expect(html, String(year)).toContain("Log in as Customer");
    }
  });

  it("draws the tabs, the domain with its document root and the tools", () => {
    const { s, c } = host(2014), html = renderToString(<Customer game={s} c={c} workloadId="w-x" era="twelve" />);
    for (const label of ["Websites &amp; Domains", "Mail", "Applications", "Files", "Databases", "File Sharing", "shop.example.com", "httpdocs", "Open in web", "Add Subdomain", "DNS Settings", "Scheduled Tasks", "WordPass Toolkit"]) expect(html).toContain(label);
  });

  it("lays out Plesk 8 as icon groups and Onyx with the left navigation", () => {
    const { s, c } = host(2008);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="reload" />)).not.toContain("pk-tabs");
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="onyx" />)).toContain("pk-side");
  });

  it("titles the shared tools in Plesk wording", () => {
    const { s, c } = host(2014);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="twelve" initialPage="cron" />)).toContain("Scheduled Tasks");
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="twelve" initialTab="mail" />)).toContain("Email Addresses");
  });

  it("shows the unavailable page when the host's sites are offline", () => {
    const { s, c } = host(2014);
    setSitesOffline(s, c.id, true);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="twelve" />)).toContain("currently unavailable");
  });
});
