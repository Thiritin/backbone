import { describe, expect, it } from "vitest";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { curveLoad } from "../src/sim/10-catalog/usage";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { bookable, controlPlaneUp, lostDisk, workloadsOf } from "../src/sim/60-infra/cluster";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { howToFactor, licenseCost } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { addNode, createCluster, moveControlPlane, provisionService, setBackup, setSoftware } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { buyDevice, connect, mountDevice, setPower } from "../src/sim/90-actions/hardware";
import { declineRefund, migrateWorkload, refundLoss, restoreWorkload, startWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  for (let h = 0; h < hours; h++) tick(s);
};
// Hour 0 is Saturday 1 January 2005, 00:00.
const SAT_20 = 20, TUE_10 = 3 * 24 + 10;

function server(s: GameState, slot: number, port: number) {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", slot));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
  return id;
}

// The basement with a second server, both in one cluster, and a third server in a backup cluster.
function setup(platform = "proxmocks") {
  const s = { ...newGame(1), cash: 100_000 };
  const second = server(s, 2, 1), third = server(s, 3, 2);
  const cluster = ok(createCluster(s, "loc1", "Cloud 1", "freepanel", platform));
  ok(addNode(s, cluster, "dev3"));
  ok(addNode(s, cluster, second));
  const backup = ok(createCluster(s, "loc1", "Backup 1"));
  ok(addNode(s, backup, third));
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  return { s, cluster, second, third, backup, cus };
}
const clusterById = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

describe("platforms and licenses", () => {
  it("bills each cluster's licenses at the start of the month by its pricing model", () => {
    const { s, cluster } = setup("vmwhere");
    // Two G1 nodes with 2 cores each at €8 per core.
    expect(licenseCost(s, clusterById(s, cluster))).toEqual({ panel: 0, platform: 32 });
    s.hour = 743;
    tick(s);
    expect(s.ledger.filter((l) => l.key === "ledger.license")).toEqual([
      { hour: 744, category: "licenses", key: "ledger.license", params: { cluster: "Cloud 1", name: "VMwhere" }, amount: -32 },
    ]);
  });
  it("gives a denser platform more bookable capacity", () => {
    const a = setup("vmwhere"), b = setup("proxmocks");
    const dev = (x: typeof a) => x.s.devices.find((d) => d.id === x.second)!;
    expect(bookable(a.s, dev(a)).ramGb).toBeCloseTo(12 * softwareById("vmwhere").density);
    expect(bookable(b.s, dev(b)).ramGb).toBe(12);
  });
  it("takes the panel's web spaces offline while switching, charges per workload and finishes with an event", () => {
    const { s, cluster, cus } = setup();
    const web = ok(provisionService(s, cus, "webHosting", { label: "Blog", clusterId: cluster }));
    const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    const cash = s.cash;
    ok(setSoftware(s, cluster, "cpanic"));
    expect(s.cash).toBe(cash - 10);
    expect([serviceOnline(s, web), serviceOnline(s, vps)]).toEqual([false, true]);
    expect(controlPlaneUp(s, clusterById(s, cluster))).toBe(false);
    expect(err(setSoftware(s, cluster, "pleskit"))).toBe("error.switching");
    const events = [tick(s)].flat();
    expect(events).toContainEqual({ app: "Products", key: "event.switched", params: { cluster: "Cloud 1", name: "cPanic" } });
    expect(clusterById(s, cluster).panel).toBe("cpanic");
    expect(serviceOnline(s, web)).toBe(true);
    expect(err(setSoftware(s, cluster, "cpanic"))).toBe("error.sameSoftware");
  });
  it("scales the how-to ticket rate with the panel serving the customer", () => {
    const { s, cluster, cus } = setup();
    ok(provisionService(s, cus, "webHosting", { label: "Blog", clusterId: cluster }));
    expect(howToFactor(s, cus)).toBe(1.5);
    expect(howToFactor(s, "nobody")).toBe(1);
  });
});

