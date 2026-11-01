import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { importsFrom, softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { serviceOnline } from "../src/sim/40-support/status";
import { type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { CUTOVER_MINUTES, migrationHours } from "../src/sim/60-infra/migration";
import { hostPerf } from "../src/sim/60-infra/php";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { slowHost } from "../src/sim/80-business/website";
import { addNode, provisionService, setPlacement } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice, bootedMachine, newGame } from "./fixtures";
import { hire, queueMigration } from "../src/sim/90-actions/staff";
import { cleanUp } from "../src/sim/90-actions/security";
import { installSoftware, joinableServers } from "../src/sim/90-actions/software";
import { migrateWebspace, migrateWorkload, webspaceTargets } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: R) => (r.ok ? "ok" : r.error);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};

// Two bare-metal panel hosts on the basement's servers, a web space of 20 GB on the first.
function farm(first = "freepanel", second = "freepanel") {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const dev = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, dev, "rack2", 2));
  ok(connect(s, { device: dev, port: 0 }, { device: "dev4", port: 1 }));
  const a = panelServer(s, "dev3", first), b = panelServer(s, dev, second);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const web = ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: { ...sizeSpec("webHosting", 0, yearOf(s.hour)), diskGb: 20 }, clusterId: a }));
  const w = () => workloadsOf(s, web)[0];
  return { s, dev, a, b, cus, web, w };
}
const host = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

describe("software years", () => {
  it("refuses software before the year it exists and keeps what an old save has installed", () => {
    const s = withServer(newGame(1));
    expect(err(installSoftware(s, "dev3", "proxmocks"))).toBe("error.softwareNotYet");
    expect(err(installSoftware(s, "dev3", "openstash"))).toBe("error.softwareNotYet");
    skipTo(s, 2008);
    ok(installSoftware(s, bootedMachine(s, "dev3"), "proxmocks"));
    const early = withServer(newGame(1));
    early.cash = 10000;
    ok(installSoftware(early, bootedMachine(early, "dev3"), "vmwhere"));
    const old = withServer(newGame(1));
    hypervisor(old, ["dev3"], "Basement 1");
    const back = deserialize(serialize(old))!;
    expect(back.clusters[0]).toMatchObject({ platform: "proxmocks", switching: null });
    run(back, 24);
    expect(back.clusters[0].platform).toBe("proxmocks");
  });

  it("holds the brief's values for the panels", () => {
    const traits = (id: string) => { const { from, migration, cluster } = softwareById(id); return { from, ...migration, cluster }; };
    expect(traits("cpanic")).toEqual({ from: 2005, same: 2005, other: 2012, cluster: null });
    expect(traits("pleskit")).toEqual({ from: 2005, same: 2005, other: 2015, cluster: null });
    expect(traits("directadmen")).toEqual({ from: 2005, same: 2010, other: null, cluster: null });
    expect(traits("freepanel")).toEqual({ from: 2005, same: null, other: null, cluster: 2009 });
    expect(importsFrom(softwareById("cpanic"), "pleskit", 2011)).toBe(false);
    expect(importsFrom(softwareById("cpanic"), "pleskit", 2012)).toBe(true);
  });
});

