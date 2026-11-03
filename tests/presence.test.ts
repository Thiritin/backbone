import { describe, expect, it } from "vitest";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, connect, disconnect, mountDevice, type ActionResult } from "../src/sim/90-actions/hardware";
import { cancelHandsJob, hands, JOB_HOURS } from "../src/sim/90-actions/presence";
import { drive, travelTo } from "../src/sim/90-actions/travel";
import { buyDevice, freeFloor, newGame, withServer } from "./fixtures";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

// A cage at Equinox FR5 with an empty rack; the player stays home.
function colo() {
  const s: GameState = { ...withServer(newGame(7)), cash: 100_000 };
  const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
  const rack = ok(buyRack(s, loc, "rack-42", 1));
  s.locations.find((l) => l.id === loc)!.readyAt = s.hour;
  return { s, loc, rack, rh: datacenterById("equinox-fr5").remoteHands };
}

describe("presence", () => {
  it("mounts in the basement with own hands and refuses while away", () => {
    const { s, loc } = colo();
    const a = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1")), b = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    expect(hands(s, "loc1")).toBe("own");
    ok(mountDevice(s, a, "rack2", 10));
    expect(dev(s, a).rackId).toBe("rack2");
    s.player = { ...s.player, at: loc };
    expect(hands(s, "loc1")).toBe("none");
    expect(err(mountDevice(s, b, "rack2", 11))).toBe("error.notThere");
    expect(dev(s, b).rackId).toBeNull();
  });

  it("queues a mount at a colocation site as a remote hands job, billed when done", () => {
    const { s, loc, rack, rh } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    expect(hands(s, loc)).toBe("remote");
    const cash = s.cash;
    const job = ok(mountDevice(s, id, rack, 10));
    expect(dev(s, id).rackId).toBeNull();
    expect(s.handsJobs).toMatchObject([{ id: job, deviceId: id, dueAt: s.hour + rh.responseHours + JOB_HOURS.mount }]);
    run(s, rh.responseHours);
    expect(dev(s, id).rackId).toBeNull();
    run(s, 1);
    expect(dev(s, id)).toMatchObject({ rackId: rack, slot: 10, maintenance: null });
    expect(s.handsJobs).toEqual([]);
    const fee = JOB_HOURS.mount * rh.perHour;
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.remoteHands", amount: -fee });
    expect(s.ledger.filter((e) => e.key === "ledger.remoteHands")).toHaveLength(1);
    expect(cash - s.cash).toBeGreaterThanOrEqual(fee);
  });

  it("does it with own hands when the player stands at the site", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    s.player = { ...s.player, at: loc };
    ok(mountDevice(s, id, rack, 10));
    expect(dev(s, id).rackId).toBe(rack);
    expect(s.handsJobs).toEqual([]);
  });

  it("queues cabling the same way", () => {
    const { s, loc, rack, rh } = colo();
    const a = ok(buyDevice(s, "sw-8", "Sysko", 1, loc)), b = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(mountDevice(s, a, rack, 10, true));
    ok(mountDevice(s, b, rack, 11, true));
    const cables = s.cables.length;
    ok(connect(s, { device: a, port: 0 }, { device: b, port: 0 }));
    expect(s.cables.length).toBe(cables);
    run(s, rh.responseHours + 1);
    expect(s.cables.length).toBe(cables + 1);
    const cable = s.cables.at(-1)!.id;
    ok(disconnect(s, cable));
    expect(s.cables.some((c) => c.id === cable)).toBe(true);
    run(s, rh.responseHours + 1);
    expect(s.cables.some((c) => c.id === cable)).toBe(false);
    expect(s.ledger.filter((e) => e.key === "ledger.remoteHands").map((e) => e.amount)).toEqual([-JOB_HOURS.cable * rh.perHour, -JOB_HOURS.cable * rh.perHour]);
  });

  it("refuses work remote hands could not do", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    expect(err(mountDevice(s, id, rack, 99))).toBe("error.outOfBounds");
    expect(s.handsJobs).toEqual([]);
  });

  it("cancels a queued job before it runs", () => {
    const { s, loc, rack, rh } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    const job = ok(mountDevice(s, id, rack, 10));
    const cash = s.cash;
    ok(cancelHandsJob(s, job));
    expect(err(cancelHandsJob(s, job))).toBe("error.unknownOperation");
    run(s, rh.responseHours + 1);
    expect(dev(s, id).rackId).toBeNull();
    expect(s.ledger.some((e) => e.key === "ledger.remoteHands")).toBe(false);
    expect(s.cash).toBeLessThanOrEqual(cash);
  });

  it("queues own hands from afar, drives there and does it on arrival for free", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    const trip = drive(s, loc)!, cash = s.cash;
    const job = ok(mountDevice(s, id, rack, 10, "self"));
    expect(s.handsJobs).toMatchObject([{ id: job, deviceId: id, fee: 0, self: true }]);
    expect(s.player).toMatchObject({ at: loc, doing: "travel", until: s.hour + trip.hours });
    expect(cash - s.cash).toBe(trip.fee);
    run(s, trip.hours - 1);
    expect(dev(s, id).rackId).toBeNull();
    run(s, 2);
    expect(dev(s, id).rackId).toBe(rack);
    expect(s.handsJobs).toEqual([]);
    expect(s.ledger.some((e) => e.key === "ledger.remoteHands")).toBe(false);
  });

  it("does not drive again when already on the way there", () => {
    const { s, loc, rack } = colo();
    const a = ok(buyDevice(s, "sw-8", "Sysko", 1, loc)), b = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(travelTo(s, loc));
    const cash = s.cash, until = s.player.until;
    ok(mountDevice(s, a, rack, 10, "self"));
    ok(mountDevice(s, b, rack, 11, "self"));
    expect(s.cash).toBe(cash);
    expect(s.player.until).toBe(until);
    expect(s.handsJobs).toHaveLength(2);
  });

  it("does own hands at once when the player stands there", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    s.player = { ...s.player, at: loc };
    ok(mountDevice(s, id, rack, 10, "self"));
    expect(dev(s, id).rackId).toBe(rack);
    expect(s.handsJobs).toEqual([]);
  });

  it("cancels a queued own hands job", () => {
    const { s, loc, rack } = colo();
    const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    const job = ok(mountDevice(s, id, rack, 10, "self"));
    ok(cancelHandsJob(s, job));
    run(s, 48);
    expect(dev(s, id).rackId).toBeNull();
  });

  it("keeps an own hands job waiting while the player is elsewhere, also in the basement", () => {
    const { s, loc, rack } = colo();
    const home = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1")), far = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(mountDevice(s, far, rack, 10, "self"));
    run(s, drive(s, "loc1")!.hours + 24);
    expect(dev(s, far).rackId).toBe(rack);
    ok(mountDevice(s, home, "rack2", 10, "self"));
    expect(s.player).toMatchObject({ at: "loc1", doing: "travel" });
    expect(dev(s, home).rackId).toBeNull();
    // Turned back before arriving: the job waits until the player stands in the basement again.
    s.player = { ...s.player, at: loc, until: s.hour };
    run(s, 48);
    expect(dev(s, home).rackId).toBeNull();
    ok(travelTo(s, "loc1"));
    run(s, 48);
    expect(dev(s, home).rackId).toBe("rack2");
    expect(s.handsJobs).toEqual([]);
  });

  it("loads an old save with no jobs and keeps queued ones", () => {
    const { s, loc, rack } = colo();
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw.handsJobs;
    expect(deserialize(JSON.stringify(raw)).handsJobs).toEqual([]);
    ok(mountDevice(s, ok(buyDevice(s, "sw-8", "Sysko", 1, loc)), rack, 10));
    expect(deserialize(serialize(s)).handsJobs).toHaveLength(1);
  });
});
