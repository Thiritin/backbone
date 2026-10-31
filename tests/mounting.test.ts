import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { datacenterById } from "../src/sim/20-world/datacenters";
import type { Task } from "../src/sim/47-staff/staff";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, mountDevice, mountHours, mountStack, setPlugged, setPower, unmountDevice } from "../src/sim/90-actions/hardware";
import { hire, queueOperation, setTechLocation } from "../src/sim/90-actions/staff";
import { buyDevice, freeFloor, withServer } from "./fixtures";

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

  it("is done at once and free in the basement", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 10_000 };
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    const cash = s.cash;
    ok(mountDevice(s, id, "rack2", 10));
    expect(dev(s, id).maintenance).toBeNull();
    expect(s.cash).toBe(cash);
    ok(unmountDevice(s, id));
    expect(dev(s, id).maintenance).toBeNull();
    expect(s.cash).toBe(cash);
  });

  it("books remote hands at a datacenter for at least an hour and keeps the device off until they are done", () => {
    const { s, loc, rack, hands } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    const cash = s.cash, start = s.hour;
    ok(mountDevice(s, id, rack, 1));
    expect(s.cash).toBe(cash - hands.perHour);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.remoteHands", params: { hours: 1 } });
    expect(dev(s, id)).toMatchObject({ rackId: rack, slot: 1, maintenance: { mount: true, doneAt: start + hands.responseHours + 0.5 } });
    for (const c of dev(s, id).components) if (c.kind === "psu") ok(setPlugged(s, id, c.id, true));
    expect(err(setPower(s, id, true))).toBe("error.handWork");
    expect(err(unmountDevice(s, id))).toBe("error.handWork");
    const events = run(s, hands.responseHours + 1);
    expect(events.some((e) => e.key === "event.workDone")).toBe(true);
    expect(dev(s, id).maintenance).toBeNull();
    ok(setPower(s, id, true));
    expect(dev(s, id).on).toBe(true);
  });

  it("bills a stack for the work of every unit", () => {
    const { s, loc, rack, hands } = colo();
    ok(buyDevice(s, "sw-8", "Sysko", 4, loc));
    const cash = s.cash;
    ok(mountStack(s, "sw-8", "Sysko", rack, 4));
    expect(s.cash).toBe(cash - 2 * hands.perHour);
    expect(s.devices.filter((d) => d.rackId === rack).every((d) => d.maintenance?.mount)).toBe(true);
  });

  it("unmounts by hand work too and keeps the unit busy in storage until done", () => {
    const { s, loc, rack, hands } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(mountDevice(s, id, rack, 1));
    run(s, hands.responseHours + 1);
    const cash = s.cash;
    ok(unmountDevice(s, id));
    expect(s.cash).toBe(cash - hands.perHour);
    expect(dev(s, id)).toMatchObject({ rackId: null, store: loc, maintenance: { mount: true } });
    expect(err(mountDevice(s, id, rack, 1))).toBe("error.handWork");
    run(s, hands.responseHours + 1);
    ok(mountDevice(s, id, rack, 1));
  });

  it("lets the player rack it free when standing in the datacenter", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    expect(err(mountDevice(s, id, rack, 1, "self"))).toBe("error.notThere");
    s.player = { ...s.player, at: loc };
    const cash = s.cash;
    ok(mountDevice(s, id, rack, 1, "self"));
    expect(s.cash).toBe(cash);
    expect(dev(s, id).maintenance).toMatchObject({ mount: true, doneAt: s.hour + 0.5 });
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
});
