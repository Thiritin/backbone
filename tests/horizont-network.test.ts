import { describe, expect, it } from "vitest";
import { renumber } from "../src/sim/60-infra/addresses";
import { vmById, workloadOnline } from "../src/sim/60-infra/cluster";
import { exposureFactor, FIREWALL_RISK } from "../src/sim/60-infra/exposure";
import { groupsOf } from "../src/sim/60-infra/horizont";
import { workload, createVm, deleteVm } from "../src/sim/90-actions/clusters";
import { allocateFloatingIp, associateFloatingIp, deallocateFloatingIp, deleteGroup, saveGroup, setInstanceGroups } from "../src/sim/90-actions/horizont";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, skipTo } from "./fixtures";
import { err, ok, pmx, SMALL } from "./pmx";

function cloud() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openstash" } : c));
  x.s.locations[0] = { ...x.s.locations[0], dc: "hetzler-park" };
  return x;
}
const cl = (x: ReturnType<typeof cloud>) => x.s.clusters.find((c) => c.id === x.c)!;

describe("horizont floating IPs", () => {
  it("allocates a rented address, maps it to an instance and gives it back", () => {
    const x = cloud(), vm = ok(createVm(x.s, x.c, SMALL));
    const ip = ok(allocateFloatingIp(x.s, x.c));
    expect(x.s.ips.addresses.find((a) => a.ip === ip)).toMatchObject({ source: "provider", holder: null });
    ok(associateFloatingIp(x.s, x.c, ip, vm));
    expect(x.s.ips.addresses.find((a) => a.ip === ip)!.holder).toBe(vm);
    expect(cl(x).floating).toEqual([{ ip, workloadId: vm }]);
    ok(associateFloatingIp(x.s, x.c, ip, null));
    expect(x.s.ips.addresses.find((a) => a.ip === ip)!.holder).toBeNull();
    ok(deallocateFloatingIp(x.s, x.c, ip));
    expect(x.s.ips.addresses.some((a) => a.ip === ip)).toBe(false);
    expect(err(associateFloatingIp(x.s, x.c, ip, null))).toBe("error.unknownAddress");
  });

  it("refuses a basement and a cluster that is not OpenStash", () => {
    const x = cloud();
    x.s.locations[0] = { ...x.s.locations[0], dc: null };
    expect(err(allocateFloatingIp(x.s, x.c))).toBe("error.addressesFromLine");
    x.s.clusters = x.s.clusters.map((c) => ({ ...c, platform: "proxmocks" }));
    expect(err(allocateFloatingIp(x.s, x.c))).toBe("error.unknownCluster");
  });

  it("keeps a floating address when its service moves, and renumbers a plain one", () => {
    const x = cloud(), ip = ok(allocateFloatingIp(x.s, x.c)), from = x.s.locations[0];
    const to = { ...from, id: "loc2", az: "fra2" };
    x.s.locations = [...x.s.locations, to];
    x.s.ips = { ...x.s.ips, addresses: x.s.ips.addresses.map((a) => (a.ip === ip ? { ...a, holder: "svc9" } : a)) };
    x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, floating: [{ ip, workloadId: null }] } : c));
    const plain = { ...x.s.ips.addresses[0], id: "plain", ip: "1.2.3.4", holder: "svc9", source: "provider" as const };
    x.s.ips = { ...x.s.ips, addresses: [...x.s.ips.addresses, plain] };
    renumber(x.s, ["svc9"], from, to, () => true);
    expect(x.s.ips.addresses.find((a) => a.ip === ip)).toMatchObject({ holder: "svc9", locationId: "loc2" });
    expect(x.s.ips.addresses.some((a) => a.ip === "1.2.3.4")).toBe(false);
  });

  it("keeps the allocation when the instance is deleted", () => {
    const x = cloud(), vm = ok(createVm(x.s, x.c, SMALL)), ip = ok(allocateFloatingIp(x.s, x.c));
    ok(associateFloatingIp(x.s, x.c, ip, vm));
    ok(deleteVm(x.s, vm));
    expect(cl(x).floating).toEqual([{ ip, workloadId: null }]);
    expect(x.s.ips.addresses.find((a) => a.ip === ip)!.holder).toBeNull();
  });
});

describe("horizont security groups", () => {
  function host() {
    const x = cloud();
    skipTo(x.s, 2010);
    const id = panelVm(x.s, x.c, "freepanel"), c = () => x.s.clusters.find((k) => k.id === id)!;
    const site = workload(x.s, "svc1", { clusterId: id, vcpu: 0.1, ramGb: 0.1, diskGb: 1 });
    x.s.workloads = [...x.s.workloads, site];
    return { ...x, id, h: c, site, vm: c().vm! };
  }

  it("gives a new instance the default group", () => {
    const x = cloud(), vm = ok(createVm(x.s, x.c, SMALL));
    expect(vmById(x.s, vm)!.groupIds).toEqual(["default"]);
    expect(groupsOf(cl(x))).toEqual([{ id: "default", name: "default", allow: ["ssh"] }]);
  });

  it("takes the service offline until a group lets its port through", () => {
    const { s, h, site, vm, ...x } = host();
    expect(vmById(s, vm)!.groupIds).toEqual(["default"]);
    expect(workloadOnline(s, site)).toBe(false);
    const g = ok(saveGroup(s, x.c, null, "web", ["web"]));
    ok(setInstanceGroups(s, vm, ["default", g]));
    expect(workloadOnline(s, site)).toBe(true);
    expect(exposureFactor(s, h())).toBe(1);
    ok(setInstanceGroups(s, vm, [g]));
    expect(exposureFactor(s, h())).toBe(FIREWALL_RISK);
  });

  it("refuses unknown groups, a used group and deleting the default", () => {
    const { s, vm, ...x } = host();
    const g = ok(saveGroup(s, x.c, null, "web", ["web"]));
    expect(err(setInstanceGroups(s, vm, ["nope"]))).toBe("error.unknownGroup");
    ok(setInstanceGroups(s, vm, [g]));
    expect(err(deleteGroup(s, x.c, g))).toBe("error.groupInUse");
    expect(err(deleteGroup(s, x.c, "default"))).toBe("error.defaultGroup");
    ok(setInstanceGroups(s, vm, ["default"]));
    ok(deleteGroup(s, x.c, g));
  });

  it("loads an old save with no groups", () => {
    const x = cloud(), raw = JSON.parse(serialize(x.s));
    for (const c of raw.clusters) { delete c.groups; delete c.floating; delete c.volumes; }
    const back = deserialize(JSON.stringify(raw))!;
    expect(groupsOf(back.clusters.find((c) => c.id === x.c)!)).toHaveLength(1);
  });
});
