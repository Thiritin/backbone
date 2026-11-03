import { describe, expect, it } from "vitest";
import { FIXTURES, freeRackTiles, rackTiles, roomSize, wallTiles } from "../src/sim/20-world/layout";
import type { GameState } from "../src/sim/50-state";
import { addLocation, buyRack, moveRack } from "../src/sim/90-actions/hardware";
import { placeRack } from "../src/sim/90-actions/layout";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const basement = (s: GameState) => s.locations.find((l) => l.space === "basement")!;
const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;
// A second basement rack so distinctness is tested on more than one.
const twoRacks = (s: GameState) => s.racks.push({ ...structuredClone(s.racks[0]), id: "rack9", position: 2 });

describe("rack tiles", () => {
  it("gives a new game's basement racks distinct wall tiles off the fixtures", () => {
    const s = newGame(7);
    twoRacks(s);
    const loc = basement(s);
    expect(roomSize(loc)).toEqual({ w: 12, h: 9 });
    const walls = new Set(wallTiles(loc).map(key));
    for (const f of Object.values(FIXTURES)) expect(walls.has(key(f))).toBe(false);
    const tiles = Object.values(rackTiles(loc, s.racks));
    expect(tiles).toHaveLength(2);
    expect(new Set(tiles.map(key)).size).toBe(2);
    for (const t of tiles) expect(walls.has(key(t))).toBe(true);
    expect(freeRackTiles(loc, s.racks)).toHaveLength(walls.size - 2);
  });

  it("assigns tiles to a loaded save without them", () => {
    const s = newGame(8);
    twoRacks(s);
    for (const r of s.racks) delete r.tile;
    const loaded = deserialize(serialize(s));
    const tiles = rackTiles(basement(loaded), loaded.racks);
    expect(Object.keys(tiles).sort()).toEqual(loaded.racks.map((r) => r.id).sort());
    expect(tiles).toEqual(rackTiles(basement(s), s.racks));
  });

  it("moves a loaded rack off a tile that is no longer against a wall", () => {
    const s = newGame(11);
    twoRacks(s);
    const loc = basement(s);
    // The near-side column of the old four-wall layout.
    s.racks[0].tile = { x: 11, y: 3, facing: "w" };
    const loaded = deserialize(serialize(s));
    const tiles = rackTiles(basement(loaded), loaded.racks);
    const walls = new Set(wallTiles(loc).map(key));
    expect(walls.has("11,3")).toBe(false);
    for (const r of loaded.racks.filter((x) => x.locationId === loc.id)) expect(walls.has(key(tiles[r.id]))).toBe(true);
    expect(new Set(Object.values(tiles).map(key)).size).toBe(Object.keys(tiles).length);
  });

  it("puts every wall tile on the two far sides", () => {
    const loc = basement(newGame(12));
    for (const t of wallTiles(loc)) expect(t.y === 0 ? t.facing === "s" : t.x === 0 && t.facing === "e").toBe(true);
    for (const f of Object.values(FIXTURES)) expect(f.x === 0 || f.y === 0).toBe(true);
  });

  it("places a rack on a free wall tile and refuses a taken or inner one", () => {
    const s = newGame(9);
    twoRacks(s);
    const loc = basement(s);
    const [a, b] = s.racks;
    const tiles = rackTiles(loc, s.racks);
    const free = freeRackTiles(loc, s.racks)[3];
    expect(placeRack(s, a.id, { ...free, facing: "n" })).toEqual({ ok: true, id: a.id });
    expect(a.tile).toEqual(free);
    expect(rackTiles(loc, s.racks)[a.id]).toEqual(free);
    expect(placeRack(s, a.id, tiles[b.id])).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, a.id, { x: 5, y: 4, facing: "n" })).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, a.id, { ...FIXTURES.door, facing: "n" })).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, "nope", free)).toEqual({ ok: false, error: "error.unknownRack" });
  });

  it("puts a bought rack on a free tile and a moved rack on one in its new room", () => {
    const s = newGame(10);
    const r = addLocation(s, "interaction-fra", "cage", 4);
    if (!r.ok) throw new Error(r.error);
    const loc = s.locations.find((l) => l.id === r.id)!;
    loc.readyAt = s.hour;
    const bought = [1, 2].map((p) => {
      const res = buyRack(s, loc.id, "rack-47", p);
      if (!res.ok) throw new Error(res.error);
      return s.racks.find((x) => x.id === res.id)!;
    });
    expect(roomSize(loc)).toEqual({ w: 16, h: 12 });
    expect(bought[0].tile).toEqual(wallTiles(loc)[0]);
    expect(bought[1].tile).toEqual(wallTiles(loc)[1]);
    const old = s.racks[0];
    old.tile = { ...wallTiles(basement(s))[5] };
    expect(moveRack(s, old.id, loc.id, 3).ok).toBe(true);
    expect(old.tile).toEqual(wallTiles(loc)[2]);
  });
});
