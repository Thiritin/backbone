import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterSummary, CPU_RATIO } from "../src/sim/60-infra/alarms";
import { controlPlanesOn, nodeCapacity } from "../src/sim/60-infra/cluster";
import { createVm } from "../src/sim/90-actions/clusters";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { basement, buyDevice, join, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };

// Two G1 servers in the hypervisor cluster "Basement 1", running nothing yet.
function twoNodes(): { s: GameState; cluster: string; nodes: string[] } {
  const s = { ...withServer(newGame(7)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const cluster = basement(s);
  join(s, cluster, second);
  return { s, cluster, nodes: ["dev3", second] };
}
const cap = (s: GameState, id: string) => nodeCapacity(s.devices.find((d) => d.id === id)!, s);
const keys = (s: GameState, c: string) => clusterSummary(s, c).alarms.map((a) => a.key);

describe("cluster alarms", () => {
  it("totals capacity, allocation and use over the hosts, with no alarm on an idle cluster", () => {
    const { s, cluster, nodes } = twoNodes();
    const vm = ok(createVm(s, cluster, { vcpu: 2, ramGb: 2, diskGb: 20 }));
    const sum = clusterSummary(s, cluster), cp = nodes.map((id) => controlPlanesOn(s, id).ramGb).reduce((a, b) => a + b);
    expect(sum.hosts.map((h) => h.deviceId)).toEqual(nodes);
    expect(sum.total.ramGb.capacity).toBe(cap(s, nodes[0]).ramGb + cap(s, nodes[1]).ramGb);
    // An empty own VM books its size and uses nothing; the control plane counts in both.
    expect(sum.total.ramGb.allocated).toBeCloseTo(2 + cp);
    expect(sum.total.ramGb.used).toBeCloseTo(cp);
    expect(sum.hosts.find((h) => h.deviceId === s.workloads.find((w) => w.id === vm)!.deviceId)!.vms).toBe(1);
    expect(sum.alarms).toEqual([]);
  });

  it("warns when a host books more memory than it has, and when the rest cannot take it over", () => {
    const { s, cluster } = twoNodes();
    const ram = cap(s, "dev3").ramGb + 4;
    const vm = ok(createVm(s, cluster, { vcpu: 1, ramGb: ram, diskGb: 20 }));
    const host = s.workloads.find((w) => w.id === vm)!.deviceId!;
    const sum = clusterSummary(s, cluster);
    const over = sum.alarms.find((a) => a.key === "alarm.memoryOverallocated")!;
    expect(over).toMatchObject({ severity: "warning", on: { kind: "host", id: host } });
    expect(Number(over.params.allocated)).toBeGreaterThan(Number(over.params.capacity));
    expect(sum.alarms.find((a) => a.key === "alarm.noFailover")).toMatchObject({ severity: "warning", on: { kind: "cluster", id: cluster } });
    expect(t(over.key, over.params)).toContain("GB memory allocated");
  });

  it("warns on vCPUs past the overcommit ratio and raises critical alarms for a stuck VM and a host down with VMs", () => {
    const { s, cluster } = twoNodes();
    const vm = ok(createVm(s, cluster, { vcpu: cap(s, "dev3").vcpu * CPU_RATIO + 2, ramGb: 1, diskGb: 10 }));
    expect(keys(s, cluster)).toContain("alarm.cpuOvercommitted");
    s.workloads = s.workloads.map((w) => (w.id === vm ? { ...w, stuck: true } : w));
    const host = s.workloads.find((w) => w.id === vm)!.deviceId!;
    ok(setPower(s, host, false));
    const sum = clusterSummary(s, cluster);
    expect(sum.alarms.slice(0, 2).map((a) => [a.severity, a.key]).sort()).toEqual([["critical", "alarm.hostDown"], ["critical", "alarm.vmStuck"]]);
    expect(sum.hosts.find((h) => h.deviceId === host)!.up).toBe(false);
    for (const a of sum.alarms) expect(t(a.key, a.params)).not.toBe(a.key);
  });
});
