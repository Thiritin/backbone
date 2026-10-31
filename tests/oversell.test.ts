import { describe, expect, it } from "vitest";
import { hostPerf } from "../src/sim/60-infra/php";
import { oversellRatio, OVERSELL_FLOOR, physicalOf } from "../src/sim/60-infra/oversell";
import { workloadPerf } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setOversell } from "../src/sim/90-actions/oversell";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame } from "./fixtures";

function setup() {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const host = () => s.clusters.find((c) => c.id === id)!;
  const add = (label: string) => provisionService(s, cus, "webHosting", { label, clusterId: id });
  return { s, id, host, add };
}

describe("oversell", () => {
  it("places freely without a cap", () => {
    const { s, host, add } = setup();
    for (let i = 0; i < 4; i++) expect(add(`a${i}.com`).ok).toBe(true);
    expect(oversellRatio(s, host()).cpu).toBeGreaterThan(0);
  });

  it("refuses a placement above the cap", () => {
    const { s, id, host, add } = setup();
    expect(add("a.com").ok).toBe(true);
    const cap = oversellRatio(s, host()).cpu;
    expect(setOversell(s, id, cap).ok).toBe(true);
    expect(add("b.com")).toEqual({ ok: false, error: "error.oversellCap" });
    expect(setOversell(s, id, null).ok).toBe(true);
    expect(add("b.com").ok).toBe(true);
    expect(setOversell(s, id, -1).ok).toBe(false);
  });

  it("slows from ratio 4 and floors at 0.85", () => {
    const { s, host, add } = setup();
    add("a.com"); const w = s.workloads.find((x) => x.clusterId === host().id)!;
    const phys = physicalOf(s, host()).vcpu;
    w.vcpu = phys * 4;
    expect(hostPerf(s, host())).toBe(1);
    w.vcpu = phys * 6;
    expect(hostPerf(s, host())).toBeCloseTo(0.92, 5);
    expect(workloadPerf(s, w, "webHosting")).toBeLessThan(1);
    w.vcpu = phys * 30;
    expect(hostPerf(s, host())).toBe(OVERSELL_FLOOR);
  });

  it("loads a save whose cluster has no cap", () => {
    const { s, host, add } = setup();
    expect(host().oversell).toBeUndefined();
    const t = deserialize(serialize(s));
    const c = t.clusters.find((x) => x.id === host().id)!;
    expect(c.oversell ?? null).toBeNull();
    expect(add("a.com").ok).toBe(true);
  });
});
