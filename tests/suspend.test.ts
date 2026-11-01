import { describe, expect, it } from "vitest";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { migrationDowntime } from "../src/sim/90-actions/vms";
import { createVm } from "../src/sim/90-actions/clusters";
import { freezeWorkload, thawWorkload } from "../src/sim/90-actions/openveezee";
import { skipTo } from "./fixtures";
import { err, ok, pmx } from "./pmx";

function ovz() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openveezee" } : c));
  skipTo(x.s, 2009);
  const id = ok(createVm(x.s, x.c, { vcpu: 1, ramGb: 2, diskGb: 40 }));
  x.s.workloads = x.s.workloads.map((w) => (w.id === id ? { ...w, deviceId: "dev3", busyUntil: 0 } : w));
  const w = () => x.s.workloads.find((v) => v.id === id)!;
  return { ...x, id, w };
}

describe("checkpoint and restore", () => {
  it("takes the container offline, keeps its booking and frees its load", () => {
    const x = ovz();
    const idle = nodeUsage(x.s, "dev3").used.ramGb;
    ok(freezeWorkload(x.s, x.id));
    expect(workloadOnline(x.s, x.w())).toBe(false);
    expect(nodeUsage(x.s, "dev3").used.ramGb).toBeLessThanOrEqual(idle);
    expect(x.w().ramGb).toBe(2);
    expect(err(freezeWorkload(x.s, x.id))).toBe("error.workloadBusy");
  });

  it("resumes without a boot and counts the minutes as downtime", () => {
    const x = ovz();
    ok(freezeWorkload(x.s, x.id));
    ok(thawWorkload(x.s, x.id));
    expect(x.w().frozen).toBe(false);
    expect(workloadOnline(x.s, x.w())).toBe(true);
    expect(err(thawWorkload(x.s, x.id))).toBe("error.unknownWorkload");
  });

  it("moves a container by checkpoint, so the downtime is shorter than a cold move elsewhere", () => {
    const x = ovz();
    const cold = (() => { x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "hypervee" } : c)); return migrationDowntime(x.s, x.w(), 1, false, x.ids[1]); })();
    x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openveezee" } : c));
    const chk = migrationDowntime(x.s, x.w(), 1, false, x.ids[1]);
    expect(chk).toBeLessThan(cold);
    expect(chk).toBeGreaterThan(0);
  });
});
