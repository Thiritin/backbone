import { describe, expect, it } from "vitest";
import { vmById, workloadOnline } from "../src/sim/60-infra/cluster";
import { createVm } from "../src/sim/90-actions/clusters";
import { deleteSwitch, saveSwitch, setVmSwitch } from "../src/sim/90-actions/vswitch";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { platformKeys, skipTo } from "./fixtures";
import { err, ok, pmx, SMALL } from "./pmx";

function hv() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "hypervee" } : c));
  platformKeys(x.s, x.c);
  skipTo(x.s, 2012);
  const vm = ok(createVm(x.s, x.c, SMALL));
  x.s.workloads = x.s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: "dev3", busyUntil: 0 } : w));
  return { ...x, vm, up: () => workloadOnline(x.s, vmById(x.s, vm)!) };
}

describe("virtual switches", () => {
  it("keeps a VM online on the default switch", () => {
    expect(hv().up()).toBe(true);
  });

  it("takes a VM offline on a private or internal switch", () => {
    const x = hv();
    for (const type of ["private", "internal"] as const) {
      const id = ok(saveSwitch(x.s, x.c, null, type, type, null));
      ok(setVmSwitch(x.s, x.vm, id));
      expect(x.up()).toBe(false);
    }
    ok(setVmSwitch(x.s, x.vm, "default"));
    expect(x.up()).toBe(true);
  });

  it("takes a VM offline when an external switch is bound to an unplugged port", () => {
    const x = hv();
    const id = ok(saveSwitch(x.s, x.c, null, "Bound", "external", 0));
    ok(setVmSwitch(x.s, x.vm, id));
    expect(x.up()).toBe(true);
    const free = ok(saveSwitch(x.s, x.c, id, "Bound", "external", 1));
    expect(free).toBe(id);
    expect(x.up()).toBe(false);
  });

  it("returns the VMs of a deleted switch to the default and refuses the default", () => {
    const x = hv();
    const id = ok(saveSwitch(x.s, x.c, null, "Lab", "private", null));
    ok(setVmSwitch(x.s, x.vm, id));
    ok(deleteSwitch(x.s, x.c, id));
    expect(x.up()).toBe(true);
    expect(err(deleteSwitch(x.s, x.c, "default"))).toBe("error.noSwitch");
    expect(err(saveSwitch(x.s, x.c, null, " ", "private", null))).toBe("error.noSwitch");
  });

  it("loads an old save without switches", () => {
    const x = hv();
    ok(saveSwitch(x.s, x.c, null, "Lab", "private", null));
    const raw = JSON.parse(serialize(x.s));
    for (const c of raw.clusters) delete c.switches;
    for (const w of raw.workloads) delete w.switchId;
    expect(deserialize(JSON.stringify(raw))).toBeTruthy();
  });
});
