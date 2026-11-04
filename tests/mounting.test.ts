import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { datacenterById } from "../src/sim/20-world/datacenters";
import type { Task } from "../src/sim/47-staff/staff";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { handsJobs, JOB_HOURS } from "../src/sim/90-actions/presence";
import { addLocation, buyRack, mountDevice, mountHours, mountStack, setPower, unmountDevice } from "../src/sim/90-actions/hardware";
import { queueOperation, setTechLocation } from "../src/sim/90-actions/staff";
import { hire, settle } from "./fixtures";
import { buyDevice, freeFloor, withServer, newGame } from "./fixtures";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
// 2005-01-03 is a Monday; the tick at this hour is the first office hour.
const MONDAY_9 = 48 + 9;

// A cage at Equinox FR5 with an empty rack.
function colo() {
  const s: GameState = { ...withServer(newGame(7)), cash: 100_000 };
  const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
  const rack = ok(buyRack(s, loc, "rack-42", 1));
  return { s, loc, rack, hands: datacenterById("equinox-fr5").remoteHands };
}

describe("mounting hardware", () => {
  it("takes 30 minutes for a 1U device and 15 more per further unit", () => {
    expect(modelById("sw-8").height).toBe(1);
    expect(mountHours("sw-8")).toBe(0.5);
    const big = modelById("g1-compute").height;
    expect(mountHours("g1-compute")).toBe(0.25 + 0.25 * big);
  });

  it("is a free work order for the player's own hands in the basement", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 10_000 };
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    const cash = s.cash;
    ok(mountDevice(s, id, "rack2", 10));
    expect(s.orders.some((o) => o.worker === "player" && !o.applied)).toBe(true);
    expect(dev(s, id).rackId).toBeNull();
    settle(s);
    expect(dev(s, id).rackId).toBe("rack2");
    expect(dev(s, id).maintenance).toBeNull();
    expect(s.cash).toBe(cash);
    ok(unmountDevice(s, id));
    settle(s);
    expect(dev(s, id).rackId).toBeNull();
    expect(dev(s, id).maintenance).toBeNull();
    expect(s.cash).toBe(cash);
  });

  it("queues a remote hands job at a datacenter and racks the device when it is done", () => {
    const { s, loc, rack, hands } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    const cash = s.cash, wait = hands.responseHours + JOB_HOURS.mount;
    ok(mountDevice(s, id, rack, 1));
    expect(handsJobs(s)).toHaveLength(1);
    expect(s.cash).toBe(cash);
    expect(dev(s, id).rackId).toBeNull();
    run(s, Math.ceil(wait) - 1);
    expect(dev(s, id).rackId).toBeNull();
    run(s, 1);
    expect(handsJobs(s)).toHaveLength(0);
    expect(dev(s, id)).toMatchObject({ rackId: rack, slot: 1 });
    expect(s.cash).toBe(cash - JOB_HOURS.mount * hands.perHour);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.remoteHands", params: { hours: JOB_HOURS.mount } });
  });

  it("bills a stack as one mount job", () => {
    const { s, loc, rack, hands } = colo();
    ok(buyDevice(s, "sw-8", "Sysko", 4, loc));
    const cash = s.cash;
    ok(mountStack(s, "sw-8", "Sysko", rack, 4));
    expect(handsJobs(s)).toHaveLength(1);
    run(s, Math.ceil(hands.responseHours + JOB_HOURS.mount));
    expect(s.devices.filter((d) => d.rackId === rack && d.model !== "panel-provider")).toHaveLength(4);
    expect(s.cash).toBe(cash - JOB_HOURS.mount * hands.perHour);
  });

  it("queues an unmount job and keeps the unit racked until it runs", () => {
    const { s, loc, rack, hands } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(mountDevice(s, id, rack, 1, true));
    run(s, 24);
    const cash = s.cash;
    ok(unmountDevice(s, id));
    expect(s.cash).toBe(cash);
    expect(dev(s, id).rackId).toBe(rack);
    run(s, Math.ceil(hands.responseHours + JOB_HOURS.mount));
    expect(dev(s, id)).toMatchObject({ rackId: null, store: loc });
    expect(s.cash).toBe(cash - JOB_HOURS.mount * hands.perHour);
  });

  it("lets the player rack it free when standing in the datacenter", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    s.player = { ...s.player, at: loc };
    const cash = s.cash;
    ok(mountDevice(s, id, rack, 1, "self"));
    expect(s.cash).toBe(cash);
    expect(s.orders).toMatchObject([{ worker: "player", kind: "mount", workMin: JOB_HOURS.mount * 60 }]);
    expect(dev(s, id).rackId).toBeNull();
  });

  it("is a technician operation at their location, done without a fee", () => {
    const { s, loc, rack } = colo();
    s.hour = MONDAY_9 - 1;
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const tech = ok(hire(s, c.id));
    s.staff = s.staff.map((e) => (e.id === tech ? { ...e, trained: ["hardware"] as Task[] } : e));
    ok(setTechLocation(s, tech, loc));
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    expect(err(queueOperation(s, "mount", id, rack, null, 99))).toBe("error.outOfBounds");
    ok(queueOperation(s, "mount", id, rack, null, 5));
    const cash = s.cash;
    run(s, 1);
    expect(dev(s, id)).toMatchObject({ rackId: rack, slot: 5, maintenance: { mount: true } });
    run(s, 1);
    expect(dev(s, id).maintenance).toBeNull();
    expect(s.ledger.filter((x) => x.key === "ledger.remoteHands")).toEqual([]);
    expect(s.cash).toBeGreaterThan(cash - 1000);
    ok(queueOperation(s, "unmount", id));
    run(s, 2);
    expect(dev(s, id)).toMatchObject({ rackId: null, store: loc, maintenance: null });
  });

  it("lets a technician mount a whole stack in one operation that takes the summed time", () => {
    const { s, loc, rack } = colo();
    s.hour = MONDAY_9 - 1;
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const tech = ok(hire(s, c.id));
    s.staff = s.staff.map((e) => (e.id === tech ? { ...e, trained: ["hardware"] as Task[] } : e));
    ok(setTechLocation(s, tech, loc));
    ok(buyDevice(s, "sw-8", "Sysko", 3, loc));
    const ids = s.devices.filter((d) => d.model === "sw-8" && d.store === loc).map((d) => d.id);
    expect(err(queueOperation(s, "mount", ids[0], rack, null, 5, 4))).toBe("error.notInStorage");
    ok(queueOperation(s, "mount", ids[0], rack, null, 5, 3));
    const at = s.hour + 1;
    run(s, 1);
    expect(ids.map((id) => dev(s, id).slot).sort()).toEqual([5, 6, 7]);
    for (const id of ids) expect(dev(s, id)).toMatchObject({ rackId: rack, maintenance: { mount: true, doneAt: at + 3 * mountHours("sw-8") } });
    expect(s.techOps).toEqual([]);
    run(s, 2);
    for (const id of ids) expect(dev(s, id).maintenance).toBeNull();
  });
});
