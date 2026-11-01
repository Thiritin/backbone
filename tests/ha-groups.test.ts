import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { vmById } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { createVm, setHa } from "../src/sim/90-actions/clusters";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { deleteHaGroup, saveHaGroup, setHaGroup } from "../src/sim/90-actions/hagroups";
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
const at = (s: GameState, id: string) => vmById(s, id)!.deviceId;

// A three node cluster with failover on and one VM on node 0 in a group that prefers node 0, then node 1.
function grouped(restricted = false, noFailback = false) {
  const { s, c, ids } = setup(3);
  ok(setHa(s, c, "failover", true));
  const vm = ok(createVm(s, c, SMALL));
  s.workloads = s.workloads.map((w) => (w.id === vm ? { ...w, deviceId: ids[0] } : w));
  const g = ok(saveHaGroup(s, c, { name: "prefer", nodes: [{ deviceId: ids[0], priority: 3 }, { deviceId: ids[1], priority: 2 }], restricted, noFailback }));
  ok(setHaGroup(s, vm, g));
  s.hour += 2;
  return { s, c, ids, vm, g };
}

describe("HA groups", () => {
  it("fails over to the highest priority surviving node of the group", () => {
    const { s, ids, vm } = grouped();
    ok(setPower(s, ids[0], false));
    tick(s);
    expect(at(s, vm)).toBe(ids[1]);
  });

  it("a restricted group never leaves its nodes and an open one does", () => {
    const r = grouped(true);
    ok(saveHaGroup(r.s, r.c, { id: r.g, name: "prefer", nodes: [{ deviceId: r.ids[0], priority: 3 }], restricted: true }));
    ok(setPower(r.s, r.ids[0], false));
    tick(r.s);
    expect(at(r.s, r.vm)).toBe(r.ids[0]);
    expect(vmById(r.s, r.vm)!.stuck).toBe(true);
    const o = grouped(false);
    ok(saveHaGroup(o.s, o.c, { id: o.g, name: "prefer", nodes: [{ deviceId: o.ids[0], priority: 3 }], restricted: false }));
    ok(setPower(o.s, o.ids[0], false));
    tick(o.s);
    expect(at(o.s, o.vm)).not.toBe(o.ids[0]);
  });

  it("fails back after one hour on the returned node", () => {
    const { s, ids, vm } = grouped();
    ok(setPower(s, ids[0], false));
    tick(s);
    ok(setPower(s, ids[0], true));
    tick(s);
    expect(at(s, vm)).toBe(ids[1]);
    tick(s);
    expect(at(s, vm)).toBe(ids[0]);
  });

  it("nofailback keeps the VM where it is", () => {
    const { s, ids, vm } = grouped(false, true);
    ok(setPower(s, ids[0], false));
    tick(s);
    ok(setPower(s, ids[0], true));
    for (let i = 0; i < 4; i++) tick(s);
    expect(at(s, vm)).toBe(ids[1]);
  });

  it("requires quorum and drops the group from its VMs on delete", () => {
    const { s, c, ids, vm, g } = grouped();
    ok(setPower(s, ids[1], false));
    ok(setPower(s, ids[2], false));
    expect(err(saveHaGroup(s, c, { name: "x", nodes: [{ deviceId: ids[0], priority: 1 }], restricted: false }))).toBe("error.noQuorum");
    expect(err(setHaGroup(s, vm, null))).toBe("error.noQuorum");
    expect(err(deleteHaGroup(s, c, g))).toBe("error.noQuorum");
    ok(setPower(s, ids[1], true));
    s.hour += 3;
    tick(s);
    ok(deleteHaGroup(s, c, g));
    expect(vmById(s, vm)!.haGroup).toBeNull();
    expect(cl(s, c).haGroups).toEqual([]);
  });

  it("an old save loads without groups", () => {
    const { s, c, vm } = grouped();
    const raw = JSON.parse(serialize(s));
    for (const x of raw.clusters) delete x.haGroups;
    for (const w of raw.workloads) delete w.haGroup;
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.clusters.find((x) => x.id === c)!.haGroups ?? []).toEqual([]);
    expect(vmById(back, vm)!.haGroup ?? null).toBeNull();
  });
});
