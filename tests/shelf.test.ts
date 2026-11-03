import { describe, expect, it } from "vitest";
import { rackTiles } from "../src/sim/20-world/layout";
import { buyRack, mountDevice, stock } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "../src/sim/50-state";
import { racked } from "./fixtures";
import { err, ok } from "./pmx";

const funded = (seed: number) => { const s = newGame(seed); s.cash = 50_000; return s; };
// A device already in the basement's storage.
const stored = (s: ReturnType<typeof newGame>, model: string, brand = "Dwell") => stock(s, { model, brand, qty: 1 }, null, "loc1")[0];
const basement = (s: ReturnType<typeof newGame>) => s.locations.find((l) => l.space === "basement")!;

describe("shelf", () => {
  it("starts a new game with the shelf and the router on its top board", () => {
    const s = newGame(1);
    expect(s.racks).toHaveLength(1);
    expect(s.racks[0]).toMatchObject({ id: "rack2", model: "shelf", name: "Shelf", price: 0 });
    expect(s.devices.find((d) => d.id === "dev5")).toMatchObject({ rackId: "rack2", slot: 5, store: null });
    expect(rackTiles(basement(s), s.racks).rack2).toEqual({ x: 5, y: 0, facing: "s" });
  });

  it("puts a 1U and a 2U server on one board each", () => {
    const s = funded(2);
    const one = stored(s, "g1-compute"), two = stored(s, "g1-memory");
    ok(mountDevice(s, one, "rack2", 1));
    ok(mountDevice(s, two, "rack2", 2));
    expect(s.devices.find((d) => d.id === two)).toMatchObject({ rackId: "rack2", slot: 2 });
    const three = stored(s, "g1-compute");
    expect(err(mountDevice(s, three, "rack2", 2))).toBe("error.slotTaken");
    ok(mountDevice(s, three, "rack2", 3));
  });

  it("refuses a patch panel", () => {
    const s = funded(3);
    const id = stored(s, "patch-24", "Sysko");
    expect(err(mountDevice(s, id, "rack2", 1))).toBe("error.needsRails");
  });

  it("takes two racks in the basement and refuses a third", () => {
    const s = funded(4);
    const a = ok(buyRack(s, "loc1", "rack-24", 2)), b = ok(buyRack(s, "loc1", "rack-24", 3));
    const tiles = rackTiles(basement(s), s.racks);
    expect([tiles[a], tiles[b]]).toEqual([{ x: 6, y: 0, facing: "s" }, { x: 7, y: 0, facing: "s" }]);
    s.locations[0] = { ...s.locations[0], positions: 4 };
    expect(err(buyRack(s, "loc1", "rack-24", 4))).toBe("error.basementRacksFull");
    expect(err(buyRack(s, "loc1", "shelf", 4))).toBe("error.shelfStands");
  });

  it("loads an old save with its 24U rack unchanged", () => {
    const s = { ...racked(newGame(5)), cash: 1000 };
    s.locations[0].positions = 1;
    const loaded = deserialize(serialize(s));
    expect(loaded.racks).toEqual(s.racks);
    expect(basement(loaded).positions).toBe(3);
    ok(buyRack(loaded, "loc1", "shelf", 2));
  });
});
