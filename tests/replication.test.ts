import { describe, expect, it } from "vitest";
import { nodeUsed, vmById } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, setHa } from "../src/sim/90-actions/clusters";
import { setPower } from "../src/sim/90-actions/hardware";
import { setReplication } from "../src/sim/90-actions/replication";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, ok, pmx, SMALL } from "./pmx";

// A VM pinned to dev3 with its replica on the second node.
function replicated(every: "15min" | "hourly" | "daily" = "hourly") {
  const x = pmx(3);
  const vm = ok(createVm(x.s, x.c, SMALL));
  x.s.workloads = x.s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: "dev3" } : w));
  ok(setReplication(x.s, vm, x.ids[1], every));
  return { ...x, vm };
}

describe("storage replication", () => {
  it("books the disk on the target node and refuses the VM's own node", () => {
    const { s, ids, vm } = replicated();
    expect(nodeUsed(s, ids[1]).diskGb).toBe(SMALL.diskGb);
    expect(err(setReplication(s, vm, "dev3"))).toBe("error.notNode");
    ok(setReplication(s, vm, null));
    expect(nodeUsed(s, ids[1]).diskGb).toBe(0);
  });

  it("copies on its interval and sets lastAt", () => {
    const hourly = replicated("hourly");
    expect(vmById(hourly.s, hourly.vm)!.replica!.lastAt).toBeNull();
    tick(hourly.s);
    expect(vmById(hourly.s, hourly.vm)!.replica!.lastAt).toBe(hourly.s.hour);
    const daily = replicated("daily");
    const seen: number[] = [];
    for (let i = 0; i < 50; i++) {
      tick(daily.s);
      const at = vmById(daily.s, daily.vm)!.replica!.lastAt;
      if (at !== null && !seen.includes(at)) seen.push(at);
    }
    expect(seen).toHaveLength(2);
    expect(seen[1] - seen[0]).toBe(24);
  });

  it("restarts a VM whose node lost its data from the replica, and not without one", () => {
    const a = replicated();
    ok(setHa(a.s, a.c, "failover", true));
    tick(a.s);
    tick(a.s);
    a.s.devices = a.s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: a.s.hour } : d));
    ok(setPower(a.s, "dev3", false));
    tick(a.s);
    const w = vmById(a.s, a.vm)!;
    expect([w.deviceId, w.replica]).toEqual([a.ids[1], null]);

    const b = replicated();
    ok(setHa(b.s, b.c, "failover", true));
    ok(setReplication(b.s, b.vm, null));
    tick(b.s);
    tick(b.s);
    b.s.devices = b.s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: b.s.hour } : d));
    ok(setPower(b.s, "dev3", false));
    tick(b.s);
    expect(vmById(b.s, b.vm)!.deviceId).toBe("dev3");
  });

  it("is refused before the year, and an old save has no replica", () => {
    const x = pmx(3);
    const vm = ok(createVm(x.s, x.c, SMALL));
    x.s.hour = 0;
    expect(err(setReplication(x.s, vm, x.ids[1]))).toBe("error.noReplication");
    const raw = JSON.parse(serialize(replicated().s));
    for (const w of raw.workloads) delete w.replica;
    expect(deserialize(JSON.stringify(raw))).toBeTruthy();
  });
});
