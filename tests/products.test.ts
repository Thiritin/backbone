import { describe, expect, it } from "vitest";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { curveLoad, slowTolerance } from "../src/sim/10-catalog/usage";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { bookable, controlPlaneUp, lostDisk, workloadsOf } from "../src/sim/60-infra/cluster";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { howToFactor, licenseCost, SLOW_PENALTY } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { moveControlPlane, provisionService, setBackup, setHa } from "../src/sim/90-actions/clusters";
import { installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { hypervisor, panelVm, skipTo, withServer } from "./fixtures";
import { addCustomer } from "../src/sim/90-actions/customers";
import { resolveTicket } from "../src/sim/90-actions/support";
import { monthlyValue } from "../src/sim/40-support/tickets";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { mountDevice } from "./plugged";
import { migrateWorkload, restoreWorkload, startWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";

// A big 2005 game server, so two of them fill most of an 8 GB node.
const FRAG = { ...sizeSpec("gameServer", 0, 2005), vcpu: 2, ramGb: 4, diskGb: 10 };

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
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = server(s, 2, 1), third = server(s, 3, 2);
  const cluster = hypervisor(s, ["dev3", second], "Cloud 1", platform);
  const backup = hypervisor(s, [third], "Backup 1");
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  return { s, cluster, second, third, backup, cus };
}
const clusterById = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

describe("platforms and licenses", () => {
  it("bills each cluster's licenses at the start of the month by its pricing model", () => {
    const { s, cluster } = setup("vmwhere");
    // VMwhere is bought once until 2024, then two G1 nodes with 2 cores each at €8 per core.
    expect(licenseCost(s, clusterById(s, cluster))).toEqual({ panel: 0, platform: 0 });
    skipTo(s, 2024);
    expect(licenseCost(s, clusterById(s, cluster))).toEqual({ panel: 0, platform: 32 });
    s.hour += 743;
    tick(s);
    expect(s.ledger.filter((l) => l.key === "ledger.license")).toEqual([
      { hour: s.hour, category: "licenses", key: "ledger.license", params: { cluster: "Cloud 1", name: "VMwhere" }, amount: -32 },
    ]);
  });
  it("holds the installed RAM on every platform", () => {
    const a = setup("vmwhere"), b = setup("proxmocks");
    const dev = (x: typeof a) => x.s.devices.find((d) => d.id === x.second)!;
    expect(bookable(a.s, dev(a)).ramGb).toBe(8);
    expect(bookable(b.s, dev(b)).ramGb).toBe(8);
  });
  it("swaps a panel only once nothing it serves runs on it, busy for the new panel's install hours", () => {
    const { s, cluster, cus } = setup();
    const host = panelVm(s, cluster), spare = panelVm(s, cluster), box = clusterById(s, spare).vm!;
    const web = ok(provisionService(s, cus, "webHosting", { label: "Blog", clusterId: host }));
    const cash = s.cash;
    skipTo(s, 2010);
    expect(err(uninstallSoftware(s, clusterById(s, host).vm!))).toBe("error.softwareInUse");
    expect(err(uninstallSoftware(s, s.workloads.find((w) => w.id === box)!.deviceId!))).toBe("error.softwareInUse");
    ok(uninstallSoftware(s, box));
    expect(err(installSoftware(s, box, "hypervee"))).toBe("error.nestedHypervisor");
    const swapped = ok(installSoftware(s, box, "cpanic"));
    expect(s.cash).toBe(cash);
    expect(serviceOnline(s, web)).toBe(true);
    expect(controlPlaneUp(s, clusterById(s, swapped))).toBe(false);
    expect(err(installSoftware(s, box, "pleskit"))).toBe("error.portTaken");
    const events = Array.from({ length: softwareById("cpanic").installHours }, () => tick(s)).flat();
    expect(events).toContainEqual({ app: "Locations", key: "event.installed", params: { cluster: "Web 2", name: "cPanic" } });
    expect(clusterById(s, swapped).panel).toBe("cpanic");
  });
  it("scales the how-to ticket rate with the panel serving the customer", () => {
    const { s, cluster, cus } = setup();
    ok(provisionService(s, cus, "webHosting", { label: "Blog", clusterId: panelVm(s, cluster) }));
    expect(howToFactor(s, cus)).toBe(1.5);
    expect(howToFactor(s, "nobody")).toBe(1);
  });
});

describe("control planes", () => {
  it("reserves the control plane on the first node and refuses sales while its node is down", () => {
    const { s, cluster, second, cus } = setup();
    const c = clusterById(s, cluster);
    expect(c.controlPlane).toBe("dev3");
    expect(bookable(s, s.devices.find((d) => d.id === "dev3")!).ramGb).toBeCloseTo(8 - 0.25);
    ok(setPower(s, "dev3", false));
    expect(err(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }))).toBe("error.controlPlaneDown");
    ok(moveControlPlane(s, cluster, second));
    ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
  });
  it("fills platform, control plane and backup defaults into saves from before them", () => {
    const { s, cluster, cus } = setup();
    ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    const old = JSON.parse(serialize(s));
    for (const c of old.clusters) for (const k of ["kind", "vm", "php", "phpUntil", "ha", "panel", "platform", "controlPlane", "switching", "backup"]) delete c[k];
    for (const w of old.workloads) for (const k of ["stopped", "busyUntil", "backupAt"]) delete w[k];
    delete old.lossReports;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.clusters[0]).toMatchObject({ kind: "cloud", panel: null, platform: "proxmocks", controlPlane: "dev3", switching: null, backup: { targetId: null, every: "off" } });
    expect(loaded.clusters.find((c) => c.name === "Cloud 1 web")).toMatchObject({ kind: "panel", panel: "freepanel" });
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
  it("lets a backup customer shrug off a slowdown a game server customer feels", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `c${i}`);
    const game = ids.map((id) => slowTolerance(7, "gameServer", "gamer", id)), backup = ids.map((id) => slowTolerance(7, "storage", "private", id));
    expect(Math.max(...game)).toBeLessThan(0.08);
    expect(Math.min(...backup)).toBeGreaterThan(0.3);
    expect(new Set(game).size).toBe(50);
  });

  it("slows a node of game servers on Saturday night and opens slow tickets, but not on a Tuesday", () => {
    const { s, cluster } = setup();
    const gamer = addCustomer(s, "Kai Frag", "gamer");
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 1", spec: FRAG, clusterId: cluster, deviceId: "dev3" }));
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 2", spec: FRAG, clusterId: cluster, deviceId: "dev3" }));
    // Small RAM bookings keep the node within its memory, so only the CPU contends.
    s.workloads = s.workloads.map((w) => (w.vcpu === 2 ? { ...w, ramGb: 1 } : w));
    expect(nodeUsage(s, "dev3", TUE_10).perf).toBe(1);
    const sat = nodeUsage(s, "dev3", SAT_20);
    expect(sat.used.vcpu).toBeGreaterThan(sat.physical.vcpu);
    expect(sat.perf).toBeLessThan(0.6);
    const happiness = () => s.customers.find((c) => c.id === gamer)!.happiness;
    run(s, SAT_20);
    // An hour on the slowed node costs each customer on the node SLOW_PENALTY × the performance lost past their tolerance,
    // once per workload.
    const before = happiness(), tol = slowTolerance(s.seed, "gameServer", "gamer", gamer);
    run(s, 1);
    expect(before - happiness()).toBeCloseTo(2 * SLOW_PENALTY * (1 - nodeUsage(s, "dev3").perf - tol), 6);
    run(s, 2);
    run(s, 168);
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
    expect(s.lossReports).toMatchObject([{ deviceId: "dev3", hour: 10, items: [{ serviceId: vps, customerId: cus, backupAt: 2, restored: false }] }]);
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
  it("asks for a refund once per customer in Support without a backup, and pays it back once", () => {
    const { s, cluster, cus } = setup();
    const other = addCustomer(s, "Bo Byte", "private");
    const a = ok(provisionService(s, cus, "vps", { label: "Box", clusterId: cluster }));
    ok(provisionService(s, cus, "vps", { label: "Box 2", clusterId: cluster }));
    ok(provisionService(s, other, "vps", { label: "Site", clusterId: cluster }));
    lose(s, "dev3");
    expect(s.lossReports[0].items).toHaveLength(3);
    const asks = s.tickets.filter((t) => t.kind === "refund" && t.topic === "dataLoss");
    expect(asks.map((t) => t.customerId)).toEqual([cus, other]);
    // 70 less 60 per lost disk.
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBe(0);
    const monthly = monthlyValue(s.services, cus);
    ok(resolveTicket(s, asks[0].id, "refund"));
    expect(resolveTicket(s, asks[0].id, "refund").ok).toBe(false);
    run(s, 2);
    expect(s.ledger.filter((l) => l.key === "ledger.refund").map((l) => l.amount)).toEqual([-monthly]);
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
      s.unlocks = [...s.unlocks, "virtualization"];
      setHa(s, cluster, "live", true);
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
    hypervisor(s, [far], "Far 1");
    expect(err(migrateWorkload(s, workloadsOf(s, vps)[0].id, far))).toBe("error.noZoneLink");
  });
});

describe("no product or VM app", () => {
  it("names a hypervisor after its server and drops the removed apps from old saves", () => {
    const s = withServer(newGame(1));
    const id = hypervisor(s, ["dev3"]);
    expect(s.clusters.find((c) => c.id === id)!.name).toBe("fra1-srv-01");
    s.installed.push("Products", "Virtual machines");
    expect(deserialize(serialize(s)).installed).not.toContain("Products");
    expect(deserialize(serialize(s)).installed).not.toContain("Virtual machines");
  });
});
