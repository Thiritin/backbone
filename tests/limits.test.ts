import { describe, expect, it } from "vitest";
import { sizeSpec, type Resources } from "../src/sim/10-catalog/products";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { need, starvation, STRETCH_MAX, workloadUse } from "../src/sim/60-infra/usage";
import { productsTick, workloadPerf } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLimits } from "../src/sim/90-actions/limits";
import { setOversell } from "../src/sim/90-actions/oversell";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame } from "./fixtures";

const must = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function setup() {
  const s = readyGame(1);
  const cloud = s.clusters.find((c) => c.kind === "cloud")!.id, host = panelVm(s, cloud);
  const ada = addCustomer(s, "Ada Lang", "gamer"), bob = addCustomer(s, "Bob Ries", "gamer");
  // The 512 MB plan, so 70% of it stays above the smallest limit.
  const vps = (cus: string, label: string) => must(provisionService(s, cus, "vps", { label, clusterId: cloud, spec: sizeSpec("vps", 1, 2005) }));
  const web = (label: string) => must(provisionService(s, ada, "webHosting", { label, clusterId: host }));
  const svc = (id: string) => s.services.find((v) => v.id === id)!;
  const wl = (id: string) => workloadsOf(s, id)[0];
  const sold = (id: string): Resources => ({ vcpu: svc(id).spec.vcpu, ramGb: svc(id).spec.ramGb, diskGb: svc(id).spec.diskGb });
  return { s, cloud, host, ada, bob, vps, web, svc, wl, sold };
}

describe("setLimits", () => {
  it("rebooks a customer workload up and down and logs it", () => {
    const { s, ada, vps, wl, sold, svc } = setup();
    const id = vps(ada, "a.example");
    const big = { vcpu: sold(id).vcpu * 2, ramGb: sold(id).ramGb * 2, diskGb: sold(id).diskGb * 2 };
    expect(setLimits(s, id, big)).toEqual({ ok: true });
    expect(wl(id)).toMatchObject({ ...big, promised: undefined });
    const small = { vcpu: 0.5, ramGb: 0.5, diskGb: sold(id).diskGb };
    expect(setLimits(s, id, small).ok).toBe(true);
    expect(wl(id)).toMatchObject({ ...small, promised: sold(id) });
    expect(svc(id).spec.ramGb).toBe(sold(id).ramGb);
    expect(s.activity.at(-1)).toMatchObject({ serviceId: id, key: "activity.limits", params: { vcpu: 0.5, ram: 0.5, disk: small.diskGb }, minutes: 2 });
  });

  it("refuses unknown services, sizes below the floor, disks below the data, full nodes and the oversell cap", () => {
    const { s, ada, vps, web, wl, sold, host } = setup();
    const id = vps(ada, "a.example");
    expect(setLimits(s, "svc-none", sold(id))).toEqual({ ok: false, error: "error.unknownService" });
    expect(setLimits(s, id, { ...sold(id), ramGb: 0.2 })).toEqual({ ok: false, error: "error.vmSize" });
    expect(setLimits(s, id, { ...sold(id), vcpu: Number.NaN })).toEqual({ ok: false, error: "error.vmSize" });
    expect(setLimits(s, id, { ...sold(id), diskGb: 1 })).toEqual({ ok: false, error: "error.vmTooSmall" });
    expect(setLimits(s, id, { ...sold(id), diskGb: 1e6 })).toEqual({ ok: false, error: "error.nodeFull" });
    const site = web("b.example");
    expect(setLimits(s, site, { ...sold(site), diskGb: 1e6 })).toEqual({ ok: false, error: "error.nodeFull" });
    expect(setOversell(s, host, 0.01).ok).toBe(true);
    expect(setLimits(s, site, { ...sold(site), vcpu: sold(site).vcpu + 1 })).toEqual({ ok: false, error: "error.oversellCap" });
    expect(setLimits(s, site, { ...sold(site), ramGb: 0.5 }).ok).toBe(true);
    s.services = s.services.map((v) => (v.id === id ? { ...v, endedAt: s.hour } : v));
    expect(setLimits(s, id, sold(id))).toEqual({ ok: false, error: "error.unknownService" });
    expect(wl(id).ramGb).toBe(sold(id).ramGb);
  });
});

