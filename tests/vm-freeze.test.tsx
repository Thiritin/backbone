import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { footprint, softwareById } from "../src/sim/10-catalog/platforms";
import { fqdn } from "../src/sim/30-customers/domains";
import type { GameState } from "../src/sim/50-state";
import { mailboxGb, timedOut } from "../src/sim/60-infra/cluster";
import { sample } from "../src/sim/60-infra/stats";
import { nodeUsage, shownNode, shownWorkload, TIMEOUT_PERF, timeoutTick, vmFrozen, vmPerf, WOBBLE, workloadUse } from "../src/sim/60-infra/usage";
import { resolve } from "../src/sim/80-business/browser";
import { createPanelVm, createVm, resizePanelVm } from "../src/sim/90-actions/clusters";
import { installSoftware } from "../src/sim/90-actions/software";
import { productOf } from "../src/ui/apps/browser/sites/software/SoftwareSite";
import { SITE_VIEWS } from "../src/ui/apps/browser/sites/software/registry";
import { bootedMachine, readyGame, skipTo } from "./fixtures";

const must = (r: { ok: boolean; id?: string; error?: string }): string => { if (!r.ok) throw new Error(r.error); return r.id!; };
const TINY = { vcpu: 1, ramGb: 1, diskGb: 60 };

// The starting game moved to 2020, with cPanic installed and running in a 1 vCPU, 1 GB VM.
function frozenLab() {
  const s: GameState = readyGame(1);
  s.cash = 100_000;
  skipTo(s, 2020);
  const cloud = s.clusters.find((c) => c.platform)!.id, vm = bootedMachine(s, must(createVm(s, cloud, TINY)));
  must(installSoftware(s, vm, "cpanic"));
  s.clusters = s.clusters.map((c) => (c.vm === vm ? { ...c, panel: "cpanic", switching: null } : c));
  return { s, vm: () => s.workloads.find((w) => w.id === vm)!, host: s.clusters.find((c) => c.vm === vm)!.id };
}

describe("undersized software", () => {
  it("installs into a VM smaller than the software needs and refuses only a disk too small to hold it", () => {
    const { s, vm } = frozenLab(), need = footprint(softwareById("cpanic"), yearOf(s.hour));
    expect(need.ramGb).toBeGreaterThan(TINY.ramGb);
    expect(vm()).toMatchObject(TINY);
    const cloud = s.clusters.find((c) => c.platform)!.id;
    expect(createPanelVm(s, cloud, "cpanic", TINY).ok).toBe(true);
    expect(createPanelVm(s, cloud, "cpanic", { vcpu: 8, ramGb: 16, diskGb: need.diskGb - 1 })).toEqual({ ok: false, error: "error.vmDisk" });
  });

  it("freezes an undersized VM at 100% with its console unreachable, and thaws it once resized bigger", () => {
    const { s, vm, host } = frozenLab(), url = fqdn(s, vm().hostname!);
    expect(vmFrozen(s, vm())).toBe(true);
    expect(shownWorkload(s, vm())).toMatchObject({ vcpu: 1, ramGb: 1 });
    expect(sample(s, vm())).toMatchObject({ cpu: 1, ram: 1 });
    expect(vmPerf(s, vm())).toBeLessThan(1);
    expect(resolve(s, url)).toMatchObject({ page: { kind: "console" }, load: "down" });
    timeoutTick(s); timeoutTick(s);
    expect(vmPerf(s, vm()) < TIMEOUT_PERF && timedOut(s, vm().id)).toBe(true);
    must(resizePanelVm(s, host, { vcpu: 8, ramGb: 16, diskGb: 60 }));
    expect(vmFrozen(s, vm())).toBe(false);
    expect(vmPerf(s, vm())).toBe(1);
    timeoutTick(s);
    expect(timedOut(s, vm().id)).toBe(false);
    expect(resolve(s, url).load).not.toBe("down");
    expect(shownWorkload(s, vm()).ramGb).toBeLessThan(16);
  });
});

describe("readout wobble", () => {
  it("wobbles node and VM readouts within WOBBLE of their use, the same on every read and never past capacity", () => {
    const s = readyGame(1), d = "dev3", vm = s.workloads.find((w) => !w.serviceId && s.clusters.some((c) => c.vm === w.id))!;
    const ratios: number[] = [];
    for (let h = s.hour; h < s.hour + 48; h++) {
      const raw = nodeUsage(s, d, h), seen = shownNode(s, d, h);
      expect(shownNode(s, d, h)).toEqual(seen);
      expect(seen.used.vcpu).toBeGreaterThanOrEqual(0);
      expect(seen.used.vcpu).toBeLessThanOrEqual(raw.physical.vcpu);
      expect(seen.used.ramGb).toBeLessThanOrEqual(raw.physical.ramGb);
      const u = workloadUse(s, vm, h), v = shownWorkload(s, vm, h);
      expect(v.vcpu).toBeLessThanOrEqual(vm.vcpu);
      if (u.vcpu > 0 && u.vcpu < vm.vcpu) ratios.push(v.vcpu / u.vcpu);
    }
    expect(ratios.length).toBeGreaterThan(10);
    for (const r of ratios) expect(Math.abs(r - 1)).toBeLessThanOrEqual(WOBBLE + 1e-9);
    expect(new Set(ratios.map((r) => r.toFixed(4))).size).toBeGreaterThan(5);
  });
});

describe("system requirements on the vendor sites", () => {
  it("lists the year's minimum on every software download page, with the disk per mailbox for a mail server", () => {
    const n = (x: number) => x.toLocaleString("en-GB", { maximumFractionDigits: 2 });
    for (const [id, View] of Object.entries(SITE_VIEWS)) {
      const p = productOf(id === "lunix" || id === "windoors" ? "os" : "software", id)!;
      if (!p.sw) continue;
      for (const year of [2005, 2020]) {
        const look = p.site.eras.filter((e) => e.from <= year).at(-1)?.look ?? p.site.eras[0].look;
        const html = renderToString(<View p={p} look={look} page="download" year={year} hour={0} go={() => {}} />), r = footprint(p.sw, year);
        expect(html, id).toContain("System requirements");
        for (const v of [`${n(r.vcpu)} vCPU`, `${n(r.ramGb)} GB`, `${n(r.diskGb)} GB`]) expect(html, `${id} ${year}`).toContain(v);
        expect(html.includes("Disk per mailbox"), id).toBe(p.sw.kind === "mail");
        if (p.sw.kind === "mail") expect(html).toContain(`${n(mailboxGb(year))} GB`);
      }
    }
  });

  it("shows a panel's requirements growing with the year", () => {
    const sw = softwareById("cpanic");
    expect(footprint(sw, 2020).ramGb).toBeGreaterThan(footprint(sw, 2005).ramGb);
  });
});
