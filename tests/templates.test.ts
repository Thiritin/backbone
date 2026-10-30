import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { hostsOfVm, vmById } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, setHa } from "../src/sim/90-actions/clusters";
import { attachDatastore } from "../src/sim/90-actions/datastores";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { cloneTemplate, makeTemplate, makeVm } from "../src/sim/90-actions/templates";
import { migrateWorkload, startWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, join, panelVm, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const SMALL = { vcpu: 1, ramGb: 1, diskGb: 20 };

// A two-node VMwhere cluster with failover on, next to a Storage 2U that can become a datastore.
function setup(platform = "vmwhere"): { s: GameState; c: string; second: string; store: string } {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const store = ok(buyDevice(s, "g1-storage", "Dwell", 1, "loc1"));
  ok(mountDevice(s, store, "rack2", 4));
  const c = hypervisor(s, ["dev3"], "VM 1", platform);
  join(s, c, second);
  ok(setHa(s, c, "failover", true));
  return { s, c, second, store };
}
const template = (s: GameState, c: string, size = SMALL): string => {
  const id = ok(createVm(s, c, size));
  ok(stopWorkload(s, id));
  ok(makeTemplate(s, id));
  return id;
};

describe("templates", () => {
  it("only turns stopped own VMs on VMwhere into templates", () => {
    const { s, c } = setup();
    const vm = ok(createVm(s, c, SMALL));
    expect(err(makeTemplate(s, vm))).toBe("error.notStopped");
    ok(stopWorkload(s, vm));
    ok(makeTemplate(s, vm));
    expect(vmById(s, vm)!.template).toBe(true);
    expect(err(makeTemplate(s, vm))).toBe("error.isTemplate");
    const other = setup("proxmocks");
    const pvm = ok(createVm(other.s, other.c, SMALL));
    ok(stopWorkload(other.s, pvm));
    expect(err(makeTemplate(other.s, pvm))).toBe("error.noTemplates");
  });

  it("refuses a template while web spaces run inside the VM", () => {
    const { s, c } = setup();
    const host = panelVm(s, c);
    const vm = s.clusters.find((x) => x.id === host)!.vm!;
    s.workloads = [...s.workloads, { ...vmById(s, vm)!, id: "inside", serviceId: "svc", clusterId: host, deviceId: null }];
    ok(stopWorkload(s, vm));
    expect(err(makeTemplate(s, vm))).toBe("error.softwareInUse");
  });

  it("never starts or migrates a template, and makeVm turns it back into a stopped VM", () => {
    const { s, c, second } = setup();
    const t = template(s, c);
    expect(err(startWorkload(s, t))).toBe("error.isTemplate");
    expect(err(migrateWorkload(s, t, vmById(s, t)!.deviceId === "dev3" ? second : "dev3"))).toBe("error.isTemplate");
    ok(makeVm(s, t));
    expect(vmById(s, t)).toMatchObject({ template: undefined, stopped: true });
    expect(err(makeVm(s, t))).toBe("error.notTemplate");
    ok(startWorkload(s, t));
  });

  it("clones a running VM with the template's size, OS and software, its panel running once the copy is done", () => {
    const { s, c } = setup();
    const host = panelVm(s, c);
    const vm = s.clusters.find((x) => x.id === host)!.vm!;
    s.hour += 24;
    ok(stopWorkload(s, vm));
    ok(makeTemplate(s, vm));
    const t = vmById(s, vm)!, count = s.workloads.length;
    const id = ok(cloneTemplate(s, vm));
    const clone = vmById(s, id)!;
    expect(s.workloads).toHaveLength(count + 1);
    expect(clone).toMatchObject({ vcpu: t.vcpu, ramGb: t.ramGb, diskGb: t.diskGb, stopped: false, cloning: clone.busyUntil, os: { id: t.os!.id, version: t.os!.version } });
    expect(clone.template).toBeUndefined();
    expect(clone.hostname).not.toBe(t.hostname);
    expect(clone.software!.map((x) => x.id)).toEqual(t.software!.map((x) => x.id));
    expect(hostsOfVm(s, id).map((h) => h.switching?.to)).toEqual(["freepanel"]);
    expect(hostsOfVm(s, vm).map((h) => h.id)).toEqual([host]);
    for (let i = 0; i < clone.busyUntil - s.hour + 1; i++) tick(s);
    expect(hostsOfVm(s, id).map((h) => [h.panel, h.switching])).toEqual([["freepanel", null]]);
  });

  it("copies at the node's port speed for a local disk and at Fibre Channel speed onto the datastore", () => {
    const local = setup();
    // 600 GB over 1 Gbit at 450 GB an hour.
    const lt = template(local.s, local.c, { ...SMALL, diskGb: 600 });
    const lc = vmById(local.s, ok(cloneTemplate(local.s, lt)))!;
    expect(lc.busyUntil - local.s.hour).toBe(2);
    expect(lc.datastore).toBeUndefined();

    // Over 4 Gbit Fibre Channel; the 640 GB datastore has no room left for the copy, so it goes on a node.
    const fc = setup();
    ok(attachDatastore(fc.s, fc.c, fc.store, "fc"));
    fc.s.hour += 1;
    const ft = template(fc.s, fc.c, { ...SMALL, diskGb: 600 });
    expect(vmById(fc.s, ft)!.datastore).toBe(fc.store);
    const big = vmById(fc.s, ok(cloneTemplate(fc.s, ft)))!;
    expect([big.busyUntil - fc.s.hour, big.datastore]).toEqual([1, undefined]);
  });

  it("puts a clone's disk on a datastore with room", () => {
    const { s, c, store } = setup();
    const t = template(s, c);
    ok(attachDatastore(s, c, store, "nfs"));
    s.hour += 1;
    expect(vmById(s, t)!.datastore).toBeUndefined();
    expect(vmById(s, ok(cloneTemplate(s, t)))!.datastore).toBe(store);
  });

  it("clones onto the host asked for", () => {
    const { s, c, second } = setup();
    const t = template(s, c);
    const other = vmById(s, t)!.deviceId === "dev3" ? second : "dev3";
    expect(vmById(s, ok(cloneTemplate(s, t, other)))!.deviceId).toBe(other);
    expect(err(cloneTemplate(s, t, "dev4"))).toBe("error.nodeDown");
  });

  it("leaves a template on its dead node while failover restarts the VMs", () => {
    const { s, c, second, store } = setup();
    ok(attachDatastore(s, c, store, "nfs"));
    s.hour += 1;
    const t = ok(createVm(s, c, SMALL)), vm = ok(createVm(s, c, SMALL));
    for (const id of [t, vm]) if (vmById(s, id)!.deviceId !== "dev3") ok(migrateWorkload(s, id, "dev3"));
    s.hour += 2;
    ok(stopWorkload(s, t));
    ok(makeTemplate(s, t));
    s.hour += 2;
    ok(setPower(s, "dev3", false));
    tick(s);
    expect(vmById(s, vm)!.deviceId).toBe(second);
    expect(vmById(s, t)).toMatchObject({ deviceId: "dev3", stopped: true, template: true });
  });

  it("loads a save from before templates and keeps a template across a round trip", () => {
    const { s, c } = setup();
    const vm = ok(createVm(s, c, SMALL));
    ok(stopWorkload(s, vm));
    const raw = JSON.parse(serialize(s));
    for (const w of raw.workloads) delete w.template;
    const back = deserialize(JSON.stringify(raw));
    expect(back.workloads.every((w) => w.template === undefined)).toBe(true);
    ok(makeTemplate(back, vm));
    expect(deserialize(serialize(back)).workloads.find((w) => w.id === vm)!.template).toBe(true);
  });
});
