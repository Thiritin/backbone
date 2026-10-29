import { describe, expect, it } from "vitest";
import { dualPsuModel } from "../src/sim/10-catalog/hardware";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { BOOT_HOURS, deviceHealth, installedRamGb } from "../src/sim/60-infra/status";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addLocation, addSecondPsu, buyRack, installPart, removePart, setPower, type CartLine } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { hire, queueOperation } from "../src/sim/90-actions/staff";
import { mountDevice } from "./plugged";
import { withServer } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000 });
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const kinds = (s: GameState, id: string, kind: string) => dev(s, id).components.filter((c) => c.kind === kind);
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
// A server racked above the starting one; bare and extras are the cart line's.
function rack(s: GameState, rest: Pick<CartLine, "bare" | "extras"> = {}, model = "g1-compute", at = 10): string {
  const id = ok(buyDevice(s, model, "Dwell", 1, "loc1", rest));
  ok(mountDevice(s, id, "rack2", at));
  return id;
}
const spare = (s: GameState, kind: string, size?: number, ff?: string, loc = "loc1") =>
  ok(buyDevice(s, `part-${kind}`, "Generic", 1, loc, size === undefined && !ff ? {} : { part: { kind: kind as "ram", size, ...(ff ? { ff: ff as "3.5" } : {}) } }));
// A spare the shop of the year does not sell.
const forged = (s: GameState, kind: string, size: number, ff: string) => {
  const id = spare(s, "ram", 2);
  Object.assign(dev(s, id), { model: `part-${kind}`, part: { kind, size, ff } });
  return id;
};
const HDD = { kind: "hdd" as const, size: 500, ff: "3.5", qty: 1 };

