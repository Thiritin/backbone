import { describe, expect, it } from "vitest";
import { beancounters } from "../src/sim/60-infra/beancounters";
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
    expect(full.s.workloads.find((w) => w.id === full.ids[0])!.failcnt?.numproc).toBeGreaterThan(0);
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

  it("stops a container for an hour past 24 failcounts in a day and counts the streak of a small one", () => {
    const x = ovz([0.6, 0.6, 0.6]);
    tick(x.s);
    tick(x.s);
    expect(x.s.workloads.find((w) => w.id === x.ids[0])!.busyUntil).toBeGreaterThan(x.s.hour - 1);
    const small = ovz(Array(18).fill(0.1));
    for (let i = 0; i < 6; i++) tick(small.s);
    expect(small.s.workloads.find((w) => w.id === small.ids[0])!.failStreak).toBe(6);
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
