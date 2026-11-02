import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { runsHot } from "../src/sim/60-infra/ha";
import { workloadPerf } from "../src/sim/85-products/products";
import { addCustomer } from "../src/sim/90-actions/customers";
import { createVm, provisionService, resizeVm } from "../src/sim/90-actions/clusters";
import { deletePool, savePool, setPool } from "../src/sim/90-actions/vmwhere";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, withServer } from "./fixtures";

function setup(edition?: string) {
  const s: GameState = { ...withServer(newGame(7)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const id = hypervisor(s, ["dev3"], "VW", "vmwhere");
  if (edition) s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, licence: { tier: edition, trialUntil: null, lapsedAt: null } } : c));
  return { s, id };
}
const cl = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const pool = { name: "Web", vcpuLimit: 2, ramLimitGb: 4, shares: "normal" as const };

describe("resource pools", () => {
  it("a low pool slows on a hot node, a high pool does not", () => {
    const { s, id } = setup();
    const p = (shares: "low" | "high") => (savePool(s, id, { ...pool, name: shares, vcpuLimit: null, ramLimitGb: null, shares }) as { id: string }).id;
    const [low, high] = [p("low"), p("high")];
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    for (let i = 0; i < 40 && !runsHot(s, "dev3"); i++) {
      const r = provisionService(s, cus, "vps", { label: `V${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) });
      if (!r.ok) throw new Error(r.error);
    }
    expect(runsHot(s, "dev3")).toBe(true);
    const [a, b, c] = s.workloads.filter((w) => w.serviceId && w.deviceId === "dev3");
    s.workloads = s.workloads.map((w) => (w.id === a.id ? { ...w, poolId: low } : w.id === b.id ? { ...w, poolId: high } : w));
    const perf = (w: typeof a) => workloadPerf(s, s.workloads.find((x) => x.id === w.id)!, "vps");
    expect(perf(a)).toBeLessThanOrEqual(0.9);
    expect(perf(b)).toBe(1);
    expect(perf(c)).toBeGreaterThan(perf(a));
  });


  it("exist on Enterprise only", () => {
    const { s, id } = setup("standard");
    expect(savePool(s, id, pool)).toEqual({ ok: false, error: "error.needsEdition" });
  });

  it("refuse a VM that passes the limit on create and on resize", () => {
    const { s, id } = setup();
    const p = savePool(s, id, pool) as { ok: true; id: string };
    const a = createVm(s, id, { vcpu: 1, ramGb: 2, diskGb: 10 }, p.id) as { id: string };
    expect(a.id).toBeTruthy();
    expect(createVm(s, id, { vcpu: 1, ramGb: 3, diskGb: 10 }, p.id)).toEqual({ ok: false, error: "error.poolFull" });
    expect(createVm(s, id, { vcpu: 1, ramGb: 2, diskGb: 10 }, p.id).ok).toBe(true);
    expect(resizeVm(s, a.id, { vcpu: 1, ramGb: 3, diskGb: 10 })).toEqual({ ok: false, error: "error.poolFull" });
  });

  it("moves a VM in and out of a pool and frees its members when deleted", () => {
    const { s, id } = setup();
    const p = savePool(s, id, pool) as { ok: true; id: string };
    const vm = (createVm(s, id, { vcpu: 1, ramGb: 1, diskGb: 10 }) as { id: string }).id;
    expect(setPool(s, vm, p.id).ok).toBe(true);
    expect(s.workloads.find((w) => w.id === vm)!.poolId).toBe(p.id);
    expect(deletePool(s, id, p.id).ok).toBe(true);
    expect(s.workloads.find((w) => w.id === vm)!.poolId).toBeNull();
    expect(cl(s, id).pools).toEqual([]);
  });

  it("an old cluster without pools loads with none", () => {
    const { s, id } = setup();
    const old = { ...cl(s, id) } as Partial<ReturnType<typeof cl>>;
    delete old.pools;
    s.clusters = s.clusters.map((c) => (c.id === id ? (old as ReturnType<typeof cl>) : c));
    expect(cl(deserialize(serialize(s))!, id).pools).toEqual([]);
  });
});
