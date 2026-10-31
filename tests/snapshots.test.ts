import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { datastoreUsed, nodeUsed, vmById, type Workload } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { createVm } from "../src/sim/90-actions/clusters";
import { attachDatastore, moveDisk } from "../src/sim/90-actions/datastores";
import { deleteSnapshot, revertSnapshot, takeSnapshot } from "../src/sim/90-actions/snapshots";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const SIZE = { vcpu: 1, ramGb: 1, diskGb: 20 };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * 24; i++) tick(s); };
const set = (s: GameState, id: string, p: Partial<Workload>) => { s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w)); };
const snaps = (s: GameState, id: string) => vmById(s, id)!.snapshots ?? [];

// One VM on a one-node VMwhere cluster, with a Storage 2U next to it that can become a datastore.
function setup(platform = "vmwhere"): { s: GameState; c: string; vm: string; store: string } {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const store = ok(buyDevice(s, "g1-storage", "Dwell", 1, "loc1"));
  ok(mountDevice(s, store, "rack2", 4));
  const c = hypervisor(s, ["dev3"], "VM 1", platform);
  return { s, c, vm: ok(createVm(s, c, SIZE)), store };
}

describe("snapshots", () => {
  it("keeps up to three per VM, only on VMwhere", () => {
    const { s, vm } = setup();
    for (let i = 0; i < 3; i++) ok(takeSnapshot(s, vm));
    expect(err(takeSnapshot(s, vm))).toBe("error.snapshotsFull");
    expect(snaps(s, vm).map((x) => x.deltaGb)).toEqual([0, 0, 0]);
    const other = setup("proxmocks");
    expect(err(takeSnapshot(other.s, other.vm))).toBe("error.noSnapshots");
  });

  it("lets HyperVee take, revert and delete up to three checkpoints without datastores", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    skipTo(s, 2009);
    const c = hypervisor(s, ["dev3"], "HV 1", "hypervee"), vm = ok(createVm(s, c, SIZE));
    const first = ok(takeSnapshot(s, vm));
    for (let i = 0; i < 2; i++) ok(takeSnapshot(s, vm));
    expect(err(takeSnapshot(s, vm))).toBe("error.snapshotsFull");
    ok(revertSnapshot(s, vm, first) as never);
    expect(snaps(s, vm)).toHaveLength(1);
    ok(deleteSnapshot(s, vm, first) as never);
    expect(snaps(s, vm)).toHaveLength(0);
  });

  it("grows each delta by 5% of the disk a day up to the whole disk, booked on the node", () => {
    const { s, vm } = setup();
    const before = nodeUsed(s, "dev3").diskGb;
    ok(takeSnapshot(s, vm));
    days(s, 2);
    expect(snaps(s, vm)[0].deltaGb).toBeCloseTo(2);
    expect(nodeUsed(s, "dev3").diskGb).toBeCloseTo(before + 2);
    days(s, 20);
    expect(snaps(s, vm)[0].deltaGb).toBe(20);
  });

  it("books deltas on the datastore the disk is on, and moves them with the disk", () => {
    const { s, c, vm, store } = setup();
    ok(attachDatastore(s, c, store, "nfs"));
    s.hour += 1;
    ok(moveDisk(s, vm, store));
    days(s, 1);
    ok(takeSnapshot(s, vm));
    const node = nodeUsed(s, "dev3").diskGb;
    days(s, 1);
    expect(datastoreUsed(s, store)).toBeCloseTo(21);
    expect(nodeUsed(s, "dev3").diskGb).toBeCloseTo(node);
    ok(moveDisk(s, vm, null));
    expect(datastoreUsed(s, store)).toBe(0);
    expect(nodeUsed(s, "dev3").diskGb).toBeCloseTo(node + 20 + snaps(s, vm)[0].deltaGb);
  });

  it("frees the delta on delete", () => {
    const { s, vm } = setup();
    const before = nodeUsed(s, "dev3").diskGb, id = ok(takeSnapshot(s, vm));
    days(s, 1);
    ok(deleteSnapshot(s, vm, id));
    expect(vmById(s, vm)!.snapshots).toBeUndefined();
    expect(nodeUsed(s, "dev3").diskGb).toBe(before);
  });

  it("reverts with a restart, drops newer snapshots and empties the reverted delta", () => {
    const { s, vm } = setup();
    const first = ok(takeSnapshot(s, vm));
    days(s, 1);
    ok(takeSnapshot(s, vm));
    ok(revertSnapshot(s, vm, first));
    expect(snaps(s, vm)).toEqual([{ id: first, at: expect.any(Number), deltaGb: 0, machine: expect.anything() }]);
    expect(vmById(s, vm)!.busyUntil).toBeGreaterThan(s.hour);
  });

  it("clears corruption only with a snapshot older than it", () => {
    const { s, vm } = setup();
    const old = ok(takeSnapshot(s, vm));
    s.hour += 5;
    set(s, vm, { corrupted: true, noticed: true, corruptedAt: s.hour });
    expect(err(takeSnapshot(s, vm))).toBe("error.lostDisk");
    s.hour += 1;
    set(s, vm, { snapshots: [...snaps(s, vm), { id: "late", at: s.hour, deltaGb: 0 }] });
    ok(revertSnapshot(s, vm, "late"));
    expect(vmById(s, vm)!.corrupted).toBe(true);
    s.hour += 1;
    ok(revertSnapshot(s, vm, old));
    expect(vmById(s, vm)!.corrupted).toBeUndefined();
  });

  it("returns an own VM's OS and software to the snapshot", () => {
    const { s, vm } = setup();
    const os = { id: "lunix" as const, version: "1", installedAt: 0 };
    set(s, vm, { os, software: [{ id: "lamp", version: "1", installedAt: 0, doneAt: 0 }] });
    const id = ok(takeSnapshot(s, vm));
    set(s, vm, { os: null, software: [] });
    ok(revertSnapshot(s, vm, id));
    expect(vmById(s, vm)!.os).toEqual(os);
    expect(vmById(s, vm)!.software!.map((x) => x.id)).toEqual(["lamp"]);
  });

  it("loses the snapshots with the disk", () => {
    const { s, vm } = setup();
    const id = ok(takeSnapshot(s, vm));
    s.hour += 1;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: s.hour } : d));
    expect(err(revertSnapshot(s, vm, id))).toBe("error.lostDisk");
    tick(s);
    expect(vmById(s, vm)!.snapshots).toBeUndefined();
  });

  it("loads a save from before snapshots and keeps them across a round trip", () => {
    const { s, vm } = setup();
    const raw = JSON.parse(serialize(s));
    for (const w of raw.workloads) delete w.snapshots;
    const back = deserialize(JSON.stringify(raw));
    ok(takeSnapshot(back, vm));
    expect(deserialize(serialize(back)).workloads.find((w) => w.id === vm)!.snapshots).toHaveLength(1);
  });
});
