import { describe, expect, it } from "vitest";
import { vmById } from "../src/sim/60-infra/cluster";
import { backupFlows } from "../src/sim/60-infra/usage";
import { tick } from "../src/sim/88-tick/tick";
import { createVm } from "../src/sim/90-actions/clusters";
import { setPower } from "../src/sim/90-actions/hardware";
import { failoverReplica, setReplication } from "../src/sim/90-actions/replication";
import { skipTo, hypervisor } from "./fixtures";
import { err, ok, pmx, SMALL } from "./pmx";
import type { ReplicaEvery } from "../src/sim/60-infra/replica";

// A HyperVee cluster of two hosts with a VM on dev3 replicated to the second one.
function hv(every: ReplicaEvery = "5min") {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "hypervee" } : c));
  skipTo(x.s, 2012);
  const vm = ok(createVm(x.s, x.c, SMALL));
  x.s.workloads = x.s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: "dev3" } : w));
  ok(setReplication(x.s, vm, x.ids[1], every));
  return { ...x, vm };
}

describe("HyperVee replica", () => {
  it("offers its own frequencies and starts from 2012", () => {
    const { s, vm, ids } = hv();
    expect(err(setReplication(s, vm, ids[1], "hourly"))).toBe("error.noReplication");
    ok(setReplication(s, vm, ids[1], "30s"));
    s.hour = 0;
    expect(err(setReplication(s, vm, ids[1], "5min"))).toBe("error.noReplication");
  });

  it("sends more often at a shorter interval", () => {
    const mbps = (e: ReplicaEvery) => { const x = hv(e); return backupFlows(x.s).reduce((n, f) => n + f.mbps, 0); };
    expect(mbps("30s")).toBeCloseTo(mbps("15min") * 4, 6);
  });

  it("fails over to the replica after the host dies and loses the writes since the last copy", () => {
    const x = hv();
    tick(x.s);
    const copied = vmById(x.s, x.vm)!.replica!.lastAt;
    expect(copied).not.toBeNull();
    ok(setPower(x.s, "dev3", false));
    ok(failoverReplica(x.s, x.vm));
    const w = vmById(x.s, x.vm)!;
    expect([w.deviceId, w.replica]).toEqual([x.ids[1], null]);
    expect(err(failoverReplica(x.s, x.vm))).toBe("error.noReplica");
  });

  it("hands over without loss when the host is healthy and swaps the roles", () => {
    const x = hv();
    expect(err(failoverReplica(x.s, x.vm))).toBe("error.noReplica");
    tick(x.s);
    ok(failoverReplica(x.s, x.vm));
    const w = vmById(x.s, x.vm)!;
    expect([w.deviceId, w.replica?.toNode]).toEqual([x.ids[1], "dev3"]);
  });

  it("replicates to a standalone host of another HyperVee cluster in the zone", () => {
    const x = hv();
    const other = hypervisor(x.s, [x.spare], "HV2", "hypervee");
    ok(setReplication(x.s, x.vm, x.spare, "15min"));
    tick(x.s);
    ok(failoverReplica(x.s, x.vm));
    expect(vmById(x.s, x.vm)!.clusterId).toBe(other);
  });
});
