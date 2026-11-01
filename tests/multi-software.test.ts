import { describe, expect, it } from "vitest";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { fqdn } from "../src/sim/30-customers/domains";
import { type GameState } from "../src/sim/50-state";
import { bookable, clusterOf, clustersOf, controlPlanesOn, nodeCapacity } from "../src/sim/60-infra/cluster";
import { routeTarget } from "../src/sim/60-infra/routes";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { resolve } from "../src/sim/80-business/browser";
import { consoleTitle } from "../src/sim/80-business/consoles";
import { siteIndex } from "../src/sim/80-business/index";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, PANEL_VM_SIZE, provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { installBlock, installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { bootedMachine, readyGame, skipTo, withServer, newGame } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
const idOf = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };

// readyGame: Proxmocks on dev3 with a FreePanel VM; FreePanel then goes on dev3 itself, next to the hypervisor.
function panelOnNode(seed: number) {
  const s = readyGame(seed), cloud = clusterOf(s, "dev3")!;
  const panel = idOf(installSoftware(s, "dev3", "freepanel"));
  run(s, softwareById("freepanel").installHours);
  return { s, cloud: cloud.id, panel };
}

describe("several software on one machine", () => {
  it("installs a DNS server, a VPN and a panel on one Lunix server, each with its own cluster", () => {
    const s = withServer(newGame(1));
    skipTo(s, 2010);
    bootedMachine(s, "dev3");
    const ids = ["bound", "openveepeen", "freepanel"].map((id) => idOf(installSoftware(s, "dev3", id)));
    expect(new Set(ids).size).toBe(3);
    expect(clustersOf(s, "dev3").map((c) => c.kind).sort()).toEqual(["dns", "panel", "vpn"]);
    expect(clusterOf(s, "dev3", "vpn")?.id).toBe(ids[1]);
    expect(installBlock(s, "dev3", "pleskit")).toBe("error.portTaken");
    expect(installBlock(s, "dev3", "bound")).toBe("error.portTaken");
  });

  it("places web spaces on a panel on a Proxmocks node while VMs still go through the hypervisor", () => {
    const { s, cloud, panel } = panelOnNode(1);
    expect(clusterOf(s, "dev3")?.id).toBe(cloud);
    expect(clusterOf(s, "dev3", "panel")?.id).toBe(panel);
    expect(routeTarget(s, "dev3", "webHosting")?.clusterId).toBe(panel);
    expect(routeTarget(s, "dev3", "vps")?.clusterId).toBe(cloud);
    const site = idOf(provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "webHosting", { label: "ada.com", clusterId: panel }));
    expect(s.workloads.find((w) => w.serviceId === site)).toMatchObject({ clusterId: panel, deviceId: "dev3" });
    const vm = idOf(createVm(s, cloud, PANEL_VM_SIZE));
    expect(s.workloads.find((w) => w.id === vm)).toMatchObject({ clusterId: cloud, deviceId: "dev3" });
  });

  it("adds both control planes to the node's usage", () => {
    const { s } = panelOnNode(2), d = s.devices.find((x) => x.id === "dev3")!;
    const both = ["proxmocks", "freepanel"].map((id) => softwareById(id).controlPlane);
    expect(controlPlanesOn(s, "dev3").diskGb).toBeCloseTo(both[0].diskGb + both[1].diskGb);
    expect(bookable(s, d).diskGb).toBeCloseTo(nodeCapacity(d, s).diskGb - both[0].diskGb - both[1].diskGb);
    expect(nodeUsage(s, "dev3").used.ramGb).toBeGreaterThanOrEqual(both[0].ramGb + both[1].ramGb);
  });

  it("uninstalls the panel and keeps the hypervisor with its VMs", () => {
    const { s, cloud, panel } = panelOnNode(3), vms = s.workloads.filter((w) => w.clusterId === cloud).length;
    expect(uninstallSoftware(s, "dev3", "freepanel").ok).toBe(true);
    expect(s.clusters.some((c) => c.id === panel)).toBe(false);
    expect(clustersOf(s, "dev3").map((c) => c.id)).toEqual([cloud]);
    expect(s.workloads.filter((w) => w.clusterId === cloud).length).toBe(vms);
    expect(s.devices.find((d) => d.id === "dev3")!.software.map((x) => x.id)).toEqual(["proxmocks"]);
  });

  it("opens the hypervisor console at the host and the panel on its port, and lists both in the index", () => {
    const { s, cloud, panel } = panelOnNode(4), host = s.devices.find((d) => d.id === "dev3")!.hostname!, url = fqdn(s, host);
    expect(resolve(s, url).page).toMatchObject({ kind: "console", clusterId: cloud });
    expect(resolve(s, `${url}:8006`).page).toMatchObject({ kind: "console", clusterId: cloud });
    expect(resolve(s, `${url}:10000/`).page).toMatchObject({ kind: "console", clusterId: panel });
    expect(resolve(s, `${url}:2087`).page.kind).toBe("notfound");
    const rows = siteIndex(s).find((c) => c.title === s.company.name)!.rows;
    expect(rows.map((r) => r.title)).toEqual(expect.arrayContaining([`${consoleTitle("proxmocks")} ${host}:8006`, `${consoleTitle("freepanel")} ${host}:10000`]));
    expect(rows.find((r) => r.title.endsWith(`${host}:10000`))?.url).toBe(`${url}:10000`);
  });
});