describe("control planes", () => {
  it("reserves the control plane on the first node and refuses sales while its node is down", () => {
    const { s, cluster, second, cus } = setup();
    const c = clusterById(s, cluster);
    expect(c.controlPlane).toBe("dev3");
    expect(bookable(s, s.devices.find((d) => d.id === "dev3")!).ramGb).toBeCloseTo(12 - 0.35);
    ok(setPower(s, "dev3", false));
    expect(err(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }))).toBe("error.controlPlaneDown");
    ok(moveControlPlane(s, cluster, second));
    ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
  });
  it("fills platform, control plane and backup defaults into saves from before them", () => {
    const { s, cluster, cus } = setup();
    ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    const old = JSON.parse(serialize(s));
    for (const c of old.clusters) for (const k of ["panel", "platform", "controlPlane", "switching", "backup"]) delete c[k];
    for (const w of old.workloads) for (const k of ["stopped", "busyUntil", "backupAt"]) delete w[k];
    delete old.lossReports;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.clusters[0]).toMatchObject({ panel: "freepanel", platform: "proxmocks", controlPlane: "dev3", switching: null, backup: { targetId: null, every: "off" } });
    expect(loaded.workloads[0]).toMatchObject({ stopped: false, busyUntil: 0, backupAt: null });
    expect(loaded.lossReports).toEqual([]);
  });
});

describe("usage curves and overcommit", () => {
  it("follows the curves: game servers peak on Saturday evenings, business sites on weekday mornings", () => {
    expect(curveLoad("game", SAT_20)).toBeCloseTo(0.96);
    expect(curveLoad("game", TUE_10)).toBeCloseTo(0.15);
    expect(curveLoad("business", TUE_10)).toBeCloseTo(0.6 - 0.1 / 3, 2);
    expect(curveLoad("business", SAT_20)).toBeCloseTo(0.1);
  });
  it("slows a node of game servers on Saturday night and opens slow tickets, but not on a Tuesday", () => {
    const { s, cluster } = setup();
    const gamer = addCustomer(s, "Kai Frag", "gamer");
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 1", clusterId: cluster }));
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 2", clusterId: cluster }));
    expect(nodeUsage(s, "dev3", TUE_10).perf).toBe(1);
    const sat = nodeUsage(s, "dev3", SAT_20);
    expect(sat.used.vcpu).toBeGreaterThan(sat.physical.vcpu);
    expect(sat.perf).toBeLessThan(0.6);
    const happy = s.customers.find((c) => c.id === gamer)!.happiness;
    run(s, 23);
    expect(s.customers.find((c) => c.id === gamer)!.happiness).toBeLessThan(happy);
    expect(s.tickets.filter((t) => t.topic === "slow").length).toBeGreaterThan(0);
  });
});

