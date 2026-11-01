import { describe, expect, it } from "vitest";
import { buyAddresses } from "../src/sim/90-actions/addresses";
import { yearOf } from "../src/sim/00-core/time";
import { marketPrice, PRODUCTS, SIZES, sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { bumpProbe } from "../src/sim/40-support/tickets";
import { invoiceTotal, SLA_KEPT_HAPPINESS } from "../src/sim/45-billing/billing";
import { type GameState } from "../src/sim/50-state";
import { nodeCapacity, nodeUsed, vmOf, workloadsOf, workloadsOn } from "../src/sim/60-infra/cluster";
import { deviceHealth, freeSlots, installedCores, installedRamGb, installedVcpu, rackPower } from "../src/sim/60-infra/status";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addNode, cordon, createVm, drain, evacuate, installPanelInVm, resizeVm, placeService, provisionService, removeNode, setPlacement, uncordon } from "../src/sim/90-actions/clusters";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { addLocation, buyRack, connect, sellDevice, setPower, unmountDevice } from "../src/sim/90-actions/hardware";
import { buyDevice, freeFloor, newGame } from "./fixtures";
import { mountDevice } from "./plugged";
import { FRIEND_HAPPINESS } from "../src/sim/90-actions/start";
import { hypervisor, readyGame, skipTo, withServer } from "./fixtures";
import { installSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { mrr } from "../src/sim/metrics";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
const FEB_1 = 744;

// The basement with a second G1 server cabled to the switch and both servers in one cluster.
function twoNodes() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const cluster = hypervisor(s, ["dev3", second], "Web 1");
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  return { s, cluster, second, cus };
}

describe("product catalog", () => {
  it("prices sizes at the market reference for the year", () => {
    const web = (y: number) => marketPrice("webHosting", sizeSpec("webHosting", 1, y), y);
    expect(web(2005)).toBe(6);
    expect(web(2020)).toBeCloseTo(6, 0);
    // economy.md: 1 vCPU, 512 MB and 10 GB in 2005 come to 0.65 × the €30 GB rate, less the traffic below the middle size's.
    const vps = (y: number, sla?: "premium") => marketPrice("vps", sizeSpec("vps", 0, y), y, sla);
    expect(vps(2005)).toBeCloseTo(19.41, 2);
    // A small game server costs about €29 in 2005 and €12 in 2026.
    const game = (y: number) => marketPrice("gameServer", sizeSpec("gameServer", 0, y), y);
    expect(game(2005)).toBeCloseTo(29.25, 2);
    expect(game(2026)).toBeCloseTo(11.7, 2);
    expect(vps(2026)).toBeLessThan(vps(2005));
    expect(vps(2005, "premium")).toBeCloseTo(1.5 * vps(2005), 1);
    expect(marketPrice("ssl", sizeSpec("ssl", 0, 2010), 2010)).toBe(50);
    expect(marketPrice("ssl", sizeSpec("ssl", 0, 2016), 2016)).toBe(0);
  });
  it("gives every product a place to run, terms and at least one size", () => {
    for (const sizes of Object.values(SIZES)) expect(sizes.length).toBeGreaterThan(0);
    expect(PRODUCTS.dedicated.runsOn).toBe("server");
    expect(PRODUCTS.colocation.runsOn).toBe("rack");
    expect(PRODUCTS.domain).toMatchObject({ runsOn: "none", period: "year" });
    expect(sizeSpec("vps", 0, 2005)).toMatchObject({ vcpu: 1, ramGb: 0.5, diskGb: 10 });
    expect(sizeSpec("vps", 0, 2012).ramGb).toBeCloseTo(1);
  });
});

