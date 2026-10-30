import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { datastoreUsed, nodeUsed, vmById, workloadOnline } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, setHa } from "../src/sim/90-actions/clusters";
import { attachDatastore, detachDatastore, moveDisk } from "../src/sim/90-actions/datastores";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { installSoftware } from "../src/sim/90-actions/software";
import { migrateWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, join, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const SMALL = { vcpu: 1, ramGb: 1, diskGb: 20 };

// A two-node VMwhere cluster in the basement next to a Storage 2U with drives, both nodes with live migration and failover on.
function setup(year = 2005): { s: GameState; c: string; second: string; store: string } {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const store = ok(buyDevice(s, "g1-storage", "Dwell", 1, "loc1"));
  ok(mountDevice(s, store, "rack2", 4));
  const c = hypervisor(s, ["dev3"], "VM 1", "vmwhere");
  join(s, c, second);
  if (year > 2005) skipTo(s, year);
  ok(setHa(s, c, "live", true));
  ok(setHa(s, c, "failover", true));
  return { s, c, second, store };
}
const ready = (s: GameState, c: string, store: string, protocol: "nfs" | "iscsi" | "fc" = "nfs") => {
  ok(attachDatastore(s, c, store, protocol));
  s.hour += 1;
};

describe("datastores", () => {
  it("attaches a free server with drives in the cluster's zone, up to an hour later, and frees it once empty", () => {
    const { s, c, second, store } = setup();
    expect(err(attachDatastore(s, c, "dev4", "nfs"))).toBe("error.notServer");
    expect(err(attachDatastore(s, c, second, "nfs"))).toBe("error.serverInUse");
    expect(err(attachDatastore(s, c, store, "iscsi"))).toBe("error.protocolTooNew");
    ok(attachDatastore(s, c, store, "nfs"));
    expect(err(attachDatastore(s, c, store, "nfs"))).toBe("error.serverInUse");
    expect(err(installSoftware(s, store, "vmwhere"))).toBe("error.serverInUse");
    // Not usable during the attach hour: the VM books its node's disk.
    const early = vmById(s, ok(createVm(s, c, SMALL)))!;
    expect(early.datastore).toBeUndefined();
    s.hour += 1;
    const vm = vmById(s, ok(createVm(s, c, SMALL)))!;
    expect(vm.datastore).toBe(store);
    expect(datastoreUsed(s, store)).toBe(20);
    expect(nodeUsed(s, vm.deviceId!).diskGb).toBe(early.deviceId === vm.deviceId ? 20 : 0);
    expect(err(detachDatastore(s, c, store))).toBe("error.datastoreNotEmpty");
    ok(moveDisk(s, vm.id, null));
    expect(vmById(s, vm.id)!.datastore).toBeUndefined();
    ok(detachDatastore(s, c, store));
    expect(s.clusters.find((x) => x.id === c)!.datastores).toEqual([]);
  });

  it("charges Fibre Channel host adapters once per node and leaves NFS free", () => {
    const { s, c, store } = setup();
    const cash = s.cash;
    ok(attachDatastore(s, c, store, "fc"));
    expect(s.cash).toBe(cash - 1400);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.fcAdapters", amount: -1400 });
  });

  it("moves only datastore VMs live between nodes before 2012, and local ones too from 2012", () => {
    const old = setup();
    ready(old.s, old.c, old.store);
    const shared = vmById(old.s, ok(createVm(old.s, old.c, SMALL)))!;
    const local = vmById(old.s, ok(createVm(old.s, old.c, { ...SMALL, diskGb: 700 })))!;
    expect(local.datastore).toBeUndefined();
    const other = (id: string) => (vmById(old.s, id)!.deviceId === "dev3" ? old.second : "dev3");
    ok(migrateWorkload(old.s, shared.id, other(shared.id)));
    ok(migrateWorkload(old.s, local.id, other(local.id)));
    expect(vmById(old.s, shared.id)!.busyUntil).toBe(old.s.hour);
    expect(vmById(old.s, local.id)!.busyUntil).toBeGreaterThan(old.s.hour);

    const late = setup(2012);
    const vm = vmById(late.s, ok(createVm(late.s, late.c, SMALL)))!;
    ok(migrateWorkload(late.s, vm.id, vm.deviceId === "dev3" ? late.second : "dev3"));
    expect(vmById(late.s, vm.id)!.busyUntil).toBe(late.s.hour);
  });

  it("fails over only VMs on a working datastore; local ones wait for their node", () => {
    const { s, c, second, store } = setup();
    ready(s, c, store);
    const shared = ok(createVm(s, c, SMALL));
    ok(moveDisk(s, ok(createVm(s, c, SMALL)), null));
    const local = s.workloads.find((w) => w.clusterId === c && w.id !== shared)!.id;
    for (const id of [shared, local]) if (vmById(s, id)!.deviceId !== "dev3") ok(migrateWorkload(s, id, "dev3"));
    s.hour += 2;
    ok(setPower(s, "dev3", false));
    tick(s);
    expect([vmById(s, shared)!.deviceId, workloadOnline(s, vmById(s, shared)!)]).toEqual([second, true]);
    expect([vmById(s, local)!.deviceId, vmById(s, local)!.stuck, workloadOnline(s, vmById(s, local)!)]).toEqual(["dev3", undefined, false]);
  });

  it("takes every VM on a datastore down with its server", () => {
    const { s, c, store } = setup();
    ready(s, c, store);
    const vm = ok(createVm(s, c, SMALL));
    expect(workloadOnline(s, vmById(s, vm)!)).toBe(true);
    ok(setPower(s, store, false));
    expect(workloadOnline(s, vmById(s, vm)!)).toBe(false);
  });

  it("copies a disk offline at the datastore's speed before 2007 and live from 2007", () => {
    const old = setup();
    ok(createVm(old.s, old.c, { ...SMALL, diskGb: 500 }));
    ready(old.s, old.c, old.store);
    const vm = old.s.workloads.find((w) => w.clusterId === old.c && w.diskGb === 500)!;
    ok(moveDisk(old.s, vm.id, old.store));
    // 500 GB over 1 Gbit at 450 GB an hour.
    expect(vmById(old.s, vm.id)!.busyUntil).toBe(old.s.hour + 2);
    expect(err(moveDisk(old.s, vm.id, null))).toBe("error.workloadBusy");

    const late = setup(2007);
    const id = ok(createVm(late.s, late.c, { ...SMALL, diskGb: 500 }));
    ready(late.s, late.c, late.store);
    ok(moveDisk(late.s, id, late.store));
    expect(vmById(late.s, id)!.busyUntil).toBeLessThanOrEqual(late.s.hour);
  });

  it("loads a save from before datastores with none attached", () => {
    const { s } = setup();
    const raw = JSON.parse(serialize(s));
    for (const c of raw.clusters) delete c.datastores;
    const back = deserialize(JSON.stringify(raw));
    expect(back.clusters.map((c) => c.datastores)).toEqual([[]]);
    expect(back.workloads.every((w) => w.datastore === undefined)).toBe(true);
  });
});
