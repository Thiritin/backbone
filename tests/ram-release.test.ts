import { describe, expect, it } from "vitest";
import type { OsImage } from "../src/sim/10-catalog/server-os";
import { bookable, nodeUsed } from "../src/sim/60-infra/cluster";
import { clusterSummary } from "../src/sim/60-infra/alarms";
import { createVm } from "../src/sim/90-actions/clusters";
import { createContainer, freezeWorkload, thawWorkload } from "../src/sim/90-actions/openveezee";
import { startWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { skipTo } from "./fixtures";
import { err, ok, pmx } from "./pmx";

// One node with two workloads each booking 70% of what it can book; a workload with a service but no customer idles at 60%.
function node(platform?: string) {
  const x = pmx(1);
  if (platform) x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform } : c));
  skipTo(x.s, 2009);
  const d = x.s.devices.find((v) => v.id === "dev3")!, r = bookable(x.s, d).ramGb;
  const ids = [0, 1].map(() => ok(createVm(x.s, x.c, { vcpu: 1, ramGb: 1, diskGb: 10 })));
  ids.forEach((_, i) => x.s.services.push({ id: `svc${i}`, customerId: "none", startedAt: 0, endedAt: null, spec: { vcpu: 1, ramGb: 1, diskGb: 10 } } as never));
  x.s.workloads = x.s.workloads.map((w) => (ids.includes(w.id) ? { ...w, deviceId: "dev3", serviceId: `svc${ids.indexOf(w.id)}`, ramGb: 0.7 * r } : w));
  return { ...x, ids, r, ram: () => nodeUsed(x.s, "dev3").ramGb };
}

describe("RAM a stopped workload releases", () => {
  it("a stopped VM holds no RAM and starts again only into free RAM", () => {
    const x = node();
    expect(x.ram()).toBeCloseTo(1.4 * x.r);
    ok(stopWorkload(x.s, x.ids[1]));
    expect(x.ram()).toBeCloseTo(0.7 * x.r);
    expect(clusterSummary(x.s, x.c).alarms.some((a) => a.key === "alarm.memoryOverallocated")).toBe(false);
    ok(stopWorkload(x.s, x.ids[0]));
    ok(startWorkload(x.s, x.ids[1]));
    expect(err(startWorkload(x.s, x.ids[0]))).toBe("error.noRamToStart");
  });

  it("an OpenVeeZee container holds the RAM it uses, and none while frozen or stopped", () => {
    const x = node("openveezee");
    expect(x.ram()).toBeLessThan(1.4 * x.r);
    expect(nodeUsed(x.s, "dev3", true).ramGb).toBeCloseTo(1.4 * x.r);
    ok(stopWorkload(x.s, x.ids[1]));
    ok(freezeWorkload(x.s, x.ids[0]));
    expect(x.ram()).toBe(0);
    ok(startWorkload(x.s, x.ids[1]));
    ok(thawWorkload(x.s, x.ids[0]));
  });

  it("an OpenVeeZee container refuses to start once the RAM in use is full", () => {
    const x = node("openveezee");
    x.s.workloads = x.s.workloads.map((w) => (w.id === x.ids[0] ? { ...w, ramGb: 1.5 * x.r } : w));
    ok(stopWorkload(x.s, x.ids[1]));
    expect(err(startWorkload(x.s, x.ids[1]))).toBe("error.noRamToStart");
  });

  it("creates a container from an OS template with its OS installed", () => {
    const x = node("openveezee"), tpl = "lunix@4.0" as OsImage;
    expect(err(createContainer(x.s, x.c, { vcpu: 1, ramGb: 1, diskGb: 10 }, tpl))).toBe("error.unknownOs");
    x.s.media = { ...x.s.media, images: [...x.s.media.images, tpl] };
    const id = ok(createContainer(x.s, x.c, { vcpu: 1, ramGb: 1, diskGb: 10 }, tpl));
    expect(x.s.workloads.find((w) => w.id === id)!.os).toMatchObject({ id: "lunix", version: "4.0" });
  });
});
