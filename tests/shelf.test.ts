import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { modelById } from "../src/sim/10-catalog/hardware";
import { newGame, type GameState } from "../src/sim/50-state";
import { freeSlots, linkStatus, locationOf, powered, rackPower, shelfId } from "../src/sim/60-infra/status";
import { connect, setPower, unmountDevice } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, runServers, withServer } from "./fixtures";
import { mountDevice, mountStack } from "./plugged";

const SHELF = shelfId("loc1");
const game = (): GameState => ({ ...withServer(newGame(1)), hour: hourOf(new Date(Date.UTC(2005, 0, 1))), cash: 1_000_000 });
const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const tower = (s: GameState) => ok(buyDevice(s, "g1-tower", "Dwell", 1, "loc1"));

describe("shelf", () => {
  it("gives the basement four places and no other location a shelf", () => {
    const s = game();
    expect(s.locations[0].shelf).toBe(4);
    expect(freeSlots(s, SHELF, 0)).toEqual([1, 2, 3, 4]);
  });

  it("holds a tower in a shelf place, in the basement", () => {
    const s = game();
    const id = tower(s);
    ok(mountDevice(s, id, SHELF, 2));
    expect(dev(s, id)).toMatchObject({ rackId: SHELF, slot: 2, store: null, name: "fra1-srv-02" });
    expect(locationOf(s, dev(s, id))?.id).toBe("loc1");
    expect(freeSlots(s, SHELF, 0)).toEqual([1, 3, 4]);
    expect(freeSlots(s, "rack2", 1)).not.toContain(1);
    ok(unmountDevice(s, id));
    expect(dev(s, id)).toMatchObject({ rackId: null, store: "loc1" });
  });

  it("refuses a fifth tower", () => {
    const s = game();
    const ids = Array.from({ length: 5 }, () => tower(s));
    ok(mountStack(s, "g1-tower", "Dwell", SHELF, 4));
    expect(err(mountDevice(s, ids[4], SHELF, 4))).toBe("error.slotTaken");
    expect(err(mountDevice(s, ids[4], SHELF, 5))).toBe("error.outOfBounds");
    expect(err(mountStack(s, "g1-tower", "Dwell", SHELF, 1))).toBe("error.noRoom");
  });

  it("keeps towers out of racks and rack servers off the shelf", () => {
    const s = game();
    const id = tower(s), rackServer = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(err(mountDevice(s, id, "rack2", 3))).toBe("error.towerNoRack");
    expect(err(mountStack(s, "g1-tower", "Dwell", "rack2", 1))).toBe("error.towerNoRack");
    expect(err(mountDevice(s, rackServer, SHELF, 1))).toBe("error.shelfTowerOnly");
    expect(err(mountStack(s, "g1-compute", "Dwell", SHELF, 1))).toBe("error.shelfTowerOnly");
  });

  it("draws from the basement circuit, cables to the router and trips with the rack", () => {
    const s = game();
    const id = tower(s);
    const idle = rackPower(s, "rack2").watts;
    ok(mountDevice(s, id, SHELF, 1));
    ok(setPower(s, id, true));
    expect(rackPower(s, "rack2").watts).toBe(idle + modelById("g1-tower").idleWatts);
    ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 1 }));
    s.hour += 2;
    expect(powered(s, id)).toBe(true);
    expect(linkStatus(s, id).online).toBe(true);
    // Eight 375 W servers fill the 3 kW circuit; the tower tips it over.
    for (let slot = 2; slot < 9; slot++) ok(mountDevice(s, ok(buyDevice(s, "g1-dense", "Dwell", 1, "loc1")), "rack2", slot));
    for (const d of s.devices) if (modelById(d.model).server && d.rackId) d.on = true;
    runServers(s);
    expect(rackPower(s, "rack2").tripped).toBe(true);
    expect(powered(s, id)).toBe(false);
  });

  it("loads an old save with an empty four-place shelf in the basement", () => {
    const s = game();
    const old = JSON.parse(serialize(s));
    for (const l of old.locations) delete l.shelf;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.locations.map((l) => l.shelf)).toEqual([4]);
    expect(freeSlots(loaded, SHELF, 0)).toEqual([1, 2, 3, 4]);
  });
});
