import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { vmById } from "../src/sim/60-infra/cluster";
import { quorate, votes } from "../src/sim/60-infra/quorum";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, deleteVm, setHa } from "../src/sim/90-actions/clusters";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { setQdevice } from "../src/sim/90-actions/quorum";
import { takeSnapshot } from "../src/sim/90-actions/snapshots";
import { migrateWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, hypervisor, join, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const SMALL = { vcpu: 1, ramGb: 1, diskGb: 20 };

// A Proxmocks cluster of dev3 and a second server; extra adds more nodes, spare buys one free server.
function setup(nodes = 2): { s: GameState; c: string; ids: string[]; spare: string } {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const buy = (slot: number, port: number) => {
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", slot));
    ok(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
    return id;
  };
  const ids = ["dev3"];
  for (let i = 1; i < nodes; i++) ids.push(buy(2 * i, i));
  const spare = buy(2 * nodes, nodes);
  const c = hypervisor(s, ["dev3"], "PVE", "proxmocks");
  for (const id of ids.slice(1)) join(s, c, id);
  return { s, c, ids, spare };
}
const cl = (s: GameState, c: string) => s.clusters.find((x) => x.id === c)!;

describe("cluster quorum", () => {
  it("loses quorum when one of two nodes dies and keeps it with three", () => {
    const two = setup(2);
    expect(quorate(two.s, cl(two.s, two.c))).toBe(true);
    ok(setPower(two.s, two.ids[1], false));
    expect(quorate(two.s, cl(two.s, two.c))).toBe(false);
    const three = setup(3);
    ok(setPower(three.s, three.ids[1], false));
    expect(votes(three.s, cl(three.s, three.c))).toEqual({ total: 3, up: 2 });
    expect(quorate(three.s, cl(three.s, three.c))).toBe(true);
  });

  it("a QDevice restores a majority and takes a free server only", () => {
    const { s, c, ids, spare } = setup(2);
    expect(err(setQdevice(s, c, ids[1]))).toBe("error.serverInUse");
    ok(setQdevice(s, c, spare));
    ok(setPower(s, ids[1], false));
    expect(votes(s, cl(s, c))).toEqual({ total: 3, up: 2 });
    expect(quorate(s, cl(s, c))).toBe(true);
    ok(setPower(s, spare, false));
    expect(quorate(s, cl(s, c))).toBe(false);
    ok(setQdevice(s, c, null));
    expect(cl(s, c).qdevice).toBeNull();
  });

  it("refuses changes while read-only and still allows the fix", () => {
    const { s, c, ids, spare } = setup(2);
    const vm = ok(createVm(s, c, SMALL));
    ok(setPower(s, ids[1], false));
    expect(err(createVm(s, c, SMALL))).toBe("error.noQuorum");
    expect(err(deleteVm(s, vm))).toBe("error.noQuorum");
    expect(err(takeSnapshot(s, vm))).toBe("error.noQuorum");
    expect(err(migrateWorkload(s, vm, ids[0]))).toBe("error.noQuorum");
    ok(setQdevice(s, c, spare));
    ok(createVm(s, c, SMALL));
  });

  it("does not fail over without quorum and leaves running VMs up", () => {
    const { s, c, ids } = setup(2);
    ok(setHa(s, c, "failover", true));
    const vm = ok(createVm(s, c, SMALL));
    s.workloads = s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: ids[0] } : w));
    s.hour += 2;
    ok(setPower(s, ids[0], false));
    tick(s);
    expect(vmById(s, vm)!.deviceId).toBe(ids[0]);
    const other = setup(3);
    ok(setHa(other.s, other.c, "failover", true));
    const v2 = ok(createVm(other.s, other.c, SMALL));
    other.s.workloads = other.s.workloads.map((w) => (w.id === v2 ? { ...w, deviceId: other.ids[0] } : w));
    other.s.hour += 2;
    ok(setPower(other.s, other.ids[0], false));
    tick(other.s);
    expect(vmById(other.s, v2)!.deviceId).not.toBe(other.ids[0]);
  });

  it("an old save loads without a QDevice", () => {
    const { s, c } = setup(2);
    const raw = JSON.parse(serialize(s));
    for (const x of raw.clusters) delete x.qdevice;
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.clusters.find((x) => x.id === c)!.qdevice ?? null).toBeNull();
  });
});
