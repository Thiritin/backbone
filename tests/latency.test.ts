import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { cpuPerf, nodeUsage, timeoutTick } from "../src/sim/60-infra/usage";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { hypervisor, newGame, withServer } from "./fixtures";

describe("load to latency", () => {
  it("keeps full speed to 70% CPU, slows gently to 85% at 100%, then by the overload", () => {
    expect(cpuPerf(0.6)).toBe(1);
    expect(cpuPerf(0.9)).toBeGreaterThan(0.85);
    expect(cpuPerf(0.9)).toBeLessThan(1);
    expect(cpuPerf(1)).toBeCloseTo(0.85, 9);
    expect(cpuPerf(2)).toBeCloseTo(0.425, 9);
  });

  it("times out the sites of a node at 4× its cores for 2 hours and brings them back once it recovers", () => {
    const s = { ...withServer(newGame(4)), cash: 100_000 };
    const c = hypervisor(s, ["dev3"], "VW", "vmwhere"), cus = addCustomer(s, "Kai Frag", "gamer");
    const r = provisionService(s, cus, "gameServer", { label: "Big", spec: { ...sizeSpec("gameServer", 0, 2005), vcpu: 1, ramGb: 1, diskGb: 10 }, clusterId: c, deviceId: "dev3" });
    expect(r.ok).toBe(true);
    const w = s.workloads.find((x) => x.deviceId === "dev3" && x.serviceId)!;
    const cores = nodeUsage(s, "dev3").physical.vcpu, scale = (k: number) => { s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, vcpu: k } : x)); };
    scale(cores * 1000);
    const u = nodeUsage(s, "dev3");
    expect(u.used.vcpu / u.physical.vcpu).toBeGreaterThan(4);
    timeoutTick(s);
    expect(serviceOnline(s, w.serviceId)).toBe(true);
    timeoutTick(s);
    expect(serviceOnline(s, w.serviceId)).toBe(false);
    scale(1);
    timeoutTick(s);
    expect(serviceOnline(s, w.serviceId)).toBe(true);
  });
});