describe("starting company", () => {
  it("starts with three friends on web hosting in the basement cluster, online and paying €18 a month", () => {
    const s = readyGame(1);
    expect(s.customers.map((c) => [c.name, c.happiness, c.habit])).toEqual([
      ["Jonas Weber", FRIEND_HAPPINESS, "friend"], ["Mira Schulz", FRIEND_HAPPINESS, "friend"], ["Tobi Kraus", FRIEND_HAPPINESS, "friend"],
    ]);
    expect(s.clusters).toMatchObject([
      { name: "Basement 1", kind: "cloud", az: "fra1", nodes: [{ deviceId: "dev3", state: "active" }] }, { name: "Web 1", kind: "panel", nodes: [] },
    ]);
    expect(s.services.map((v) => vmOf(s, workloadsOf(s, v.id)[0])?.deviceId)).toEqual(["dev3", "dev3", "dev3"]);
    expect(s.services.every((v) => serviceOnline(s, v.id))).toBe(true);
    expect(mrr(s)).toBeCloseTo(18);
    expect(s.cash).toBe(withServer(newGame(1)).cash);
  });
  it("takes the friends offline and opens outage tickets when the switch loses power", () => {
    // A seed where a friend writes in once the outage is noticed.
    const s = readyGame(2);
    run(s, 2);
    ok(setPower(s, "dev4", false));
    // Private customers notice slowly (economy.md, Noticing outages): by two weeks one has written in.
    run(s, 336);
    expect(s.services.some((v) => serviceOnline(s, v.id))).toBe(false);
    const outages = s.tickets.filter((t) => t.kind === "outage");
    expect(outages.length).toBeGreaterThan(0);
    expect(outages.every((t) => s.services.some((v) => v.id === t.serviceId))).toBe(true);
    ok(setPower(s, "dev4", true));
    expect(deviceHealth(s, "dev4").state).toBe("booting");
    expect(s.services.some((v) => serviceOnline(s, v.id))).toBe(false);
    run(s, 1);
    expect(deviceHealth(s, "dev4").state).toBe("ok");
    expect(s.services.every((v) => serviceOnline(s, v.id))).toBe(true);
  });
  it("invoices the friends in February for the hours they were up", () => {
    const s = readyGame(1);
    run(s, 10);
    ok(setPower(s, "dev3", false));
    run(s, 4);
    ok(setPower(s, "dev3", true));
    run(s, FEB_1 - 14);
    const inv = s.invoices.filter((i) => i.issuedAt === FEB_1);
    expect(inv).toHaveLength(3);
    expect(inv[0].lines).toMatchObject([{ key: "invoice.line.hours", params: { hours: FEB_1 - 4 } }]);
    expect(invoiceTotal(inv[0])).toBeCloseTo(((FEB_1 - 4) * 6) / 730, 2);
    expect(s.downHours).toEqual({});
  });
});

