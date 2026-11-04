import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { rackTiles } from "../src/sim/20-world/layout";
import { visibleCandidates, type Employee } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { figuresIn, lobbySeats, seating } from "../src/sim/60-infra/figures";
import { failComponents, tick, tickMinute } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, mountDevice, type ActionResult } from "../src/sim/90-actions/hardware";
import { handsJobs, JOB_HOURS } from "../src/sim/90-actions/presence";
import { setOnCall } from "../src/sim/90-actions/staff";
import { cancelWorkOrder, doneAt, frontOf, orderWork, seatOf, workMinutes } from "../src/sim/90-actions/work-orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, freeFloor, hire, newGame, settle, withServer } from "./fixtures";
import { ownHall, at } from "./own-dc-hall";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const steps = (s: GameState, n: number) => { for (let i = 0; i < n; i++) tickMinute(s); };

// A cage at a datacenter with an empty rack and the player standing in it, at 10:00 on a weekday.
function site() {
  const s: GameState = { ...withServer(newGame(7)), cash: 1_000_000 };
  const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4)), rack = ok(buyRack(s, loc, "rack-42", 1));
  s.locations.find((l) => l.id === loc)!.readyAt = 0;
  s.hour = hourOf(new Date(Date.UTC(2010, 0, 4, 10)));
  s.minute = 0;
  s.player = { ...s.player, at: loc };
  return { s, loc, rack, units: (n: number) => Array.from({ length: n }, () => ok(buyDevice(s, "sw-8", "Sysko", 1, loc))) };
}

describe("work orders: schedule", () => {
  it("starts a player mount at once, arrives a minute later and mounts it 30 minutes after that", () => {
    const { s, loc, rack, units } = site();
    const [id] = units(1), now = s.hour * 60;
    ok(mountDevice(s, id, rack, 10));
    const [o] = s.orders, tile = rackTiles(s.locations.find((l) => l.id === loc)!, s.racks)[rack];
    const d = Math.abs(seatOf(s, loc, "player")!.x - frontOf(tile).x) + Math.abs(seatOf(s, loc, "player")!.y - frontOf(tile).y);
    expect(o).toMatchObject({ worker: "player", kind: "mount", startAt: now, walkMin: 1 + Math.floor(d / 30), workMin: 30 });
    expect(doneAt(o)).toBe(now + 31);
    steps(s, 30);
    expect(dev(s, id).rackId).toBeNull();
    steps(s, 1);
    expect(dev(s, id)).toMatchObject({ rackId: rack, slot: 10 });
    expect(s.orders.filter((x) => !x.applied)).toEqual([]);
  });

  it("runs two orders one after the other and refuses a sixth", () => {
    const { s, rack, units } = site();
    const ids = units(6);
    ids.slice(0, 5).forEach((id, i) => ok(mountDevice(s, id, rack, 10 + i)));
    expect(s.orders.map((o) => o.startAt)).toEqual([0, 1, 2, 3, 4].map((i) => s.orders[0].startAt! + i * (31)));
    expect(err(mountDevice(s, ids[5], rack, 20))).toBe("error.queueFull");
  });
});

describe("work orders: cancel", () => {
  it("leaves a cancelled queued device unmounted and moves the queue up", () => {
    const { s, rack, units } = site();
    const [a, b, c] = units(3);
    ok(mountDevice(s, a, rack, 10));
    const queued = ok(mountDevice(s, b, rack, 11));
    ok(mountDevice(s, c, rack, 12));
    ok(cancelWorkOrder(s, queued));
    expect(s.orders[1].startAt).toBe(doneAt(s.orders[0]));
    settle(s);
    expect([a, b, c].map((id) => dev(s, id).rackId)).toEqual([rack, null, rack]);
  });

  it("wastes the time of the running order and does nothing", () => {
    const { s, rack, units } = site();
    const [a] = units(1), id = ok(mountDevice(s, a, rack, 10));
    steps(s, 10);
    ok(cancelWorkOrder(s, id));
    settle(s);
    expect(dev(s, a).rackId).toBeNull();
    expect(err(cancelWorkOrder(s, id))).toBe("error.unknownOperation");
  });
});

describe("work orders: staff work", () => {
  it("takes half the time at skill 100 and one and a half times at skill 0", () => {
    const { s } = site();
    s.staff.push({ ...visibleCandidates(s)[0], id: "t100", skill: 100 } as never, { ...visibleCandidates(s)[0], id: "t0", skill: 0 } as never);
    expect(workMinutes(s, "t100", "parts")).toBe(30);
    expect(workMinutes(s, "t0", "parts")).toBe(90);
    expect(workMinutes(s, "player", "parts")).toBe(60);
  });
});

