import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { UserHome } from "../src/ui/apps/browser/consoles/directadmen/UserLevel";
import { setSitesOffline } from "../src/sim/90-actions/security";
import { panelVm, readyGame, skipTo } from "./fixtures";

// The admin level opens on its home page; the list of users is the "objects" tab.
vi.mock("../src/ui/apps/browser/consoles/PanelBase", async (orig) => ({ ...(await orig<object>()), usePanelTab: () => ["objects", () => {}] }));

function host(year: number) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "directadmen", { vcpu: 2, ramGb: 4, diskGb: 50 }), c = s.clusters.find((x) => x.id === id)!;
  s.services.push({ id: "svc-x", domain: "shop.example.com", startedAt: 0, endedAt: null, spec: { vcpu: 0.1, ramGb: 0.25, diskGb: 2, trafficGb: 5, mailboxes: 3, app: "wordpass" } } as never);
  s.workloads.push({ id: "w-x", serviceId: "svc-x", clusterId: c.id, diskGb: 2, vcpu: 0.1, ramGb: 0.25, busyUntil: 0, backupAt: null, stopped: false } as never);
  return { s, c };
}

const admin = (year: number) => {
  const { s, c } = host(year), View = CONSOLES.directadmen;
  return renderToString(<View game={s} c={c} f={consoleFeatures("directadmen", yearOf(s.hour))} host="p.example.com" signedIn login={() => {}} logout={() => {}} />);
};

afterEach(() => vi.unstubAllGlobals());

describe("DirectAdmen user level", () => {
  it("shows Login as on each user in the Enhanced and Evolution skins", () => {
    for (const year of [2010, 2022]) expect(admin(year), String(year)).toContain("Login as");
  });

  it("opens the logged-in user's level with a link back to the admin level", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    store.set("raid0.ui.browser.directadmen.as." + host(2010).c.id, JSON.stringify("w-x"));
    const html = admin(2010);
    for (const label of ["Admin Level", "User Level", "Account Manager", "Domain Setup"]) expect(html).toContain(label);
  });

  it("draws the four sections, the links and the domain", () => {
    const { s, c } = host(2010), html = renderToString(<UserHome game={s} c={c} workloadId="w-x" rows={[]} />);
    for (const label of ["Account Manager", "Email Manager", "Advanced Features", "System Info &amp; Files", "Subdomain Management", "Domain Pointers", "DNS Management", "MySQL Management", "phpMyAdmon", "FTP Management", "E-Mail Accounts", "SpamAssassin Setup", "Webmail", "Cronjobs", "Site Summary / Statistics / Logs", "File Manager", "shop.example.com"]) expect(html).toContain(label);
  });

  it("titles the tool pages in DirectAdmen's wording", () => {
    const { s, c } = host(2022);
    expect(renderToString(<UserHome game={s} c={c} workloadId="w-x" rows={[]} initial="addon" />)).toContain("<h2>Domain Setup</h2>");
    expect(renderToString(<UserHome game={s} c={c} workloadId="w-x" rows={[]} initial="db" />)).toContain("MySQL Management");
  });

  it("shows the unavailable page when the host's sites are offline", () => {
    const { s, c } = host(2010);
    setSitesOffline(s, c.id, true);
    expect(renderToString(<UserHome game={s} c={c} workloadId="w-x" rows={[]} />)).toContain("currently unavailable");
  });
});
