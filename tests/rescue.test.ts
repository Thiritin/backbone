import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, removeNode } from "../src/sim/90-actions/clusters";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { migrateWorkload, migrationTargets, RESCUE_HOURS, rescueTargets, rescueWorkload } from "../src/sim/90-actions/vms";
import { basement, buyDevice, hypervisor, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;

// The basement server in "Basement 1" with a VM, and a second server in its own cluster.
function setup() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const a = basement(s), b = hypervisor(s, [second]);
  const vm = ok(createVm(s, a, { vcpu: 1, ramGb: 1, diskGb: 20 }));
  return { s, b, second, vm };
}

describe("rescue", () => {
  it("recovers a VM off a switched-off server to another cluster by hand, after which the old server can leave", () => {
    const { s, b, second, vm } = setup();
    ok(setPower(s, "dev3", false));
    expect(migrationTargets(s, vm)).toEqual([]);
    expect(err(migrateWorkload(s, vm, second))).toBe("error.controlPlaneDown");
    const [t, ...rest] = rescueTargets(s, vm);
    expect([t.to, rest.length]).toEqual([second, 0]);
    ok(rescueWorkload(s, vm, second));
    const w = () => s.workloads.find((x) => x.id === vm)!;
    expect(w().busyUntil).toBe(s.hour + RESCUE_HOURS + t.down);
    while (s.hour < w().busyUntil) tick(s);
    expect([w().deviceId, w().clusterId, w().stopped]).toEqual([second, b, false]);
    expect(rescueTargets(s, vm)).toEqual([]);
    ok(removeNode(s, "dev3"));
  });

  it("refuses while the source server still runs", () => {
    const { s, second, vm } = setup();
    expect(rescueTargets(s, vm)).toEqual([]);
    expect(err(rescueWorkload(s, vm, second))).toBe("error.powerOffFirst");
  });
});
