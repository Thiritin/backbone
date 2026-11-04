import { describe, expect, it } from "vitest";
import { cents } from "../src/sim/45-billing/billing";
import { customerSpots, HALL } from "../src/sim/20-world/properties";
import type { Employee } from "../src/sim/47-staff/staff";
import { figuresIn } from "../src/sim/60-infra/figures";
import { goingHandsRate, handsTick, setHandsRate } from "../src/sim/90-actions/hall";
import { JOB_HOURS } from "../src/sim/90-actions/presence";
import { cancelWorkOrder, frontOf, orderWork, workOrdersTick, doneAt } from "../src/sim/90-actions/work-orders";
import { at, customer, ok, ownHall, rack, zone, type OwnHall } from "./own-dc-hall";
import { buyDevice } from "../src/sim/90-actions/hardware";
import { mountDevice } from "../src/sim/90-actions/hardware";
import { settle } from "./fixtures";
import { tickMinute } from "../src/sim/88-tick/tick";

const tech = (e: OwnHall, id: string, skill = 50): Employee => {
  const t: Employee = { id, name: id, role: "technician", skill, talent: 50, salary: 3000, hiredAt: 0, assignment: "queue", location: e.hallId, trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 1e9, refusedAt: null, team: e.s.teams[0].id, worked: 0, desk: null };
  e.s.staff.push(t);
  return t;
};
// A hall with one customer rack on a colocation zone, and the given technicians.
function hall(skills: number[] = [50]) {
  const e = ownHall();
  e.s.hour = at(2013, 3, 4, 10);
  const z = zone(e, "colo", 2, 2, 6);
  e.hall().customers.push(customer(e, 1, { x: 2, y: 2, facing: "s" }, z));
  skills.forEach((k, i) => tech(e, `t${i}`, k));
  return e;
}
// Runs the day booking on many days and counts the jobs booked; the queue is emptied between days.
const booked = (e: OwnHall, days: number): number => {
  let n = 0;
  for (let d = 0; d < days; d++) { e.s.hour = at(2013, 3, 4) + d * 24; e.s.orders = []; handsTick(e.s); n += e.s.orders.filter((o) => o.customerId).length; }
  return n;
};
// HALL is shared by every test; the value is put back.
const withChance = (chance: number, fn: () => void) => { const was = HALL.hands.chance; HALL.hands.chance = chance; try { fn(); } finally { HALL.hands.chance = was; } };

