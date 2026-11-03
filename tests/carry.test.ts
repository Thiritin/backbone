import { describe, expect, it } from "vitest";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addLocation, buyDevice, mountDevice, sellDevice } from "../src/sim/90-actions/hardware";
import { installCarried, pickUp, putDown } from "../src/sim/90-actions/carry";
import { travelTo } from "../src/sim/90-actions/travel";
import { freeFloor, newGame } from "./fixtures";
import type { GameState } from "../src/sim/50-state";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r).toMatchObject({ ok: true }); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);

// The first order lands at once; the second ships and waits at the basement door.
function delivered(s: GameState): string {
  ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  while (s.devices.find((d) => d.id === id)!.arriveAt !== null) tick(s);
  return id;
}

describe("parcels and carrying", () => {
  it("lands a shipped unit at the door, outside storage", () => {
    const s = { ...newGame(7), cash: 100_000 }, id = delivered(s);
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ door: { at: "loc1", since: s.hour }, store: null, transitTo: null });
    expect(err(mountDevice(s, id, "rack2", 5))).toBe("error.alreadyMounted");
    expect(err(sellDevice(s, id))).toBe("error.notInStorage");
  });

  it("picks a parcel up, puts it on the shelf, and installs a carried unit", () => {
    const s = { ...newGame(7), cash: 100_000 }, id = delivered(s);
    expect(err(putDown(s))).toBe("error.handsEmpty");
    ok(pickUp(s, id));
    expect(s.player.carrying).toBe(id);
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ door: null, store: null });
    const other = s.devices.find((d) => d.store === "loc1" && d.model === "g1-compute")!;
    expect(err(pickUp(s, other.id))).toBe("error.handsFull");
    ok(putDown(s));
    expect(s.player.carrying).toBeNull();
    expect(s.devices.find((d) => d.id === id)!.store).toBe("loc1");
    ok(pickUp(s, id));
    expect(err(installCarried(s, "rack2", 99))).toBe("error.outOfBounds");
    expect(s.player.carrying).toBe(id);
    ok(installCarried(s, "rack2", 5));
    expect(s.player.carrying).toBeNull();
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ rackId: "rack2", slot: 5, store: null, door: null });
  });

  it("refuses a parcel at another location and travel while carrying", () => {
    const s = { ...newGame(7), cash: 100_000 }, id = delivered(s);
    const far = ok(addLocation(freeFloor(s), "hetzler-park", "share", 1));
    s.devices.find((d) => d.id === id)!.door = { at: far, since: s.hour };
    expect(err(pickUp(s, id))).toBe("error.notThere");
    s.devices.find((d) => d.id === id)!.door = { at: "loc1", since: s.hour };
    ok(pickUp(s, id));
    expect(err(travelTo(s, far))).toBe("error.carrying");
    ok(putDown(s));
    expect(err(travelTo(s, far))).not.toBe("error.carrying");
  });

  it("loads a save without a door or a hand slot", () => {
    const s = { ...newGame(7), cash: 100_000 }, id = delivered(s);
    const data = JSON.parse(serialize(s));
    delete data.player.carrying;
    for (const d of data.devices) delete d.door;
    const loaded = deserialize(JSON.stringify(data));
    expect(loaded.player.carrying).toBeNull();
    expect(loaded.devices.find((d) => d.id === id)!.door).toBeNull();
  });
});
