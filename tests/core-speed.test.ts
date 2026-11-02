import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { CORE_SCORE, eraDemand } from "../src/sim/10-catalog/cpus";
import { GENERATIONS } from "../src/sim/10-catalog/economy";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { coreSpeed } from "../src/sim/60-infra/status";
import { need, nodeUsage, workloadUse } from "../src/sim/60-infra/usage";
import { workloadPerf } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { readyGame } from "./fixtures";

const must = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const at = (year: number) => hourOf(new Date(Date.UTC(year, 5, 3, 4)));

function setup() {
  const s = readyGame(1);
  const cloud = s.clusters.find((c) => c.kind === "cloud")!;
  const vps = (name: string, profile: Parameters<typeof addCustomer>[2]) => {
    const id = must(provisionService(s, addCustomer(s, name, profile), "vps", { label: `${name}.example`, clusterId: cloud.id, spec: sizeSpec("vps", 1, 2005) }));
    return workloadsOf(s, id)[0];
  };
  const node = s.devices.find((d) => d.id === cloud.nodes[0].deviceId)!;
  const cpu = node.components.find((c) => c.kind === "cpu")!;
  return { s, vps, node, cpu };
}

describe("core speed", () => {
  it("runs a brand new server at about one sold vCPU per core", () => {
    const { node } = setup();
    expect(coreSpeed(node, at(2005))).toBeGreaterThan(0.9);
    expect(coreSpeed(node, at(2005))).toBeLessThan(1.15);
    // The 2008 core is the biggest leap over its predecessor.
    GENERATIONS.forEach((g, i) => {
      expect(CORE_SCORE[i] / eraDemand(g.year)).toBeGreaterThanOrEqual(1);
      expect(CORE_SCORE[i] / eraDemand(g.year)).toBeLessThan(i === 1 ? 1.4 : 1.25);
    });
  });

  it("loads an old generation's node more than a new one with the same customers in the same year", () => {
    const { s, vps, node, cpu } = setup();
    vps("ada", "smallBiz");
    s.hour = at(2015);
    const old = nodeUsage(s, node.id).used.vcpu;
    cpu.gen = 5;
    expect(nodeUsage(s, node.id).used.vcpu).toBeLessThan(old);
  });

  it("gets busier as the years pass for the same work", () => {
    const { s, vps, node } = setup();
    const w = vps("ada", "smallBiz"), v = s.services.find((x) => x.id === w.serviceId)!;
    const share = (hour: number) => workloadUse(s, w, hour).vcpu / need(s, v, w, hour).vcpu;
    expect(share(at(2009))).toBeGreaterThan(share(at(2006)) * 1.5);
    expect(coreSpeed(node, at(2009))).toBeLessThan(coreSpeed(node, at(2006)));
  });

  it("slows a shop on an old idle node in a late year and leaves a backup customer alone", () => {
    const { s, vps, node } = setup();
    const shop = vps("shop", "onlineShop");
    s.hour = at(2020);
    expect(nodeUsage(s, node.id).perf).toBe(1);
    expect(workloadPerf(s, shop, "vps")).toBeLessThan(0.9);
    // Storage runs the backup curve, whose floor stays below a 2005 core in 2020.
    expect(workloadPerf(s, shop, "storage")).toBe(1);
  });
});