describe("backups and lost disks", () => {
  function lose(s: GameState, deviceId: string) {
    s.devices = s.devices.map((d) => (d.id === deviceId ? { ...d, dataLost: s.hour } : d));
    run(s, 1);
  }
  it("backs up nightly, reports a lost disk and restores it from the backup at a cost in happiness", () => {
    const { s, cluster, second, backup, cus } = setup();
    const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    expect(err(setBackup(s, cluster, cluster, "daily"))).toBe("error.backupTarget");
    ok(setBackup(s, cluster, backup, "daily"));
    run(s, 3);
    const w = workloadsOf(s, vps)[0];
    expect(w.backupAt).toBe(2);
    run(s, 7);
    lose(s, w.deviceId!);
    const before = s.customers.find((c) => c.id === cus)!.happiness;
    expect(lostDisk(s, workloadsOf(s, vps)[0])).toBe(true);
    expect(serviceOnline(s, vps)).toBe(false);
    expect(s.lossReports).toMatchObject([{ deviceId: "dev3", hour: 10, items: [{ serviceId: vps, customerId: cus, backupAt: 2, refund: "none", restored: false }] }]);
    expect(err(migrateWorkload(s, w.id, second))).toBe("error.lostDisk");
    ok(restoreWorkload(s, w.id));
    expect(s.lossReports[0].items[0].restored).toBe(true);
    // 15 for the restore and 8 more for the hours since the backup.
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBe(before - 23);
    expect(serviceOnline(s, vps)).toBe(false);
    run(s, 1);
    expect(serviceOnline(s, vps)).toBe(true);
    expect(err(restoreWorkload(s, w.id))).toBe("error.notLost");
  });
  it("asks for a refund without a backup: granting pays a month back, declining loses the customer", () => {
    const { s, cluster, cus } = setup();
    const other = addCustomer(s, "Bo Byte", "private");
    const a = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    const b = ok(provisionService(s, other, "vps", { label: "Site", clusterId: cluster }));
    lose(s, "dev3");
    const report = s.lossReports[0];
    expect(report.items.map((i) => [i.serviceId, i.refund])).toEqual([[a, "open"], [b, "open"]]);
    // 70 less 60 for the lost data, less the hour's outage.
    const hit = s.customers.find((c) => c.id === cus)!.happiness;
    expect(hit).toBeLessThanOrEqual(10);
    const cash = s.cash, monthly = Math.round(s.services.find((v) => v.id === a)!.price * 730 * 100) / 100;
    ok(refundLoss(s, report.id, a));
    expect(s.cash).toBeCloseTo(cash - monthly, 2);
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBe(hit + 20);
    expect(err(refundLoss(s, report.id, a))).toBe("error.refundSettled");
    ok(declineRefund(s, report.id, b));
    expect(s.customers.find((c) => c.id === other)!.churnedAt).toBe(s.hour);
    // Without a backup the workload starts again on an empty disk.
    ok(restoreWorkload(s, workloadsOf(s, a)[0].id));
    expect(serviceOnline(s, a)).toBe(true);
  });
});

describe("virtual machine actions", () => {
  it("stops and starts a VM", () => {
    const { s, cluster, cus } = setup();
    const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    const w = workloadsOf(s, vps)[0].id;
    ok(stopWorkload(s, w));
    expect(serviceOnline(s, vps)).toBe(false);
    expect(err(stopWorkload(s, w))).toBe("error.alreadyStopped");
    ok(startWorkload(s, w));
    expect(serviceOnline(s, vps)).toBe(true);
  });
  it("migrates live on a platform that supports it and cold with downtime on one that does not", () => {
    for (const [platform, down] of [["proxmocks", 0], ["hypervee", 1]] as const) {
      const { s, cluster, second, cus } = setup(platform);
      const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
      const w = workloadsOf(s, vps)[0];
      expect(err(migrateWorkload(s, w.id, w.deviceId!))).toBe("error.sameHost");
      ok(migrateWorkload(s, w.id, second));
      expect(workloadsOf(s, vps)[0]).toMatchObject({ deviceId: second, busyUntil: s.hour + down });
      expect(serviceOnline(s, vps)).toBe(down === 0);
    }
  });
  it("refuses a move to another zone without a link between the zones", () => {
    const { s, cluster, cus } = setup();
    const vps = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    // A second zone in the same city with its own cluster.
    s.locations = [...s.locations, { ...s.locations[0], id: "loc9", az: "fra9", name: "Elsewhere" }];
    s.racks = [...s.racks, { ...s.racks[0], id: "rack9", locationId: "loc9", name: "fra9-rack-01" }];
    const far = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc9"));
    ok(mountDevice(s, far, "rack9", 1));
    const remote = ok(createCluster(s, "loc9", "Far 1"));
    ok(addNode(s, remote, far));
    expect(err(migrateWorkload(s, workloadsOf(s, vps)[0].id, far))).toBe("error.noZoneLink");
  });
});