describe("placement", () => {
  it("packs onto one node by default and spreads across nodes when set", () => {
    const { s, cluster, second, cus } = twoNodes();
    for (let i = 0; i < 4; i++) ok(provisionService(s, cus, "vps", { label: `pack ${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    expect(workloadsOn(s, "dev3")).toHaveLength(4);
    ok(setPlacement(s, cluster, "spread"));
    for (let i = 0; i < 4; i++) ok(provisionService(s, cus, "vps", { label: `spread ${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    expect(workloadsOn(s, second)).toHaveLength(4);
  });
  it("fills a node's installed RAM first and books past it when every node is full, recording nothing on a disk refusal", () => {
    const { s, cluster, second, cus } = twoNodes();
    expect(nodeCapacity(s.devices.find((d) => d.id === "dev3")!)).toEqual({ vcpu: 2.57, ramGb: 8, diskGb: 1000 });
    // Nodes within their installed 8 GB win: dev3 holds 3 VPS L of 2 GB next to its control plane, the second node 4.
    for (let i = 0; i < 7; i++) ok(provisionService(s, cus, "vps", { label: `big ${i}`, spec: sizeSpec("vps", 2, yearOf(s.hour)) }));
    expect([nodeUsed(s, "dev3").ramGb, nodeUsed(s, second).ramGb]).toEqual([6, 8]);
    // With none left, the idlest node takes the next one.
    ok(provisionService(s, cus, "vps", { label: "one more", spec: sizeSpec("vps", 2, yearOf(s.hour)) }));
    expect(nodeUsed(s, "dev3").ramGb).toBe(8);
    const onDev3 = (label: string) => provisionService(s, cus, "vps", { label, spec: sizeSpec("vps", 2, yearOf(s.hour)), clusterId: cluster, deviceId: "dev3" });
    ok(onDev3("chosen 1"));
    ok(onDev3("chosen 2"));
    expect(nodeUsed(s, "dev3").ramGb).toBe(12);
    // Disk is the one limit: a booking past 2 x the usable disk is refused and leaves nothing behind.
    const services = s.services.length, nextId = s.nextId;
    expect(err(provisionService(s, cus, "vps", { label: "huge", spec: { ...sizeSpec("vps", 2, yearOf(s.hour)), diskGb: 99999 } }))).toBe("error.noCapacity");
    expect([s.services.length, s.nextId]).toEqual([services, nextId]);
  });
  it("books CPU past the cores without a limit and slows the node while the CPU in use passes them", () => {
    const { s, cluster, cus } = twoNodes();
    for (let i = 0; i < 6; i++) ok(provisionService(s, cus, "vps", { label: `busy ${i}`, spec: sizeSpec("vps", 2, yearOf(s.hour)), clusterId: cluster, deviceId: "dev3" }));
    const cores = installedCores(s.devices.find((d) => d.id === "dev3")!);
    expect(nodeUsed(s, "dev3").vcpu).toBeGreaterThan(cores * 2);
    let perf = 1;
    for (let h = 0; h < 48; h++) { run(s, 1); perf = Math.min(perf, nodeUsage(s, "dev3").perf); }
    expect(perf).toBeLessThan(1);
  });
  it("skips cordoned and broken nodes and takes the zone of the cluster it lands in", () => {
    const { s, second, cus } = twoNodes();
    ok(cordon(s, "dev3"));
    const id = ok(provisionService(s, cus, "vps", { label: "ada.com", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    expect(workloadsOf(s, id)[0].deviceId).toBe(second);
    expect(s.services.find((v) => v.id === id)!.zone).toBe("fra1");
    ok(setPower(s, second, false));
    expect(err(provisionService(s, cus, "vps", { label: "two.com", spec: sizeSpec("vps", 0, yearOf(s.hour)) }))).toBe("error.noCapacity");
    ok(uncordon(s, "dev3"));
    ok(provisionService(s, cus, "vps", { label: "two.com", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    expect(err(provisionService(s, cus, "vps", { label: "far.com", spec: sizeSpec("vps", 0, yearOf(s.hour)), zone: "ams1" }))).toBe("error.noCapacity");
    expect(err(provisionService(s, cus, "cloud", { label: "cloud" }))).toBe("error.needsHaCluster");
  });
  it("places a plain contract once and leaves resold products unplaced", () => {
    const { s, cus } = twoNodes();
    const svc = addService(s, cus, "vps", "VPS", 0.01, "hour");
    ok(placeService(s, svc));
    expect(err(placeService(s, svc))).toBe("error.placed");
    const domain = ok(provisionService(s, cus, "domain", { label: "ada.com" }));
    expect(workloadsOf(s, domain)).toEqual([]);
    expect(s.services.find((v) => v.id === domain)).toMatchObject({ period: "year", price: 15, commitMonths: 12 });
  });
});

describe("nodes", () => {
  it("drains a node onto the others and puts it into maintenance", () => {
    const { s, second, cus } = twoNodes();
    for (let i = 0; i < 3; i++) ok(provisionService(s, cus, "vps", { label: `v${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    expect(err(removeNode(s, "dev3"))).toBe("error.nodeNotEmpty");
    expect(err(unmountDevice(s, "dev3"))).toBe("error.serverInUse");
    expect(err(sellDevice(s, "dev3"))).toBe("error.serverInUse");
    // Without live migration a drain leaves the VMs where they are; an evacuation moves them cold.
    ok(drain(s, "dev3"));
    expect(workloadsOn(s, "dev3")).toHaveLength(3);
    ok(evacuate(s, "dev3"));
    expect(workloadsOn(s, second)).toHaveLength(3);
    expect(s.clusters[0].nodes[0].state).toBe("maintenance");
    ok(removeNode(s, "dev3"));
    ok(unmountDevice(s, "dev3"));
  });
  it("cancels a drain with nowhere to go when the node is uncordoned", () => {
    const { s, second, cus } = twoNodes();
    ok(provisionService(s, cus, "vps", { label: "v0", spec: sizeSpec("vps", 0, yearOf(s.hour)), deviceId: "dev3" }));
    ok(cordon(s, second));
    ok(drain(s, "dev3"));
    run(s, 2);
    expect(s.clusters[0].nodes[0].state).toBe("draining");
    ok(uncordon(s, "dev3"));
    run(s, 2);
    expect(s.clusters[0].nodes[0].state).toBe("active");
    expect(workloadsOn(s, "dev3")).toHaveLength(1);
  });
  it("drains onto a node that has no RAM left instead of leaving workloads behind", () => {
    const { s, cluster, second, cus } = twoNodes();
    ok(cordon(s, second));
    // dev3 holds 5 VPS L next to the control plane when the player picks it.
    for (let i = 0; i < 5; i++) ok(provisionService(s, cus, "vps", { label: `v${i}`, spec: sizeSpec("vps", 2, yearOf(s.hour)), clusterId: cluster, deviceId: "dev3" }));
    ok(uncordon(s, second));
    for (let i = 0; i < 2; i++) ok(provisionService(s, cus, "vps", { label: `w${i}`, spec: sizeSpec("vps", 2, yearOf(s.hour)) }));
    s.clusters = s.clusters.map((c) => (c.id === cluster ? { ...c, ha: { ...c.ha, live: true } } : c));
    ok(drain(s, "dev3"));
    expect(workloadsOn(s, "dev3")).toHaveLength(0);
    expect(workloadsOn(s, second)).toHaveLength(7);
    expect(s.clusters.find((c) => c.id === cluster)!.nodes[0].state).toBe("maintenance");
    expect(nodeUsed(s, second).ramGb).toBeGreaterThan(installedRamGb(s.devices.find((d) => d.id === second)!));
  });
  it("only joins servers of the cluster's zone that run its hypervisor", () => {
    const { s, cluster, second } = twoNodes();
    expect(err(addNode(s, cluster, second))).toBe("error.alreadyNode");
    expect(err(addNode(s, cluster, "dev4"))).toBe("error.noHypervisor");
    const stored = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(err(addNode(s, cluster, stored))).toBe("error.noHypervisor");
    skipTo(s, 2010);
    expect(err(installSoftware(s, stored, "proxmocks"))).toBe("error.notMounted");
    expect(err(installSoftware(s, "dev4", "proxmocks"))).toBe("error.notServer");
  });
});

describe("outages and billing", () => {
  it("loses a workload's data with its node until it moves to a fresh one", () => {
    const { s, second, cus } = twoNodes();
    const id = ok(provisionService(s, cus, "vps", { label: "v", spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
    s.hour = 5;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: 5 } : d));
    expect(serviceOnline(s, id)).toBe(false);
    ok(evacuate(s, "dev3"));
    expect(workloadsOf(s, id)[0].deviceId).toBe(second);
    expect(serviceOnline(s, id)).toBe(true);
  });
  it("credits a business SLA missed by downtime and bills only the hours up", () => {
    const { s, cus } = twoNodes();
    const id = ok(provisionService(s, cus, "vps", { label: "shop", spec: sizeSpec("vps", 0, yearOf(s.hour)), sla: "business", price: 0.1 }));
    run(s, 1);
    ok(setPower(s, "dev4", false));
    run(s, 5);
    ok(setPower(s, "dev4", true));
    run(s, FEB_1 - 6);
    const inv = s.invoices.find((i) => i.customerId === cus)!;
    expect(inv.lines).toEqual([
      { serviceId: id, key: "invoice.line.hours", params: { label: "shop", hours: FEB_1 - 5 }, amount: (FEB_1 - 5) * 0.1 },
      { serviceId: id, key: "invoice.line.slaCredit", params: { label: "shop" }, amount: -Math.round((FEB_1 - 5) * 0.1 * 0.1 * 100) / 100 },
    ]);
  });
  it("rewards a month with every SLA kept, and not one with a missed SLA", () => {
    const deltas = (outage: number) => {
      const { s, cus } = twoNodes();
      ok(provisionService(s, cus, "vps", { label: "shop", spec: sizeSpec("vps", 0, yearOf(s.hour)), sla: "business", price: 0.1 }));
      run(s, 1);
      if (outage) { ok(setPower(s, "dev4", false)); run(s, outage); ok(setPower(s, "dev4", true)); }
      run(s, FEB_1 - 2 - outage);
      const seen: number[] = [];
      bumpProbe.fn = (c, d) => { if (c.id === cus) seen.push(d); };
      run(s, 1);
      bumpProbe.fn = null;
      return seen;
    };
    expect(deltas(0)).toContain(SLA_KEPT_HAPPINESS);
    expect(deltas(5)).not.toContain(SLA_KEPT_HAPPINESS);
  });
});

describe("dedicated and colocation", () => {
  it("rents a whole free server and keeps it out of clusters", () => {
    const { s, cus } = twoNodes();
    expect(err(provisionService(s, cus, "dedicated", { label: "ded" }))).toBe("error.noFreeServer");
    const third = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, third, "rack2", 3));
    ok(connect(s, { device: third, port: 0 }, { device: "dev4", port: 2 }));
    const id = ok(provisionService(s, cus, "dedicated", { label: "ded" }));
    expect(workloadsOf(s, id)).toMatchObject([{ deviceId: third, clusterId: null }]);
    expect(serviceOnline(s, id)).toBe(true);
    skipTo(s, 2010);
    expect(err(installSoftware(s, third, "proxmocks"))).toBe("error.serverInUse");
  });
  it("rents rack units with power in a datacenter rack, from the top", () => {
    const { s, cus } = twoNodes();
    expect(err(provisionService(s, cus, "colocation", { label: "colo", spec: sizeSpec("colocation", 1, yearOf(s.hour)) }))).toBe("error.noRackSpace");
    const loc = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
    const rack = ok(buyRack(s, loc, "rack-42", 1));
    expect(err(provisionService(s, cus, "colocation", { label: "colo", spec: sizeSpec("colocation", 1, yearOf(s.hour)) }))).toBe("error.noFreeAddress");
    ok(buyAddresses(s, loc, 4, 1));
    const id = ok(provisionService(s, cus, "colocation", { label: "colo", spec: sizeSpec("colocation", 1, yearOf(s.hour)) }));
    expect(s.ips.addresses.filter((a) => a.holder === id)).toHaveLength(1);
    expect(workloadsOf(s, id)).toMatchObject([{ rackId: rack, slot: 33, units: 10, watts: 1000 }]);
    expect(freeSlots(s, rack, 1)).not.toContain(33);
    expect(rackPower(s, rack).watts).toBe(1000);
    s.hour = s.locations.find((l) => l.id === loc)!.readyAt;
    expect(serviceOnline(s, id)).toBe(true);
  });
});

describe("saves", () => {
  it("keeps clusters and workloads, and loads an older save with its services unplaced and online", () => {
    const s = readyGame(3);
    const back = deserialize(serialize(s));
    expect([back.clusters, back.workloads]).toEqual([s.clusters, s.workloads]);
    const old = JSON.parse(serialize(s));
    for (const k of ["clusters", "workloads", "downHours"]) delete old[k];
    for (const v of old.services) { delete v.spec; delete v.sla; }
    const loaded = deserialize(JSON.stringify(old));
    expect([loaded.clusters, loaded.workloads, loaded.downHours]).toEqual([[], [], {}]);
    expect(loaded.services[0]).toMatchObject({ spec: sizeSpec("webHosting", 0, yearOf(s.services[0].startedAt)), sla: "basic" });
    expect(loaded.services.every((v) => serviceOnline(loaded, v.id))).toBe(true);
  });
});

describe("ballooning and resizing custom VMs", () => {
  const start = (platform: string, year = 2012) => {
    const s = withServer(newGame(1));
    skipTo(s, year);
    return { s, cluster: hypervisor(s, ["dev3"], "Cloud 1", platform) };
  };
  const dev3 = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
  const vmById = (s: GameState, id: string) => s.workloads.find((w) => w.id === id)!;
  const SMALL = { vcpu: 1, ramGb: 2, diskGb: 20 };

  it("holds the physical cores and RAM on every platform and books past them, balloon or not", () => {
    for (const [platform, year] of [["proxmocks", 2012], ["vmwhere", 2012], ["openstash", 2012], ["openveezee", 2012], ["hypervee", 2011]] as const) {
      const { s, cluster } = start(platform, year), d = dev3(s);
      expect(nodeCapacity(d), platform).toMatchObject({ ramGb: installedRamGb(d), vcpu: installedVcpu(d) });
      const big = { vcpu: installedCores(d) * 20, ramGb: installedRamGb(d) * 3, diskGb: 20 };
      expect(vmById(s, ok(createVm(s, cluster, big))).deviceId, platform).toBe("dev3");
      expect(nodeUsed(s, "dev3").ramGb, platform).toBeGreaterThan(installedRamGb(d));
    }
  });

  it("grows the RAM of a custom VM without downtime when the hypervisor balloons", () => {
    const { s, cluster } = start("proxmocks"), vm = ok(createVm(s, cluster, SMALL));
    ok(resizeVm(s, vm, { ...SMALL, ramGb: 4 }));
    expect(vmById(s, vm)).toMatchObject({ ramGb: 4, busyUntil: 0, stopped: false });
  });

  it("restarts a custom VM for any other resize, and for RAM growth without ballooning", () => {
    const { s, cluster } = start("proxmocks"), vm = ok(createVm(s, cluster, SMALL));
    ok(resizeVm(s, vm, { ...SMALL, vcpu: 2 }));
    expect(vmById(s, vm).busyUntil).toBeCloseTo(s.hour + 10 / 60);
    const plain = start("openstash"), id = ok(createVm(plain.s, plain.cluster, SMALL));
    ok(resizeVm(plain.s, id, { ...SMALL, ramGb: 4 }));
    expect(vmById(plain.s, id)).toMatchObject({ ramGb: 4, stopped: false });
    expect(vmById(plain.s, id).busyUntil).toBeCloseTo(plain.s.hour + 10 / 60);
  });

  it("refuses a size below the minimum, one past the node's disk, and a VM that runs software", () => {
    const { s, cluster } = start("openstash"), vm = ok(createVm(s, cluster, SMALL));
    expect(err(resizeVm(s, vm, { ...SMALL, vcpu: 0 }))).toBe("error.vmSize");
    expect(err(resizeVm(s, vm, { ...SMALL, diskGb: 999999 }))).toBe("error.nodeFull");
    ok(resizeVm(s, vm, { vcpu: 999, ramGb: 999, diskGb: 20 }));
    expect(err(resizeVm(s, "nope", SMALL))).toBe("error.notOwnVm");
    ok(installPanelInVm(s, vm, "freepanel"));
    expect(err(resizeVm(s, vm, { ...SMALL, ramGb: 3 }))).toBe("error.softwareInUse");
  });
});
