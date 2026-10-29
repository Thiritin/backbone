import { describe, expect, it } from "vitest";
import { cores, sizeSpec } from "../src/sim/10-catalog/products";
import { specFor } from "../src/sim/30-market/spec";
import { newGame } from "../src/sim/50-state";
import { nodeUsed } from "../src/sim/60-infra/cluster";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { hypervisor, withServer } from "./fixtures";

// A VPS of 0.8 vCPU and a DNS service of 0.05 vCPU on the basement server under the platform.
function onPlatform(platform: string) {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  hypervisor(s, ["dev3"], "Cloud", platform);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const vps = provisionService(s, cus, "vps", { label: "vps.example", spec: { ...sizeSpec("vps", 1, 2005), vcpu: 0.8 } });
  const dns = provisionService(s, cus, "dns", { label: "dns.example" });
  if (!vps.ok || !dns.ok) throw new Error("not placed");
  return nodeUsed(s, "dev3").vcpu;
}

describe("split cores", () => {
  it("books a fraction of a core on containers and whole vCPUs on full hypervisors", () => {
    expect(onPlatform("openveezee")).toBeCloseTo(0.85);
    expect(onPlatform("proxmocks")).toBeCloseTo(0.85);
    // The DNS service shares a guest and keeps its fraction.
    expect(onPlatform("vmwhere")).toBeCloseTo(1.05);
  });
  it("sells vCPUs in tenths below one core", () => {
    expect([cores(0.25), cores(0.04), cores(0.75), cores(1.4), cores(2.6)]).toEqual([0.3, 0.2, 0.8, 1, 3]);
    expect(specFor(1, 7, "vps", 0, 2005, 0.75).vcpu).toBeOneOf([0.8, 1.8]);
  });
});
