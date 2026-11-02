import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { VirtualServers } from "../src/ui/apps/browser/consoles/freepanel/FreePanel";
import { Customer } from "../src/ui/apps/browser/consoles/freepanel/Customer";
import { setSitesOffline } from "../src/sim/90-actions/security";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host(year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "freepanel", { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === id)!;
  s.services.push({ id: "svc-x", domain: "shop.example.com", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 3, app: "wordpass" } } as never);
  s.workloads.push({ id: "w-x", serviceId: "svc-x", clusterId: c.id, diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never);
  return { s, c };
}

describe("FreePanel customer side", () => {
  it("shows Login As Server Admin on each virtual server in both eras", () => {
    for (const year of [2008, 2022]) {
      const { s, c } = host(year);
      const html = renderToString(<VirtualServers game={s} c={c} f={consoleFeatures("freepanel", yearOf(s.hour))} onLogin={() => {}} />);
      expect(html, String(year)).toContain("Login As Server Admin");
    }
  });

  it("draws the Virtualmen tree, the Webmen modules and the server summary", () => {
    const { s, c } = host(2008), html = renderToString(<Customer game={s} c={c} workloadId="w-x" era="gray" />);
    for (const label of ["shop.example.com", "Edit Virtual Server", "Edit Users", "Edit Mail Aliases", "Edit Databases", "Server Configuration", "DNS Records", "Logs and Reports", "Webmen Modules", "Postfix Mail Server", "ProFTPD Server", "Home directory"]) expect(html).toContain(label);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="authentic" />)).toContain("Virtualmen");
  });

  it("words the shared tool pages as Virtualmin does", () => {
    const { s, c } = host(2008);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="gray" initial="db" />)).toContain("Edit Databases");
    const mysql = renderToString(<Customer game={s} c={c} workloadId="w-x" era="gray" initial="mysql" openPma={() => {}} />);
    expect(mysql).toContain("phpMyAdmon");
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="gray" initial="postfix" />)).toContain("Spam Filtering");
  });

  it("shows the unavailable page when the host's sites are offline", () => {
    const { s, c } = host(2008);
    setSitesOffline(s, c.id, true);
    expect(renderToString(<Customer game={s} c={c} workloadId="w-x" era="gray" />)).toContain("currently unavailable");
  });
});
