import { describe, expect, it } from "vitest";
import { vmById, workloadOnline } from "../src/sim/60-infra/cluster";
import { exposureFactor, FIREWALL_RISK, listens } from "../src/sim/60-infra/exposure";
import { workload } from "../src/sim/90-actions/clusters";
import { setPower } from "../src/sim/90-actions/hardware";
import { setFirewall } from "../src/sim/90-actions/firewall";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, ok, pmx } from "./pmx";
import { panelVm } from "./fixtures";

function host() {
  const x = pmx(2);
  const id = panelVm(x.s, x.c, "freepanel");
  const c = () => x.s.clusters.find((k) => k.id === id)!;
  const site = workload(x.s, "svc1", { clusterId: id, vcpu: 0.1, ramGb: 0.1, diskGb: 1 });
  x.s.workloads = [...x.s.workloads, site];
  return { ...x, id, c, site, vm: c().vm! };
}

describe("per-VM firewall", () => {
  it("leaves a host without a firewall unchanged", () => {
    const { s, c, site } = host();
    expect(exposureFactor(s, c())).toBe(1);
    expect(workloadOnline(s, site)).toBe(true);
  });

  it("halves the risk when a port the software does not serve is closed", () => {
    const { s, c, vm } = host();
    expect(listens(c())).toContain("ssh");
    ok(setFirewall(s, vm, { on: true, allow: ["web", "ssh"] }));
    expect(exposureFactor(s, c())).toBe(1);
    ok(setFirewall(s, vm, { on: true, allow: ["web"] }));
    expect(exposureFactor(s, c())).toBe(FIREWALL_RISK);
    ok(setFirewall(s, vm, { on: false, allow: [] }));
    expect(exposureFactor(s, c())).toBe(1);
  });

  it("takes the service offline when a port it serves is blocked", () => {
    const { s, site, vm } = host();
    ok(setFirewall(s, vm, { on: true, allow: ["ssh"] }));
    expect(workloadOnline(s, site)).toBe(false);
    ok(setFirewall(s, vm, { on: true, allow: ["web"] }));
    expect(workloadOnline(s, site)).toBe(true);
  });

  it("refuses other VMs and a read-only cluster, and an old save has none", () => {
    const { s, vm, ids } = host();
    expect(err(setFirewall(s, "nope", null))).toBe("error.notOwnVm");
    ok(setFirewall(s, vm, { on: true, allow: ["web"] }));
    const raw = JSON.parse(serialize(s));
    for (const w of raw.workloads) delete w.firewall;
    expect(vmById(deserialize(JSON.stringify(raw))!, vm)!.firewall ?? null).toBeNull();
    ok(setPower(s, ids[1], false));
    expect(err(setFirewall(s, vm, null))).toBe("error.noQuorum");
  });
});
