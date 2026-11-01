import { describe, expect, it } from "vitest";
import { vmById } from "../src/sim/60-infra/cluster";
import { cephCapacity, cephCopies, cephReadOnly, cephRebalancing } from "../src/sim/60-infra/replica";
import { raidUsable } from "../src/sim/60-infra/status";
import { clusterSummary } from "../src/sim/60-infra/alarms";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, setHa } from "../src/sim/90-actions/clusters";
import { setPower } from "../src/sim/90-actions/hardware";
import { setCeph } from "../src/sim/90-actions/replication";
import { err, ok, pmx, SMALL } from "./pmx";

describe("ceph pool", () => {
  it("needs three nodes and holds the summed disk divided by the copies", () => {
    const two = pmx(2);
    expect(err(setCeph(two.s, two.c, true))).toBe("error.noCeph");
    const { s, c, ids } = pmx(3);
    ok(setCeph(s, c, true, 3));
    const cl = s.clusters.find((x) => x.id === c)!;
    const raw = ids.reduce((n, id) => n + raidUsable(s.devices.find((d) => d.id === id)!), 0);
    expect(cephCapacity(s, cl)).toBeCloseTo(raw / 3);
    ok(setCeph(s, c, true, 2));
    expect(cephCapacity(s, s.clusters.find((x) => x.id === c)!)).toBeCloseTo(raw / 2);
    expect(err(createVm(s, c, { ...SMALL, diskGb: raw }))).toBe("error.cephFull");
  });

  it("goes read-only at one copy and rebalances for hours after a node returns", () => {
    const { s, c, ids } = pmx(3);
    ok(setCeph(s, c, true, 3));
    ok(setPower(s, ids[1], false));
    expect(cephCopies(s, s.clusters.find((x) => x.id === c)!)).toBe(2);
    tick(s);
    expect(cephReadOnly(s, s.clusters.find((x) => x.id === c)!)).toBe(false);
    ok(setCeph(s, c, true, 2));
    expect(cephReadOnly(s, s.clusters.find((x) => x.id === c)!)).toBe(true);
    expect(err(createVm(s, c, SMALL))).toBe("error.cephReadOnly");
    ok(setPower(s, ids[1], true));
    s.hour += 1;
    tick(s);
    expect(cephRebalancing(s, s.clusters.find((x) => x.id === c)!)).toBe(true);
    expect(clusterSummary(s, c).alarms.some((a) => a.key === "alarm.cephRebalancing")).toBe(true);
    s.hour += 100;
    expect(cephRebalancing(s, s.clusters.find((x) => x.id === c)!)).toBe(false);
  });

  it("fails a VM over from a dead node without a replica", () => {
    const { s, c, ids } = pmx(3);
    ok(setHa(s, c, "failover", true));
    ok(setCeph(s, c, true, 3));
    const vm = ok(createVm(s, c, SMALL));
    s.workloads = s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: "dev3" } : w));
    s.hour += 2;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: s.hour } : d));
    ok(setPower(s, "dev3", false));
    tick(s);
    expect(ids).toContain(vmById(s, vm)!.deviceId);
    expect(vmById(s, vm)!.deviceId).not.toBe("dev3");
  });
});