describe("installing parts", () => {
  it("needs the server off for RAM, takes 30 minutes and leaves it off", () => {
    const s = rich();
    const id = rack(s, { bare: true });
    const ram = spare(s, "ram", 2);
    expect(err(installPart(s, id, ram))).toBe("error.powerOffFirst");
    ok(setPower(s, id, false));
    ok(installPart(s, id, ram));
    expect(dev(s, id).maintenance).toMatchObject({ doneAt: s.hour + 0.5 });
    expect(kinds(s, id, "ram")).toHaveLength(1);
    expect(kinds(s, id, "ram")[0]).toMatchObject({ size: 2, installedAt: s.hour, failedAt: null });
    expect(s.devices.some((d) => d.id === ram)).toBe(false);
    expect(installedRamGb(dev(s, id))).toBe(2);
    expect(deviceHealth(s, id).state).toBe("off");
    expect(err(installPart(s, id, spare(s, "ram", 2)))).toBe("error.busy");
    run(s, 1);
    expect(dev(s, id).maintenance).toBeNull();
    expect(dev(s, id).on).toBe(false);
    ok(setPower(s, id, true));
    expect(dev(s, id).bootUntil).toBe(s.hour + BOOT_HOURS);
  });

  it("swaps a drive into a RAID array with the server running and starts a rebuild", () => {
    const s = rich();
    const id = rack(s, { extras: [HDD] });
    expect(dev(s, id).raid).toBe("1");
    ok(installPart(s, id, spare(s, "hdd", 500, "3.5")));
    expect(dev(s, id).on).toBe(true);
    expect(dev(s, id).maintenance).toBeNull();
    expect(kinds(s, id, "hdd")).toHaveLength(3);
    expect(dev(s, id).rebuild?.componentId).toBe(kinds(s, id, "hdd")[2].id);
    expect(deviceHealth(s, id).state).toBe("rebuilding");
    // Without an array the same drive needs the server off.
    const single = rack(s, {}, "g1-compute", 12);
    expect(dev(s, single).raid).toBe("none");
    expect(err(installPart(s, single, spare(s, "hdd", 500, "3.5")))).toBe("error.powerOffFirst");
  });

  it("puts in fans and a second power supply while running, and the build follows the supplies", () => {
    const s = rich();
    const id = rack(s);
    const fan = kinds(s, id, "fan")[0].id;
    ok(removePart(s, id, fan));
    expect(kinds(s, id, "fan")).toHaveLength(3);
    ok(installPart(s, id, spare(s, "fan")));
    expect(kinds(s, id, "fan")).toHaveLength(4);
    expect(dev(s, id).maintenance).toBeNull();
    const psu = ok(installPart(s, id, spare(s, "psu")));
    expect(dev(s, id).model).toBe("g1-compute-2psu");
    expect(dev(s, id).components.find((c) => c.id === psu)!.plugged).toBe(false);
    ok(removePart(s, id, psu));
    expect(dev(s, id).model).toBe("g1-compute");
    expect(dualPsuModel("g1-compute")).toBeDefined();
  });

  it("refuses parts beyond the slots and drives the bays do not take", () => {
    const s = rich();
    const id = rack(s, { bare: true, extras: [{ kind: "ram", size: 2, qty: 8 }] });
    ok(setPower(s, id, false));
    expect(err(installPart(s, id, spare(s, "ram", 2)))).toBe("error.noSlot");
    expect(err(installPart(s, id, spare(s, "cpu", 1), 1))).toBe("ok");
    expect(err(installPart(s, id, spare(s, "cpu", 1), 0))).toBe("error.partSlotTaken");
    run(s, 1);
    expect(err(installPart(s, id, spare(s, "cpu", 1), 5))).toBe("error.unknownSlot");
    expect(err(installPart(s, id, forged(s, "nvme", 1000, "nvme")))).toBe("error.wrongFormFactor");
    expect(err(installPart(s, id, forged(s, "hdd", 500, "2.5")))).toBe("error.wrongFormFactor");
    expect(err(installPart(s, id, spare(s, "ram", 2, undefined, "loc1")))).toBe("error.noSlot");
    expect(err(installPart(s, "dev3", spare(s, "hdd", 500, "3.5")))).toBe("error.powerOffFirst");
  });

  it("takes parts from the zone's own storage only", () => {
    const s = rich();
    const loc = ok(addLocation(s, "interaction-fra", "positions", 1));
    s.locations.find((l) => l.id === loc)!.readyAt = 0;
    const id = rack(s, { bare: true });
    ok(setPower(s, id, false));
    expect(err(installPart(s, id, spare(s, "ram", 2, undefined, loc)))).toBe("error.noPart");
    expect(err(installPart(s, id, "nope"))).toBe("error.noPart");
    expect(err(installPart(s, "nope", "nope"))).toBe("error.unknownDevice");
  });

  it("works on a server in storage at once", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1", { bare: true }));
    ok(installPart(s, id, spare(s, "cpu", 1)));
    ok(installPart(s, id, spare(s, "cpu", 1)));
    expect(dev(s, id).maintenance).toBeNull();
    expect(kinds(s, id, "cpu")).toHaveLength(2);
    expect(err(installPart(s, id, spare(s, "cpu", 1)))).toBe("error.noSlot");
  });

  it("bills remote hands at a datacenter and waits for them", () => {
    const s = rich();
    const loc = ok(addLocation(s, "interaction-fra", "positions", 1));
    s.locations.find((l) => l.id === loc)!.readyAt = 0;
    const r = ok(buyRack(s, loc, "rack-42", 1));
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc, { bare: true }));
    ok(mountDevice(s, id, r, 1));
    ok(setPower(s, id, false));
    const ram = spare(s, "ram", 2, undefined, loc), cash = s.cash;
    ok(installPart(s, id, ram));
    expect(s.cash).toBe(cash - 120);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.remoteHands", amount: -120 });
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + 2.5);
  });
});