describe("web space migration", () => {
  it("takes a base of 2 hours on the same panel and 4 on another, plus 3 minutes a GB, in quarter hours", () => {
    const same = farm("freepanel", "freepanel");
    expect(migrationHours(same.s, same.w(), host(same.s, same.b))).toBe(3);
    const other = farm("freepanel", "directadmen");
    expect(migrationHours(other.s, other.w(), host(other.s, other.b))).toBe(5);
    const big = farm();
    big.s.services = big.s.services.map((v) => (v.id === big.web ? { ...v, spec: { ...v.spec, diskGb: 100 } } : v));
    expect(migrationHours(big.s, big.w(), host(big.s, big.b))).toBe(7);
    big.s.services = big.s.services.map((v) => (v.id === big.web ? { ...v, spec: { ...v.spec, diskGb: 7 } } : v));
    expect(migrationHours(big.s, big.w(), host(big.s, big.b))).toBe(2.5);
  });

  it("halves the hours when the target panel has a tool for the source", () => {
    const same = farm("cpanic", "cpanic");
    expect(migrationHours(same.s, same.w(), host(same.s, same.b))).toBe(1.5);
    const mixed = farm("pleskit", "cpanic");
    expect(migrationHours(mixed.s, mixed.w(), host(mixed.s, mixed.b))).toBe(5);
    skipTo(mixed.s, 2012);
    expect(migrationHours(mixed.s, mixed.w(), host(mixed.s, mixed.b))).toBe(2.5);
    const none = farm("cpanic", "directadmen");
    skipTo(none.s, 2020);
    expect(migrationHours(none.s, none.w(), host(none.s, none.b))).toBe(5);
  });

  it("keeps the site up for the hours, then moves it with a ten minute cutover", () => {
    const { s, a, b, dev, web, w } = farm();
    const start = s.hour, cash = s.cash;
    expect(webspaceTargets(s, w().id)).toMatchObject([{ clusterId: b, hours: 3 }]);
    ok(migrateWebspace(s, w().id, b));
    expect(w().migrating).toEqual({ clusterId: b, doneAt: start + 3 });
    expect(err(migrateWebspace(s, w().id, b))).toBe("error.workloadBusy");
    expect(err(migrateWorkload(s, w().id, dev))).toBe("error.workloadBusy");
    while (w().clusterId === a) {
      expect(serviceOnline(s, web)).toBe(true);
      run(s, 1);
    }
    expect(s.hour).toBe(start + 3);
    expect(w()).toMatchObject({ clusterId: b, migrating: undefined });
    expect(w().busyUntil).toBeCloseTo(s.hour + CUTOVER_MINUTES / 60);
    expect(serviceOnline(s, web)).toBe(false);
    expect(s.downHours[web]).toBeCloseTo(CUTOVER_MINUTES / 60);
    run(s, 1);
    expect(serviceOnline(s, web)).toBe(true);
    expect(s.downHours[web]).toBeCloseTo(CUTOVER_MINUTES / 60);
    expect(s.cash).toBeCloseTo(cash, 0);
  });

  it("refuses the same host and hands a move to another host through migrateWorkload", () => {
    const { s, a, b, w, dev } = farm();
    expect(err(migrateWebspace(s, w().id, a))).toBe("error.sameHost");
    expect(err(migrateWebspace(s, "nope", b))).toBe("error.unknownWorkload");
    ok(migrateWorkload(s, w().id, dev));
    expect(w().migrating?.clusterId).toBe(b);
  });

  it("is a technician operation of the panels task", () => {
    const { s, a, b, w, web } = farm();
    expect(err(queueMigration(s, w().id, b))).toBe("error.noTechnician");
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const id = ok(hire(s, c.id));
    s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: ["panels"] } : e));
    s.hour = 48 + 9 - 1;
    ok(queueMigration(s, w().id, b));
    expect(err(queueMigration(s, w().id, b))).toBe("error.alreadyQueued");
    expect(s.techOps).toMatchObject([{ kind: "migrate", deviceId: "dev3", target: { workloadId: w().id, clusterId: b } }]);
    run(s, 1);
    expect(s.techOps).toEqual([]);
    expect(w().migrating?.clusterId).toBe(b);
    const events = run(s, 3);
    expect(w().clusterId).toBe(b);
    expect(events.some((e) => e.key === "event.migrated")).toBe(true);
    expect(workloadsOf(s, web)[0].clusterId).not.toBe(a);
  });

  it("survives a save in the middle of the move", () => {
    const { s, b, w } = farm();
    ok(migrateWebspace(s, w().id, b));
    const back = deserialize(serialize(s))!;
    expect(back.workloads.find((x) => x.id === w().id)!.migrating).toEqual(w().migrating);
    run(back, 4);
    expect(back.workloads.find((x) => x.id === w().id)!.clusterId).toBe(b);
  });
});

describe("clustered panels", () => {
  it("take a second server from the year the panel clusters and keep the sites up when one fails", () => {
    const { s, a, b, dev, cus } = farm();
    expect(err(addNode(s, a, dev))).toBe("error.panelHostOneServer");
    expect(joinableServers(s, a)).toEqual([]);
    skipTo(s, 2009);
    expect(joinableServers(s, a)).toEqual([dev]);
    expect(err(addNode(s, a, "dev4"))).toBe("error.noPanel");
    ok(addNode(s, a, dev));
    expect(host(s, a).nodes.map((n) => n.deviceId)).toEqual(["dev3", dev]);
    expect(s.clusters.some((c) => c.id === b)).toBe(false);
    ok(setPlacement(s, a, "spread"));
    const two = ok(provisionService(s, cus, "webHosting", { label: "lang.de", spec: sizeSpec("webHosting", 0, 2009), clusterId: a }));
    const sites = s.services.filter((v) => v.product === "webHosting").map((v) => v.id);
    expect(new Set(sites.flatMap((id) => workloadsOf(s, id).map((w) => w.deviceId)))).toEqual(new Set(["dev3", dev]));
    run(s, 2);
    expect(sites.every((id) => serviceOnline(s, id))).toBe(true);
    ok(setPower(s, "dev3", false));
    const events = run(s, 2);
    expect(sites.every((id) => serviceOnline(s, id))).toBe(true);
    expect(sites.flatMap((id) => workloadsOf(s, id).map((w) => w.deviceId))).toEqual([dev, dev]);
    expect(events.some((e) => e.key === "event.failedOver")).toBe(true);
    expect(two).toBeTruthy();
  });

  it("stay on one server for panels that never cluster", () => {
    const { s, a, dev } = farm("cpanic", "cpanic");
    skipTo(s, 2020);
    expect(err(addNode(s, a, dev))).toBe("error.panelHostOneServer");
    expect(joinableServers(s, a)).toEqual([]);
  });
});

describe("compromised hosts", () => {
  it("run their sites at 0.7 performance while hacked", () => {
    const { s, a, w } = farm();
    expect(hostPerf(s, host(s, a))).toBe(1);
    expect(slowHost(s, w(), host(s, a))).toBe(false);
    s.security = { ...s.security, hacked: [a] };
    expect(hostPerf(s, host(s, a))).toBe(0.7);
    expect(slowHost(s, w(), host(s, a))).toBe(true);
    ok(cleanUp(s, a));
    expect(hostPerf(s, host(s, a))).toBe(1);
  });
});
