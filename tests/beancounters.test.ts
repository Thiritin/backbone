import { describe, expect, it } from "vitest";
import { beancounters } from "../src/sim/60-infra/beancounters";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { addCustomer } from "../src/sim/90-actions/customers";
import { vmState } from "../src/ui/apps/products/parts";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { tick } from "../src/sim/88-tick/tick";
import { createVm } from "../src/sim/90-actions/clusters";
import { setBurst } from "../src/sim/90-actions/openveezee";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { skipTo } from "./fixtures";
import { err, ok, pmx } from "./pmx";

// One OpenVeeZee node with containers sized as shares of its RAM. A container with a service id but no customer idles at
// 60% of its RAM, so the shares add up to more than the node to make it run hot.
function ovz(shares: number[]) {
  const x = pmx(1);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openveezee" } : c));
  skipTo(x.s, 2009);
  const r = nodeUsage(x.s, "dev3").physical.ramGb;
  const ids = shares.map(() => ok(createVm(x.s, x.c, { vcpu: 1, ramGb: 1, diskGb: 10 })));
  ids.forEach((_, i) => x.s.services.push({ id: `svc${i}`, customerId: "none", startedAt: 0, endedAt: null, spec: { vcpu: 1, ramGb: 1, diskGb: 10 } } as never));
  x.s.workloads = x.s.workloads.map((w) => (ids.includes(w.id) ? { ...w, deviceId: "dev3", serviceId: `svc${ids.indexOf(w.id)}`, ramGb: shares[ids.indexOf(w.id)] * r } : w));
  return { ...x, ids, r, fail: (i = 0) => x.s.workloads.find((w) => w.id === ids[i])!.failcnt?.privvmpages ?? 0 };
}

describe("beancounters", () => {
  it("raises failcnt only while the node is past the contention line", () => {
    const calm = ovz([0.5, 0.5]);
    for (let i = 0; i < 4; i++) tick(calm.s);
    expect(calm.fail()).toBe(0);
    const full = ovz([1, 1]);
    for (let i = 0; i < 3; i++) tick(full.s);
    expect(full.fail()).toBeGreaterThan(0);
    expect(full.s.workloads.find((w) => w.id === full.ids[0])!.failcnt?.numproc ?? 0).toBe(0);
  });

  it("takes burst back first when the node runs hot", () => {
    const x = ovz([0.5, 0.5, 0.6]);
    ok(setBurst(x.s, x.ids[0], x.r * 0.3));
    for (let i = 0; i < 3; i++) tick(x.s);
    expect(x.fail(0)).toBeGreaterThan(0);
    expect(x.fail(1)).toBe(0);
  });

  it("raises more failcnt on an oversold node than on a balanced one", () => {
    const balanced = ovz([0.8, 0.8]), oversold = ovz([1, 1, 1]);
    for (let i = 0; i < 4; i++) { tick(balanced.s); tick(oversold.s); }
    expect(balanced.fail()).toBe(0);
    expect(oversold.fail()).toBeGreaterThan(balanced.fail());
  });

  it("OOM-kills only the largest container on a node out of RAM and counts the streak of a small one", () => {
    const x = ovz([0.4, 0.3, 0.3, 0.8]);
    tick(x.s);
    const big = x.s.workloads.find((w) => w.id === x.ids[3])!;
    expect(big.oomUntil).toBeGreaterThan(x.s.hour - 1);
    expect(x.ids.slice(0, 3).every((id) => !x.s.workloads.find((w) => w.id === id)!.oomUntil)).toBe(true);
    expect(vmState(x.s, big)).toBe("oom");
    expect(workloadOnline(x.s, big)).toBe(false);
    const small = ovz(Array(18).fill(0.1));
    for (let i = 0; i < 6; i++) tick(small.s);
    expect(small.s.workloads.find((w) => w.id === small.ids[17])!.failStreak).toBe(6);
  });

  it("keeps failcnt at zero on a node short of CPU with RAM to spare", () => {
    const x = ovz([0.55, 0.55]), cus = addCustomer(x.s, "Busy", "smallBiz");
    x.s.services = x.s.services.map((v) => (v.id.startsWith("svc") ? { ...v, customerId: cus } : v));
    x.s.heldServices = { ...x.s.heldServices, svc0: "manual", svc1: "manual" };
    const cores = nodeUsage(x.s, "dev3").physical.vcpu;
    x.s.workloads = x.s.workloads.map((w) => (x.ids.includes(w.id) ? { ...w, vcpu: cores * 40 } : w));
    const u = nodeUsage(x.s, "dev3");
    expect(u.used.vcpu).toBeGreaterThan(1.4 * u.physical.vcpu);
    expect(u.used.ramGb).toBeLessThan(0.9 * u.physical.ramGb);
    for (let i = 0; i < 24 * 7; i++) tick(x.s);
    for (const id of x.ids) {
      const w = x.s.workloads.find((y) => y.id === id)!;
      expect(w.failcnt ?? {}).toEqual({});
      expect(w.oomUntil).toBeUndefined();
    }
    expect((x.s.downHours.svc0 ?? 0) + (x.s.downHours.svc1 ?? 0)).toBe(0);
  });

  it("limits burst to twice the RAM and shows the rows", () => {
    const x = ovz([0.2]);
    expect(err(setBurst(x.s, x.ids[0], x.r))).toBe("error.badBurst");
    ok(setBurst(x.s, x.ids[0], x.r * 0.2));
    const rows = beancounters(x.s, x.s.workloads.find((w) => w.id === x.ids[0])!);
    const p = rows.find((r) => r.resource === "privvmpages")!;
    expect(p.limit).toBeGreaterThan(p.barrier);
  });

  it("loads an old save without the fields", () => {
    const x = ovz([0.2]);
    const raw = JSON.parse(serialize(x.s));
    for (const w of raw.workloads) { delete w.failcnt; delete w.burstGb; delete w.frozen; }
    expect(deserialize(JSON.stringify(raw))).toBeTruthy();
  });
});
