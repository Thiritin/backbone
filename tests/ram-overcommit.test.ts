import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import type { GameState } from "../src/sim/50-state";
import { oomKilled } from "../src/sim/60-infra/cluster";
import { vmOomTick } from "../src/sim/60-infra/beancounters";
import { nodeUsage, ramShare, workloadUse } from "../src/sim/60-infra/usage";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { hypervisor, newGame, withServer } from "./fixtures";

const ok = <T>(r: { ok: boolean; id?: T }) => { expect(r.ok).toBe(true); return r.id as T; };
const SPEC = { ...sizeSpec("gameServer", 0, 2005), vcpu: 1, ramGb: 2, diskGb: 10 };

// A VMwhere node with three VMs, the first booked twice as large, scaled so the node uses `share` of its RAM.
function node(share: number): GameState {
  const s = { ...withServer(newGame(3)), cash: 100_000 };
  const c = hypervisor(s, ["dev3"], "VW", "vmwhere"), cus = addCustomer(s, "Kai Frag", "gamer");
  for (const label of ["Big", "A", "B"]) ok(provisionService(s, cus, "gameServer", { label, spec: label === "Big" ? { ...SPEC, ramGb: 4 } : SPEC, clusterId: c, deviceId: "dev3" }));
  const u = nodeUsage(s, "dev3"), wl = s.workloads.filter((w) => w.deviceId === "dev3").reduce((n, w) => n + workloadUse(s, w).ramGb, 0);
  const f = (share * u.physical.ramGb - (u.used.ramGb - wl)) / wl;
  s.workloads = s.workloads.map((w) => (w.deviceId === "dev3" ? { ...w, ramGb: w.ramGb * f } : w));
  expect(ramShare(nodeUsage(s, "dev3"))).toBeCloseTo(share, 6);
  return s;
}

describe("RAM overcommit on full VMs", () => {
  it("keeps every VM online at reduced performance at 105% of RAM", () => {
    const s = node(1.05);
    vmOomTick(s);
    for (const w of s.workloads.filter((x) => x.deviceId === "dev3")) {
      expect(oomKilled(w, s.hour)).toBe(false);
      expect(serviceOnline(s, w.serviceId)).toBe(true);
    }
    expect(nodeUsage(s, "dev3").perf).toBeCloseTo(0.8, 6);
  });

  it("OOM-kills only the largest VM at 120% of RAM", () => {
    const s = node(1.2);
    vmOomTick(s);
    const vms = s.workloads.filter((x) => x.deviceId === "dev3"), big = vms.reduce((a, w) => (w.ramGb > a.ramGb ? w : a));
    expect(vms.filter((w) => oomKilled(w, s.hour)).map((w) => w.id)).toEqual([big.id]);
    expect(serviceOnline(s, big.serviceId)).toBe(false);
    expect(s.downHours[big.serviceId]).toBe(1);
    for (const w of vms.filter((x) => x.id !== big.id)) expect(serviceOnline(s, w.serviceId)).toBe(true);
  });
});