describe("own datacenter: customers' remote hands", () => {
  it("books about 1.5 jobs a month at the going rate, none at twice the rate and none without a technician", () => {
    const e = hall();
    const going = goingHandsRate(e.s.locations.find((l) => l.id === e.hallId)!.city);
    expect(going).toBeGreaterThan(0);
    const year = booked(e, 360);
    expect(year / 12).toBeGreaterThan(1);
    expect(year / 12).toBeLessThan(2.2);
    setHandsRate(e.s, e.hallId, going * 2);
    expect(booked(e, 360)).toBe(0);
    const none = hall([]);
    expect(booked(none, 360)).toBe(0);
  });

  // A customer job queued behind a started one on the same technician.
  const twoJobs = (e: OwnHall) => {
    e.s.hour = at(2013, 3, 4) + 24;
    withChance(1, () => handsTick(e.s));
    orderWork(e.s, "t0", e.hallId, {}, null, { kind: "hands", workMin: 60, customerId: e.hall().customers[0].id, fee: 0 });
    return e.s.orders.filter((o) => o.customerId);
  };

  it("refuses to cancel a started customer job and keeps it queued", () => {
    const e = hall(), [first] = twoJobs(e);
    expect(first.startAt).toBeLessThanOrEqual(Math.floor(e.s.hour * 60));
    expect(cancelWorkOrder(e.s, first.id)).toMatchObject({ ok: false, error: "error.jobStarted" });
    expect(e.s.orders.some((o) => o.id === first.id)).toBe(true);
    expect(e.hall().customers[0].leaveBump).toBe(0);
  });

  it("cancels a queued customer job and raises the customer's leave pressure", () => {
    const e = hall(), [, second] = twoJobs(e);
    expect(cancelWorkOrder(e.s, second.id)).toMatchObject({ ok: true });
    expect(e.s.orders.some((o) => o.id === second.id)).toBe(false);
    expect(e.hall().customers[0].leaveBump).toBe(HALL.hands.leaveBump);
  });

  it("cancels the player's own order without a leave bump", () => {
    const e = hall();
    const r = orderWork(e.s, "t0", e.hallId, {}, null, { kind: "mount", workMin: 30 });
    if (!r.ok) throw new Error(r.error);
    expect(cancelWorkOrder(e.s, r.id!)).toMatchObject({ ok: true });
    expect(e.hall().customers[0].leaveBump).toBe(0);
  });

  it("declines a third open job with one technician and upsets the customer", () => {
    const e = hall();
    withChance(1, () => {
      const events = [1, 2, 3].flatMap((d) => { e.s.hour = at(2013, 3, 4) + d * 24; return handsTick(e.s); });
      expect(e.s.orders.filter((o) => o.customerId)).toHaveLength(HALL.hands.perTech);
      expect(events.map((v) => v.key)).toEqual(["event.handsDeclined"]);
      expect(e.hall().customers[0].leaveBump).toBe(HALL.hands.leaveBump);
    });
  });

  it("marks a job unstarted for 4 hours as late and bumps the leave chance", () => {
    const e = hall();
    withChance(1, () => handsTick(e.s));
    const o = e.s.orders.find((x) => x.customerId)!;
    o.startAt = o.queuedAt + 600;
    workOrdersTick(e.s, o.queuedAt + HALL.hands.dueHours * 60 - 1);
    expect(e.hall().customers[0].leaveBump).toBe(0);
    workOrdersTick(e.s, o.queuedAt + HALL.hands.dueHours * 60);
    expect(e.hall().customers[0].leaveBump).toBe(HALL.hands.leaveBump);
    workOrdersTick(e.s, o.queuedAt + HALL.hands.dueHours * 60 + 30);
    expect(e.hall().customers[0].leaveBump).toBe(HALL.hands.leaveBump);
  });

  it("fails about 10% of a skill 0 technician's jobs with no fee", () => {
    const e = hall([0]);
    const events: string[] = [], cash = e.s.cash, c = e.hall().customers[0], fee = 100, n = 600;
    for (let i = 0; i < n; i++) {
      orderWork(e.s, "t0", e.hallId, { tile: c.tile! }, null, { kind: "hands", what: "cable", workMin: 1, customerId: c.id, fee });
      for (let m = 0; m < 5; m++) events.push(...tickMinute(e.s).map((v) => v.key));
    }
    const failed = events.filter((k) => k === "event.handsFailed").length;
    expect(failed / n).toBeGreaterThan(0.05);
    expect(failed / n).toBeLessThan(0.16);
    expect(e.s.cash - cash).toBe((n - failed) * fee);
  });

  it("bills the billed hours times the rate on completion and stands the technician at the customer's rack", () => {
    const e = hall([50]);
    const c = e.hall().customers[0], going = goingHandsRate(e.s.locations.find((l) => l.id === e.hallId)!.city);
    setHandsRate(e.s, e.hallId, 150);
    withChance(1, () => handsTick(e.s));
    const o = e.s.orders.find((x) => x.customerId)!, cash = e.s.cash;
    expect(o.fee).toBe(cents(JOB_HOURS[o.what as "cable" | "mount" | "parts"] * 150));
    expect(going).toBeGreaterThan(0);
    const mid = o.startAt! + o.walkMin + o.workMin / 2, [f] = figuresIn(e.s, e.hallId, mid);
    expect(f).toMatchObject({ id: "t0", pose: "work", progress: 0.5 });
    expect(f.tile).toMatchObject({ x: frontOf(customerSpots(e.hall(), c)[0]).x, y: frontOf(customerSpots(e.hall(), c)[0]).y });
    expect(e.s.cash).toBe(cash);
    settle(e.s);
    expect(e.s.cash).toBe(cash + o.fee!);
    expect(e.s.ledger.at(-1)).toMatchObject({ key: "ledger.hallHands", amount: o.fee });
    expect(doneAt(o)).toBeGreaterThan(o.startAt!);
  });

  it("sends the player's hands-on work in an unvisited hall to its technician for free and refuses a sixth order", () => {
    const e = hall([50]);
    const id = rack(e, 10, 6, "s"), cash = e.s.cash, hallRack = e.s.racks.find((r) => r.locationId === e.hallId)!.id;
    expect(id).toBeTruthy();
    const devs = Array.from({ length: 6 }, () => ok(buyDevice(e.s, "edge-m", "Sysko", 1, e.hallId)));
    const cashAfterBuy = e.s.cash;
    devs.slice(0, 5).forEach((d, i) => ok(mountDevice(e.s, d, hallRack, 1 + i)));
    expect(e.s.orders.filter((o) => o.worker === "t0" && o.action)).toHaveLength(5);
    expect(mountDevice(e.s, devs[5], hallRack, 9)).toEqual({ ok: false, error: "error.queueFull" });
    settle(e.s, 24 * 60);
    expect(devs.slice(0, 5).every((d) => e.s.devices.find((x) => x.id === d)!.rackId === hallRack)).toBe(true);
    expect(e.s.cash).toBe(cashAfterBuy);
    expect(cash).toBeGreaterThanOrEqual(cashAfterBuy);
  });
});