describe("work orders: conversion", () => {
  it("finishes a provider job at the same minute and fee as the hourly model", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 100_000 };
    const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4)), rack = ok(buyRack(s, loc, "rack-42", 1)), rh = datacenterById("equinox-fr5").remoteHands;
    s.locations.find((l) => l.id === loc)!.readyAt = 0;
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc)), cash = s.cash, hour = s.hour;
    ok(mountDevice(s, id, rack, 10));
    const [o] = s.orders;
    expect(o).toMatchObject({ worker: "provider", fee: JOB_HOURS.mount * rh.perHour });
    expect(doneAt(o)).toBe((hour + rh.responseHours + JOB_HOURS.mount) * 60);
    expect(handsJobs(s)).toHaveLength(1);
    steps(s, doneAt(o) - hour * 60 - 1);
    expect(dev(s, id).rackId).toBeNull();
    steps(s, 1);
    expect(dev(s, id).rackId).toBe(rack);
    expect(cash - s.cash).toBe(JOB_HOURS.mount * rh.perHour);
  });

  it("still lets a technician do one operation an hour", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const t = ok(hire(s, c.id));
    s.staff = s.staff.map((x) => (x.id === t ? { ...x, trained: ["hardware"] } : x));
    ok(setOnCall(s, t, true));
    s.hour = hourOf(new Date(Date.UTC(2005, 0, 8, 1)));
    const fan = dev(s, "dev3").components.find((x) => x.kind === "fan")!;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? failComponents(s, d, [fan.id]) : d));
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    tick(s);
    expect(s.orders.filter((o) => o.worker === t && o.kind === "op")).toHaveLength(1);
  });
});

describe("work orders: figures", () => {
  it("shows a worker walking, working with progress, walking back and gone", () => {
    const { s, loc, rack, units } = site();
    const [id] = units(1);
    ok(mountDevice(s, id, rack, 10));
    const [o] = s.orders, start = o.startAt!;
    const pose = (m: number) => figuresIn(s, loc, m).find((f) => f.id === "player");
    expect(pose(start - 1)).toBeUndefined();
    expect(pose(start)).toMatchObject({ pose: "walk" });
    expect(pose(start + o.walkMin)).toMatchObject({ pose: "work", progress: 0 });
    expect(pose(start + o.walkMin + 15)).toMatchObject({ pose: "work", progress: 0.5, job: { rackId: rack } });
    expect(pose(doneAt(o))).toMatchObject({ pose: "walk" });
    expect(pose(doneAt(o) + o.walkMin)).toBeUndefined();
  });
});

describe("work orders: seats", () => {
  it("seats the hires at their desks and sends the player to the first lobby chair when they fill every seat", () => {
    const e = ownHall();
    e.s.hour = at(2013, 3, 4, 10);
    const loc = e.s.locations.find((l) => l.id === e.hallId)!, seats = 3;
    const desk = e.hall().items.find((i) => i.kind === "nocdesk")!.id;
    const mk = (n: number): Employee => ({ id: `s${n}`, name: `s${n}`, role: "technician", skill: 50, talent: 50, salary: 3000, hiredAt: n, assignment: "queue", location: e.hallId, trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 1e9, refusedAt: null, team: e.s.teams[0].id, worked: 0, desk: { propertyId: e.propertyId, sectionId: `noc:${desk}`, index: n - 1 } });
    e.s.staff.push(...[1, 2, 3].map(mk));
    const none = seating(e.s, loc, e.s.hour);
    expect(none.every((x) => x.seated)).toBe(true);
    expect(none).toHaveLength(seats);
    e.s.player = { ...e.s.player, at: e.hallId };
    const some = seating(e.s, loc, e.s.hour);
    expect(some.find((x) => x.id === "player")).toMatchObject({ seated: true });
    expect(some.filter((x) => x.seated)).toHaveLength(seats + 1);
    expect(some.find((x) => x.id === "player")!.at).toEqual(lobbySeats(e.s, loc)[0]);
  });
});

describe("work orders: old saves", () => {
  it("loads queued hand jobs and the player's work in progress to the same finish times", () => {
    const { s, loc, rack, units } = site();
    const [id] = units(1);
    const raw = JSON.parse(serialize(s)) as Record<string, unknown> & { player: Record<string, unknown>; hour: number };
    delete raw.orders;
    raw.handsJobs = [{ id: "hj1", action: "mountDevice", args: [id, rack, 10], locationId: loc, deviceId: id, dueAt: raw.hour + 5, fee: 60 }];
    raw.player = { ...raw.player, doing: "work", until: raw.hour + 2 };
    const old = deserialize(JSON.stringify(raw));
    expect(old.orders.map((o) => [o.worker, doneAt(o)])).toEqual([["provider", (raw.hour + 5) * 60], ["player", (raw.hour + 2) * 60]]);
    expect(old.player.until).toBe(0);
    expect(handsJobs(old)).toMatchObject([{ id: "hj1", dueAt: raw.hour + 5, fee: 60 }]);
    void orderWork;
  });
});
