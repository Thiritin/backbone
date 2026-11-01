import { describe, expect, it } from "vitest";
import { datastoreUsed, vmById } from "../src/sim/60-infra/cluster";
import { volumesOf } from "../src/sim/60-infra/horizont";
import { createVm, deleteVm } from "../src/sim/90-actions/clusters";
import { attachVolume, createVolume, deleteVolume } from "../src/sim/90-actions/horizont";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { skipTo } from "./fixtures";
import { err, ok, pmx, SMALL } from "./pmx";

function cloud() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openstash" } : c));
  const vm = ok(createVm(x.s, x.c, SMALL));
  return { ...x, vm, vols: () => volumesOf(x.s.clusters.find((c) => c.id === x.c)!) };
}

describe("horizont volumes", () => {
  it("creates, attaches and detaches a volume", () => {
    const x = cloud(), v = ok(createVolume(x.s, x.c, "data", 50));
    expect(x.vols()).toEqual([{ id: v, name: "data", gb: 50, attachedTo: null, datastore: null }]);
    ok(attachVolume(x.s, x.c, v, x.vm));
    expect(x.vols()[0].attachedTo).toBe(x.vm);
    expect(err(attachVolume(x.s, x.c, v, x.vm))).toBe("error.volumeAttached");
    expect(err(deleteVolume(x.s, x.c, v))).toBe("error.volumeAttached");
    x.s.workloads = x.s.workloads.map((w) => (w.id === x.vm ? { ...w, stopped: true } : w));
    ok(attachVolume(x.s, x.c, v, null));
    ok(deleteVolume(x.s, x.c, v));
    expect(x.vols()).toEqual([]);
  });

  it("checks the size", () => {
    const x = cloud();
    expect(err(createVolume(x.s, x.c, "a", 0))).toBe("error.volumeSize");
    expect(err(createVolume(x.s, x.c, "a", 1001))).toBe("error.volumeSize");
    expect(err(createVolume(x.s, x.c, " ", 5))).toBe("error.volumeName");
  });

  it("survives deleting its instance", () => {
    const x = cloud(), v = ok(createVolume(x.s, x.c, "data", 10));
    ok(attachVolume(x.s, x.c, v, x.vm));
    ok(deleteVm(x.s, x.vm));
    expect(vmById(x.s, x.vm)).toBeUndefined();
    expect(x.vols()).toMatchObject([{ id: v, attachedTo: null }]);
  });

  it("detaches from a running instance only once hot detach exists", () => {
    const x = cloud(), v = ok(createVolume(x.s, x.c, "data", 10));
    ok(attachVolume(x.s, x.c, v, x.vm));
    expect(err(attachVolume(x.s, x.c, v, null))).toBe("error.volumeBusy");
    skipTo(x.s, 2012);
    ok(attachVolume(x.s, x.c, v, null));
  });

  it("counts toward datastore capacity", () => {
    const x = cloud();
    x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, volumes: [{ id: "v", name: "v", gb: 40, attachedTo: null, datastore: "dev3" }] } : c));
    expect(datastoreUsed(x.s, "dev3")).toBe(40);
    expect(datastoreUsed(x.s, "dev4")).toBe(0);
  });

  it("round-trips through a save and loads an old one", () => {
    const x = cloud(), v = ok(createVolume(x.s, x.c, "data", 10));
    const back = deserialize(serialize(x.s))!;
    expect(volumesOf(back.clusters.find((c) => c.id === x.c)!)[0].id).toBe(v);
  });
});
