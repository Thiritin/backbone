import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { setMachine, vmById } from "../src/sim/60-infra/cluster";
import { nodeUsage, workloadUse } from "../src/sim/60-infra/usage";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { bootedMachine, hypervisor, skipTo, withServer } from "./fixtures";

function server() {
  const s = withServer(newGame(5));
  skipTo(s, 2016);
  return s;
}

describe("load of a machine running only its OS", () => {
  it("idles low at the login, works most of a core while installing and drops to nothing when off", () => {
    const s = server(), d = s.devices.find((x) => x.id === "dev3")!;
    expect(nodeUsage(s, d.id).used.vcpu).toBe(0);
    bootedMachine(s, d.id, "lunix");
    const idle = nodeUsage(s, d.id).used;
    expect(idle.vcpu).toBeGreaterThan(0);
    expect(idle.vcpu).toBeLessThan(0.1);
    expect(idle.ramGb).toBeGreaterThan(0);
    setMachine(s, d.id, (m) => ({ software: [...m.software, { id: "lampstack", version: "1", installedAt: s.hour, doneAt: nowHours(s) + 2 }] }));
    expect(nodeUsage(s, d.id).used.vcpu).toBeGreaterThanOrEqual(0.6);
    d.on = false;
    expect(nodeUsage(s, d.id).used).toEqual({ vcpu: 0, ramGb: 0, diskGb: 0 });
  });

  it("gives an own VM at the login the same idle load", () => {
    const s = server(), c = hypervisor(s, ["dev3"]), made = createVm(s, c, PANEL_VM_SIZE), w = vmById(s, made.ok ? made.id! : "")!;
    expect(workloadUse(s, w).vcpu).toBe(0);
    bootedMachine(s, w.id, "lunix");
    const u = workloadUse(s, vmById(s, w.id)!);
    expect(u.vcpu).toBeGreaterThan(0);
    expect(u.ramGb).toBeGreaterThan(0);
  });
});