describe("use and starvation", () => {
  it("caps use at the limit and lets a limit above the sold size stretch the peaks", () => {
    const { s, ada, vps, wl, svc, sold } = setup();
    const id = vps(ada, "a.example");
    must(setLimits(s, id, { vcpu: 0.25, ramGb: 0.25, diskGb: sold(id).diskGb }));
    for (let h = 0; h < 48; h++) {
      const u = workloadUse(s, wl(id), s.hour + h), n = need(s, svc(id), wl(id), s.hour + h);
      expect(u.vcpu).toBeCloseTo(Math.min(0.25, n.vcpu), 9);
      expect(u.ramGb).toBeCloseTo(Math.min(0.25, n.ramGb), 9);
    }
    const base = need(s, svc(id), wl(id));
    must(setLimits(s, id, { vcpu: sold(id).vcpu * 4, ramGb: sold(id).ramGb * 4, diskGb: sold(id).diskGb }));
    const wide = need(s, svc(id), wl(id));
    expect(wide.ramGb).toBeCloseTo(base.ramGb * STRETCH_MAX, 9);
    expect(wide.ramGb).toBeGreaterThan(sold(id).ramGb * 0.6);
    expect(workloadUse(s, wl(id)).ramGb).toBeCloseTo(wide.ramGb, 9);
  });

  it("slows a starved VPS and marks it while its neighbour runs on", () => {
    const { s, ada, bob, vps, svc, wl, sold } = setup();
    const a = vps(ada, "a.example"), b = vps(bob, "b.example"), own = starvation(s, svc(b), wl(b));
    must(setLimits(s, a, { vcpu: 0.25, ramGb: 0.25, diskGb: sold(a).diskGb }));
    expect(starvation(s, svc(a), wl(a))).toBeGreaterThan(0.5);
    const before = s.customers.find((c) => c.id === ada)!.happiness;
    productsTick(s);
    expect(svc(a).starvedAt).toBe(s.hour);
    expect(svc(a).slowedAt).toBeUndefined();
    expect(s.customers.find((c) => c.id === ada)!.happiness).toBeLessThan(before);
    expect(starvation(s, svc(b), wl(b))).toBe(own);
    expect(svc(b).slowedAt).toBeUndefined();
    expect(workloadPerf(s, wl(b), "vps")).toBe(1);
    must(setLimits(s, a, { vcpu: sold(a).vcpu * 2, ramGb: sold(a).ramGb * 2, diskGb: sold(a).diskGb }));
    expect(starvation(s, svc(a), wl(a))).toBe(0);
  });

  it("never starves a VPS at the size it bought, and starves it at 70% of that", () => {
    const { s, ada, vps, svc, wl, sold } = setup();
    const id = vps(ada, "a.example"), start = s.hour;
    const hours = Array.from({ length: 168 }, (_, h) => start + h);
    const peak = hours.reduce((a, h) => (need(s, svc(id), wl(id), h).ramGb > need(s, svc(id), wl(id), a).ramGb ? h : a));
    expect(need(s, svc(id), wl(id), peak).ramGb).toBeGreaterThan(0.9 * sold(id).ramGb);
    for (const h of hours) expect(starvation(s, svc(id), wl(id), h)).toBe(0);
    s.hour = peak;
    productsTick(s);
    expect(svc(id).starvedAt).toBeUndefined();
    const s70 = { vcpu: sold(id).vcpu * 0.7, ramGb: sold(id).ramGb * 0.7, diskGb: sold(id).diskGb };
    must(setLimits(s, id, s70));
    expect(starvation(s, svc(id), wl(id))).toBeGreaterThan(0);
    productsTick(s);
    expect(svc(id).starvedAt).toBe(peak);
  });

  it("leaves a web space at 95% of its limit alone and slows it at 110% until the limit goes up", () => {
    const { s, web, svc, wl, sold } = setup();
    const id = web("c.example");
    s.services = s.services.map((v) => (v.id === id ? { ...v, spec: { ...v.spec, ramGb: 2 } } : v));
    const at = (ratio: number) => must(setLimits(s, id, { ...sold(id), ramGb: need(s, svc(id), wl(id)).ramGb / ratio }));
    at(0.95);
    expect(starvation(s, svc(id), wl(id))).toBe(0);
    at(1.1);
    expect(starvation(s, svc(id), wl(id))).toBeCloseTo(1 - 1 / 1.1, 6);
    productsTick(s);
    expect(svc(id).starvedAt).toBe(s.hour);
    must(setLimits(s, id, sold(id)));
    expect(starvation(s, svc(id), wl(id))).toBe(0);
  });

  it("loads an old save without starvedAt", () => {
    const { s, ada, vps, svc } = setup();
    const id = vps(ada, "a.example");
    const back = deserialize(serialize(s));
    expect(back.services.find((v) => v.id === id)!.starvedAt).toBeUndefined();
    expect(back.services.find((v) => v.id === id)!.spec).toEqual(svc(id).spec);
  });
});