describe("removing parts", () => {
  it("needs the server off for RAM and returns the stick to storage with its size", () => {
    const s = rich();
    const id = rack(s);
    const stick = kinds(s, id, "ram")[0];
    expect(err(removePart(s, id, stick.id))).toBe("error.powerOffFirst");
    ok(setPower(s, id, false));
    ok(removePart(s, id, stick.id));
    expect(kinds(s, id, "ram")).toHaveLength(3);
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + 0.5);
    expect(s.devices.filter((d) => d.model === "part-ram" && d.store === "loc1")).toMatchObject([{ part: { kind: "ram", size: 2 } }]);
    // The spare goes back into the same chassis.
    run(s, 1);
    ok(installPart(s, id, s.devices.find((d) => d.model === "part-ram")!.id));
    expect(kinds(s, id, "ram")).toHaveLength(4);
  });

  it("scraps a failed part and refuses a soldered one", () => {
    const s = rich();
    const id = rack(s);
    const fan = kinds(s, id, "fan")[0];
    fan.failedAt = 1;
    ok(removePart(s, id, fan.id));
    expect(s.devices.some((d) => d.model === "part-fan")).toBe(false);
    expect(err(removePart(s, id, kinds(s, id, "board")[0].id))).toBe("error.notRemovable");
    expect(err(removePart(s, id, kinds(s, id, "nic")[0].id))).toBe("error.notRemovable");
    expect(err(removePart(s, id, "c999"))).toBe("error.unknownComponent");
  });

  it("keeps a RAID array at the drives its level needs", () => {
    const s = rich();
    const id = rack(s, { extras: [HDD] });
    expect(err(removePart(s, id, kinds(s, id, "hdd")[1].id))).toBe("error.raidLevel");
    ok(installPart(s, id, spare(s, "hdd", 500, "3.5")));
    ok(removePart(s, id, kinds(s, id, "hdd")[2].id));
    expect(kinds(s, id, "hdd")).toHaveLength(2);
    expect(dev(s, id).rebuild).toBeNull();
    expect(s.devices.filter((d) => d.model === "part-hdd" && d.store === "loc1")).toMatchObject([{ part: { kind: "hdd", size: 500, ff: "3.5" } }]);
  });
});

describe("the second power supply", () => {
  it("is an install of a power supply, paid at the price difference", () => {
    const s = rich();
    const id = rack(s);
    const cash = s.cash;
    ok(addSecondPsu(s, id));
    expect(dev(s, id).model).toBe("g1-compute-2psu");
    expect(cash - s.cash).toBe(250);
    expect(kinds(s, id, "psu")).toHaveLength(2);
    expect(s.devices.some((d) => d.model === "part-psu")).toBe(false);
    expect(err(addSecondPsu(s, id))).toBe("error.noSecondPsu");
  });
});

describe("technicians", () => {
  it("install a part: shut down, put it in, start again", () => {
    const s = rich();
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const tech = ok(hire(s, c.id));
    s.staff = s.staff.map((e) => (e.id === tech ? { ...e, trained: ["hardware"] } : e));
    const id = rack(s, { bare: true });
    const ram = spare(s, "ram", 2);
    s.hour = 48 + 9 - 1;
    ok(queueOperation(s, "part", id, null, ram));
    expect(err(queueOperation(s, "part", id, null, ram))).toBe("error.alreadyQueued");
    const events = run(s, 8);
    expect(kinds(s, id, "ram")).toHaveLength(1);
    expect(dev(s, id).on).toBe(true);
    expect(s.techOps).toEqual([]);
    expect(events.map((e) => e.key)).toContain("event.techInstalled");
    // Taking it out again runs the same way, the next morning.
    s.hour = 48 + 24 + 9 - 1;
    ok(queueOperation(s, "part", id, kinds(s, id, "ram")[0].id));
    const more = run(s, 8);
    expect(kinds(s, id, "ram")).toHaveLength(0);
    expect(more.map((e) => e.key)).toContain("event.techRemoved");
    expect(s.devices.filter((d) => d.model === "part-ram" && d.store === "loc1")).toHaveLength(1);
  });
});
