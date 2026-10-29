import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { serviceOnline } from "../src/sim/40-support/status";
import { offers } from "../src/sim/30-market/market";
import { newGame, type GameState } from "../src/sim/50-state";
import { controlPlaneUp, lineOffered, nodeCapacity, nodeUsed, vmById, vmOf, workloadsOf } from "../src/sim/60-infra/cluster";
import { installedRamGb } from "../src/sim/60-infra/status";
import { FAILOVER_MINUTES } from "../src/sim/60-infra/ha";
import { tick } from "../src/sim/88-tick/tick";
import {
  addNode, createPanelVm, installPanel, provisionService, removePanelHost, resizePanelVm, setHa,
} from "../src/sim/90-actions/clusters";
import { installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { migrateWorkload } from "../src/sim/90-actions/vms";
import { startGame } from "../src/sim/90-actions/start";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { basement, hypervisor, join, panelServer, panelVm, readyGame, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const run = (s: GameState, hours: number) => Array.from({ length: hours }, () => tick(s)).flat();
const web = (s: GameState, cus: string, i: number) => provisionService(s, cus, "webHosting", { label: `site${i}.example`, spec: sizeSpec("webHosting", 1, yearOf(s.hour)) });
// Fills web spaces until one does not fit; returns how many did.
const fill = (s: GameState, cus: string) => { let n = 0; while (web(s, cus, n).ok) n++; return n; };

// The basement with a second G1 server cabled to the switch, both in the hypervisor cluster "Basement 1".
function twoNodes(): { s: GameState; cluster: string; second: string } {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const cluster = basement(s);
  join(s, cluster, second);
  return { s, cluster, second };
}

describe("compute", () => {
  it("starts with the basement server running nothing, no customers and no product line on sale", () => {
    const s = withServer(startGame(1));
    expect([s.clusters.length, s.customers.length]).toEqual([0, 0]);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    expect(err(web(s, cus, 0))).toBe("error.needsPanel");
    expect(err(provisionService(s, cus, "vps", { label: "Box" }))).toBe("error.needsPlatform");
    expect((["webHosting", "vps", "gameServer"] as const).some((p) => lineOffered(s, p) || offers(s, p, "Frankfurt"))).toBe(false);
  });

  it("runs one control plane per server: a panel server takes no hypervisor and a hypervisor node no panel", () => {
    const s = withServer(startGame(1));
    skipTo(s, 2010);
    const host = ok(installPanel(s, "dev3", "freepanel"));
    expect(err(installSoftware(s, "dev3", "proxmocks"))).toBe("error.onePanel");
    expect(err(installSoftware(s, "dev3", "cpanic"))).toBe("error.onePanel");
    expect(err(installPanel(s, "dev3", "cpanic"))).toBe("error.serverInUse");
    expect(err(addNode(s, host, "dev3"))).toBe("error.panelHostOneServer");
    // Changing the panel needs the server empty of web spaces.
    run(s, softwareById("freepanel").installHours);
    expect(s.customers.filter((c) => c.habit === "friend")).toHaveLength(3);
    expect(err(uninstallSoftware(s, "dev3"))).toBe("error.softwareInUse");
  });

  it("sets the basement up as a panel server: installs for the panel's hours, then the friends move in and only web hosting sells", () => {
    const s = withServer(startGame(1));
    const host = ok(installPanel(s, "dev3", "cpanic"));
    run(s, softwareById("cpanic").installHours - 1);
    expect(s.customers).toHaveLength(0);
    const events = run(s, 1);
    expect(events.map((e) => e.key)).toEqual(expect.arrayContaining(["event.installed", "event.friendsJoined"]));
    expect(s.services.every((v) => workloadsOf(s, v.id)[0].clusterId === host && serviceOnline(s, v.id))).toBe(true);
    expect([lineOffered(s, "webHosting"), lineOffered(s, "vps")]).toEqual([true, false]);
  });

  it("sets the basement up as a hypervisor with a panel VM: the panel follows the hypervisor, then the friends move in", () => {
    const s = withServer(startGame(1));
    skipTo(s, 2010);
    const cluster = ok(installSoftware(s, "dev3", "proxmocks"));
    const host = ok(createPanelVm(s, cluster, "freepanel"));
    const hours = softwareById("proxmocks").installHours + softwareById("freepanel").installHours;
    run(s, hours - 1);
    expect(s.customers).toHaveLength(0);
    run(s, 1);
    expect(s.services.map((v) => vmOf(s, workloadsOf(s, v.id)[0])?.id)).toEqual(Array(3).fill(s.clusters.find((c) => c.id === host)!.vm));
    expect(s.services.every((v) => serviceOnline(s, v.id))).toBe(true);
    expect([lineOffered(s, "webHosting"), lineOffered(s, "vps")]).toEqual([true, true]);
  });

  it("books web hosting past the panel VM's CPU and RAM, refuses only on its disk, and refuses a resize below its web spaces' disk", () => {
    const s = withServer(startGame(1)), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const host = panelVm(s, basement(s), "freepanel", { vcpu: 2, ramGb: 1.2, diskGb: 40 });
    const spec = sizeSpec("webHosting", 1, yearOf(s.hour));
    // The VM's 40 GB less FreePanel's 2 GB holds the web spaces; their RAM books far past the VM's 1.2 GB.
    const n = fill(s, cus), booked = s.workloads.filter((w) => w.clusterId === host).reduce((a, w) => a + w.ramGb, 0);
    expect(n).toBe(Math.floor((38 + 1e-9) / spec.diskGb));
    expect(booked).toBeGreaterThan(1.2 * 0.95);
    expect(err(web(s, cus, 999))).toBe("error.noCapacity");
    expect(err(resizePanelVm(s, host, { vcpu: 2, ramGb: 1.2, diskGb: 20 }))).toBe("error.vmTooSmall");
    ok(resizePanelVm(s, host, { vcpu: 2, ramGb: 1.2, diskGb: 80 }));
    ok(web(s, cus, 1000));
    expect(vmById(s, s.clusters.find((c) => c.id === host)!.vm)!.diskGb).toBe(80);
    expect(err(resizePanelVm(s, host, { vcpu: 2, ramGb: 1.2, diskGb: 999999 }))).toBe("error.nodeFull");
    expect(err(removePanelHost(s, host))).toBe("error.nodeNotEmpty");
  });

  it("books web hosting on a panel server until its disk is full and freezes it once the RAM in use passes the installed RAM", () => {
    const s = withServer(startGame(1)), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    panelServer(s, "dev3");
    const d = s.devices.find((x) => x.id === "dev3")!, spec = sizeSpec("webHosting", 1, yearOf(s.hour));
    const n = fill(s, cus);
    expect(n).toBe(Math.floor((nodeCapacity(d).diskGb - 2 + 1e-9) / spec.diskGb));
    expect(nodeUsed(s, "dev3").ramGb).toBeGreaterThan(installedRamGb(d));
    expect(run(s, 1).map((e) => e.key)).toContain("event.nodeFrozen");
    expect(s.frozen).toContain("dev3");
  });

  it("sends web hosting to the panel VM with the RAM first and past a full one only when none is left", () => {
    const { s, cluster } = twoNodes(), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const small = panelVm(s, cluster, "freepanel", { vcpu: 2, ramGb: 1.2, diskGb: 100 }), big = panelVm(s, cluster, "freepanel", { vcpu: 2, ramGb: 4, diskGb: 100 });
    const inside = (id: string) => s.workloads.filter((w) => w.clusterId === id).length;
    for (let i = 0; i < 20; i++) ok(web(s, cus, i));
    // The small VM holds four web spaces within its RAM and the big one fourteen; the last two go past the small VM's RAM.
    expect([inside(small), inside(big)]).toEqual([6, 14]);
  });

  it("takes web hosting down with its bare-metal panel server, while a panel VM moves with its VM", () => {
    const bare = withServer(startGame(1)), cus = addCustomer(bare, "Ada Lang", "hobbyDev");
    panelServer(bare, "dev3");
    const site = ok(web(bare, cus, 0));
    ok(setPower(bare, "dev3", false));
    run(bare, 1);
    expect(serviceOnline(bare, site)).toBe(false);

    const { s, cluster, second } = twoNodes(), ada = addCustomer(s, "Ada Lang", "hobbyDev");
    const host = panelVm(s, cluster);
    const vm = s.clusters.find((c) => c.id === host)!.vm!;
    const id = ok(web(s, ada, 0));
    expect(vmById(s, vm)!.deviceId).toBe("dev3");
    ok(migrateWorkload(s, vm, second));
    run(s, 2);
    expect([vmById(s, vm)!.deviceId, serviceOnline(s, id)]).toEqual([second, true]);
  });

  it("fails VMs over within five minutes only with failover on and room on another node", () => {
    const setup = (ha: boolean) => {
      const { s, cluster, second } = twoNodes(), cus = addCustomer(s, "Ada Lang", "hobbyDev");
      s.unlocks = [...s.unlocks, "virtualization"];
      if (ha) ok(setHa(s, cluster, "failover", true));
      const box = ok(provisionService(s, cus, "vps", { label: "Box", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
      expect(workloadsOf(s, box)[0].deviceId).toBe("dev3");
      return { s, cluster, second, box };
    };
    const off = setup(false);
    ok(setPower(off.s, "dev3", false));
    run(off.s, 3);
    expect([workloadsOf(off.s, off.box)[0].deviceId, serviceOnline(off.s, off.box), off.s.downHours[off.box]]).toEqual(["dev3", false, 3]);

    const on = setup(true);
    ok(setPower(on.s, "dev3", false));
    const events = run(on.s, 3);
    expect(events.filter((e) => e.key === "event.failedOver")).toHaveLength(1);
    expect([workloadsOf(on.s, on.box)[0].deviceId, serviceOnline(on.s, on.box)]).toEqual([on.second, true]);
    expect(on.s.downHours[on.box]).toBeCloseTo(FAILOVER_MINUTES / 60);
    expect(on.s.clusters.find((c) => c.id === on.cluster)!.controlPlane).toBe(on.second);

    const full = setup(true);
    ok(setPower(full.s, full.second, false));
    ok(setPower(full.s, "dev3", false));
    const stuck = run(full.s, 3);
    expect(stuck.filter((e) => e.key === "event.failoverStuck")).toHaveLength(1);
    expect(serviceOnline(full.s, full.box)).toBe(false);
  });

  it("gates high availability behind research, balancing behind live migration, and cloud behind failover", () => {
    const { s, cluster } = twoNodes(), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    expect(err(setHa(s, cluster, "failover", true))).toBe("error.missingSkill");
    s.unlocks = [...s.unlocks, "virtualization"];
    expect(err(setHa(s, cluster, "balance", true))).toBe("error.needsLiveMigration");
    expect(err(provisionService(s, cus, "cloud", { label: "Cloud" }))).toBe("error.needsHaCluster");
    expect(lineOffered(s, "cloud")).toBe(false);
    ok(setHa(s, cluster, "failover", true));
    ok(provisionService(s, cus, "cloud", { label: "Cloud" }));
    expect(lineOffered(s, "cloud")).toBe(true);
    const hyper = { ...withServer(newGame(2)) };
    const c2 = hypervisor(hyper, ["dev3"], "Hyper 1", "hypervee");
    hyper.unlocks = ["virtualization"];
    expect(err(setHa(hyper, c2, "live", true))).toBe("error.noLiveMigration");
  });

  it("moves VMs live only with live migration on", () => {
    const { s, cluster, second } = twoNodes(), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const a = ok(provisionService(s, cus, "vps", { label: "A", spec: sizeSpec("vps", 0, yearOf(s.hour)) })), b = ok(provisionService(s, cus, "vps", { label: "B", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    ok(migrateWorkload(s, workloadsOf(s, a)[0].id, second));
    expect(workloadsOf(s, a)[0].busyUntil).toBeGreaterThan(s.hour);
    s.unlocks = [...s.unlocks, "virtualization"];
    ok(setHa(s, cluster, "live", true));
    ok(migrateWorkload(s, workloadsOf(s, b)[0].id, second));
    expect(workloadsOf(s, b)[0].busyUntil).toBe(0);
  });

  it("loads an old save: a panel and platform cluster becomes a hypervisor cluster with a panel VM holding its web spaces", () => {
    const s = readyGame(1);
    const [cluster, host] = s.clusters, vm = vmById(s, host.vm)!;
    // Undo the conversion: the web spaces on the cluster's node, panel and platform on the cluster, PHP on the node.
    const old = {
      ...s,
      clusters: [{ id: cluster.id, name: cluster.name, az: cluster.az, placement: "pack", nodes: [{ deviceId: "dev3", state: "active", php: "4.4", phpUntil: -1 }],
        panel: "freepanel", platform: "proxmocks", controlPlane: "dev3", switching: null, backup: { targetId: null, every: "off" } }],
      workloads: s.workloads.filter((w) => w.id !== vm.id).map((w) => ({ ...w, clusterId: cluster.id, deviceId: "dev3" })),
    };
    const back = deserialize(serialize(old as unknown as GameState));
    expect(back.clusters.map((c) => [c.name, c.kind, c.platform, c.panel])).toEqual([["Basement 1", "cloud", "proxmocks", null], ["Basement 1 web", "panel", null, "freepanel"]]);
    expect(back.services.every((v) => vmOf(back, workloadsOf(back, v.id)[0])?.deviceId === "dev3" && serviceOnline(back, v.id))).toBe(true);
    expect(controlPlaneUp(back, back.clusters[1])).toBe(true);
    expect(back.clusters[1].php).toBe("4.4");
    run(back, 24);

    // A panel-only cluster becomes a bare-metal panel host; a new save's empty basement cluster is dropped.
    const panelOnly = deserialize(serialize({ ...old, clusters: [{ ...old.clusters[0], platform: null }] } as unknown as GameState));
    expect(panelOnly.clusters.map((c) => [c.kind, c.nodes.map((n) => n.deviceId), c.vm])).toEqual([["panel", ["dev3"], null]]);
    expect(panelOnly.services.every((v) => serviceOnline(panelOnly, v.id))).toBe(true);
    const empty = deserialize(serialize({ ...old, clusters: [{ ...old.clusters[0], panel: null, platform: null }], workloads: [], services: [] } as unknown as GameState));
    expect(empty.clusters).toEqual([]);
  });
});
