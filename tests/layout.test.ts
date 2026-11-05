import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import {
  cage, entryTile, FIXTURES, fixtures, fixtureTiles, freeRackTiles, LOBBY_W, neighbourRacks, officeFloors, officePlan, officeSeats, officeWalk, rackTiles, roomSize, SECTION_H, SECTION_W,
  walkways, wallTiles, type Fixture,
} from "../src/sim/20-world/layout";
import { listingById } from "../src/sim/20-world/properties";
import { desks } from "../src/sim/60-infra/properties";
import { freeSections, refitSection, rentSection } from "../src/sim/90-actions/properties";
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
    expect(roomSize(loc)).toEqual({ w: 9, h: 7 });
    expect(wallTiles(loc)).toHaveLength(2);
    const walls = new Set(wallTiles(loc).map(key));
    for (const f of Object.values(FIXTURES.basement)) expect(walls.has(key(f))).toBe(false);
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
    // The near row of the old four-wall layout.
    s.racks[0].tile = { x: 3, y: 8, facing: "n" };
    const loaded = deserialize(serialize(s));
    const tiles = rackTiles(basement(loaded), loaded.racks);
    const walls = new Set(wallTiles(loc).map(key));
    expect(walls.has("3,8")).toBe(false);
    for (const r of loaded.racks.filter((x) => x.locationId === loc.id)) expect(walls.has(key(tiles[r.id]))).toBe(true);
    expect(new Set(Object.values(tiles).map(key)).size).toBe(Object.keys(tiles).length);
  });

  it("moves racks of a 12 by 9 basement save onto the 9 by 7 room", () => {
    const s = newGame(13);
    twoRacks(s);
    const loc = basement(s);
    // Far wall and right column tiles of the old 12 by 9 basement.
    s.racks[0].tile = { x: 10, y: 0, facing: "s" };
    s.racks[1].tile = { x: 11, y: 6, facing: "w" };
    const loaded = deserialize(serialize(s));
    const tiles = rackTiles(basement(loaded), loaded.racks);
    const walls = new Set(wallTiles(loc).map(key));
    for (const r of loaded.racks.filter((x) => x.locationId === loc.id)) expect(walls.has(key(tiles[r.id]))).toBe(true);
    expect(new Set(Object.values(tiles).map(key)).size).toBe(Object.keys(tiles).length);
  });

  it("puts every wall tile along the far wall and the two side walls", () => {
    const loc = basement(newGame(12)), { w } = roomSize(loc);
    for (const t of wallTiles(loc)) expect(t.y === 0 ? t.facing === "s" : t.x === 0 ? t.facing === "e" : t.x === w - 1 && t.facing === "w").toBe(true);
    for (const f of Object.values(FIXTURES.basement)) expect(f.x >= 0 && f.x < w && f.y >= 0 && f.y < roomSize(loc).h).toBe(true);
  });

  it("places a rack on a free wall tile and refuses a taken or inner one", () => {
    const s = newGame(9);
    const loc = basement(s);
    const [a] = s.racks;
    const free = freeRackTiles(loc, s.racks)[0];
    expect(placeRack(s, a.id, { ...free, facing: "n" })).toEqual({ ok: true, id: a.id });
    expect(a.tile).toEqual(free);
    expect(rackTiles(loc, s.racks)[a.id]).toEqual(free);
    twoRacks(s);
    const b = s.racks[1], tiles = rackTiles(loc, s.racks);
    expect(placeRack(s, a.id, tiles[b.id])).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, a.id, { x: 5, y: 4, facing: "n" })).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, a.id, { ...FIXTURES.basement.door, facing: "n" })).toEqual({ ok: false, error: "error.tileTaken" });
    expect(placeRack(s, "nope", free)).toEqual({ ok: false, error: "error.unknownRack" });
  });

  it("puts a bought rack on a free tile and a moved rack on one in its new room", () => {
    const s = { ...newGame(10), cash: 100_000 };
    const r = addLocation(s, "interaction-fra", "cage", 4);
    if (!r.ok) throw new Error(r.error);
    const loc = s.locations.find((l) => l.id === r.id)!;
    loc.readyAt = s.hour;
    const bought = [1, 2].map((p) => {
      const res = buyRack(s, loc.id, "rack-47", p);
      if (!res.ok) throw new Error(res.error);
      return s.racks.find((x) => x.id === res.id)!;
    });
    expect(roomSize(loc)).toEqual({ w: 14, h: 11 });
    expect(bought[0].tile).toEqual(wallTiles(loc)[0]);
    expect(bought[1].tile).toEqual(wallTiles(loc)[1]);
    const old = s.racks[0];
    old.tile = { ...wallTiles(basement(s))[5] };
    expect(moveRack(s, old.id, loc.id, 3).ok).toBe(true);
    expect(old.tile).toEqual(wallTiles(loc)[2]);
  });

  // interaction-fra runs hot and cold aisles, hetzler-park does not.
  for (const dc of ["interaction-fra", "hetzler-park"])
    for (const [space, size] of [["share", 1], ["cage", 4], ["cage", 8], ["cage", 16], ["suite", 20], ["suite", 40]] as const) {
      it(`lays out a ${space} of ${size} at ${dc} with its fixtures inside and room for every rack`, () => {
        const loc = { ...basement(newGame(20)), id: "loc9", dc, space, positions: size };
        const { w, h } = roomSize(loc);
        const fixed = fixtureTiles(loc);
        for (const f of fixed) expect(f.x >= 0 && f.y >= 0 && f.x < w && f.y < h).toBe(true);
        expect(new Set(fixed.map(key)).size).toBe(fixed.length);
        const spots = wallTiles(loc), others = neighbourRacks(loc), taken = new Set(fixed.map(key));
        expect(spots.length).toBeGreaterThanOrEqual(loc.positions);
        const all = [...spots, ...others];
        expect(new Set(all.map(key)).size).toBe(all.length);
        for (const t of all) expect(taken.has(key(t)) || t.x < 0 || t.y < 0 || t.x >= w || t.y >= h).toBe(false);
        const entry = entryTile(loc);
        expect(taken.has(key(entry)) || all.some((t) => key(t) === key(entry))).toBe(false);
        for (const a of walkways(loc)) expect(all.some((t) => t.y === a.y)).toBe(false);
        expect(Object.keys(FIXTURES[space])).toEqual(expect.arrayContaining(["door", "cooling", "shelf", "extinguisher", "pdu", "cart"]));
        expect(Object.keys(FIXTURES[space])).not.toContain("xconnect");
        // The player's racks are one contiguous run per row, their fronts in view.
        for (const y of new Set(spots.map((t) => t.y))) {
          const xs = spots.filter((t) => t.y === y).map((t) => t.x);
          expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(xs.length);
        }
        expect(spots.some((t) => t.facing === "s")).toBe(true);
        const facings = new Set(all.map((t) => t.facing));
        expect(facings).toEqual(new Set(dc === "hetzler-park" ? ["s"] : ["s", "n"]));
        expect(others.length > 0).toBe(space !== "suite");
        const c = cage(loc);
        expect(!!c).toBe(space === "cage");
        if (c) {
          for (const t of spots) expect(t.x > c.x0 && t.x < c.x1 && t.y > c.y0 && t.y < c.y1).toBe(true);
          for (const t of others) expect(t.x < c.x0 || t.x > c.x1 || t.y < c.y0 || t.y > c.y1).toBe(true);
        }
      });
    }

  for (const dc of ["interaction-fra", "hetzler-park"])
    for (const [space, size] of [["share", 1], ["cage", 8], ["suite", 20]] as const) {
      it(`gives a loaded ${space} rack at ${dc} on a tile of an older layout a new rack tile`, () => {
        const s = newGame(22);
        const loc = { ...basement(s), id: "loc9", dc, space, positions: size };
        s.locations.push(loc);
        s.racks.push({ ...structuredClone(s.racks[0]), id: "rack8", locationId: loc.id, position: 1, tile: { x: 5, y: 2, facing: "s" } });
        s.racks.push({ ...structuredClone(s.racks[0]), id: "rack9", locationId: loc.id, position: 2, tile: { x: 2, y: 0, facing: "s" } });
        const loaded = deserialize(serialize(s));
        const tiles = rackTiles(loaded.locations.find((l) => l.id === loc.id)!, loaded.racks);
        const spots = new Set(wallTiles(loc).map(key));
        const mine = ["rack8", "rack9"].filter((id) => tiles[id]);
        expect(mine.length).toBe(Math.min(2, spots.size));
        for (const id of mine) expect(spots.has(key(tiles[id]))).toBe(true);
        expect(new Set(mine.map((id) => key(tiles[id]))).size).toBe(mine.length);
      });
    }

  it("puts the suite's NOC desk in front of every rack row, where no rack hides it", () => {
    const loc = { ...basement(newGame(20)), id: "loc9", dc: "interaction-fra", space: "suite" as const, positions: 40 };
    const noc = FIXTURES.suite.noc;
    expect(Math.max(...wallTiles(loc).map((t) => t.y))).toBeLessThan(noc.y - 1);
  });

  it("moves a loaded cage rack off a tile that is no longer a rack tile", () => {
    const s = { ...newGame(21), cash: 100_000 };
    const r = addLocation(s, "interaction-fra", "cage", 4);
    if (!r.ok) throw new Error(r.error);
    const loc = s.locations.find((l) => l.id === r.id)!;
    loc.readyAt = s.hour;
    for (const p of [1, 2]) { const res = buyRack(s, loc.id, "rack-47", p); if (!res.ok) throw new Error(res.error); }
    const here = s.racks.filter((x) => x.locationId === loc.id);
    // A wall tile of the old bare-floor layout, and the door.
    here[0].tile = { x: 0, y: 3, facing: "e" };
    here[1].tile = { ...FIXTURES.cage.door, facing: "e" };
    const loaded = deserialize(serialize(s));
    const tiles = rackTiles(loaded.locations.find((l) => l.id === loc.id)!, loaded.racks);
    const spots = new Set(wallTiles(loc).map(key));
    for (const x of here) expect(spots.has(key(tiles[x.id]))).toBe(true);
    expect(new Set(here.map((x) => key(tiles[x.id]))).size).toBe(2);
  });
});

describe("office room", () => {
  const office = (n: number) => {
    const s = newGame(31);
    s.cash = 5_000_000;
    s.hour = hourOf(new Date(Date.UTC(2012, 2, 12, 10)));
    expect(rentSection(s, "zeilwerk", freeSections(s, listingById("zeilwerk")!)[0]).ok).toBe(true);
    const p = s.properties.at(-1)!;
    // More sections than any listing has free, three to a floor.
    p.sections = Array.from({ length: n }, (_, i) => ({ ...p.sections[0], id: `${Math.floor(i / 3) + 1}.${(i % 3) + 1}`, floor: Math.floor(i / 3) + 1 }));
    return { s, p, loc: s.locations.find((l) => l.id === p.locationId)! };
  };
  const tiles = (fx: Record<string, Fixture>, kind: RegExp) =>
    Object.entries(fx).filter(([id, f]) => kind.test(f.kind ?? id)).flatMap(([, f]) => Array.from({ length: f.w ?? 1 }, (_, i) => key({ x: f.x + i, y: f.y })));

  for (const n of [1, 2, 5]) {
    it(`builds consistent rooms from ${n} section(s) with a seat per desk`, () => {
      const { s, p, loc } = office(n), floors = officeFloors(p.sections), plan = officePlan(s, loc)!;
      expect(officeSeats(plan)).toHaveLength(desks(s));
      expect(desks(s)).toBe(4 * n);
      for (const floor of floors) {
        const fp = { ...plan, floor }, { w, h } = roomSize(loc, fp), fx = fixtures(loc, fp);
        const count = p.sections.filter((x) => x.floor === floor).length;
        expect(w).toBe(count * SECTION_W + (floor === p.sections[0].floor ? LOBBY_W : 0));
        expect(h).toBe(SECTION_H);
        for (const t of fixtureTiles(loc, fp)) expect(t.x >= 0 && t.y >= 0 && t.x < w && t.y < h).toBe(true);
        const solid = tiles(fx, /^(odesk|ochair|chair|reception|kitchen|bossdesk|printer|plant)/);
        expect(new Set(solid).size).toBe(solid.length);
        expect(solid).not.toContain(key(entryTile(loc, fp)));
        expect(!!fx.stairs).toBe(floors.length > 1);
        expect(!!fx.letterbox).toBe(floor === p.sections[0].floor);
        for (const seat of officeSeats(plan).filter((x) => x.floor === floor)) {
          const path = officeWalk(plan, seat), end = path.at(-1)!;
          expect(end).toEqual({ x: seat.x + 0.5, y: seat.y + 0.5 });
          for (let i = 1; i < path.length; i++) {
            const a = path[i - 1], b = path[i];
            expect(a.x === b.x || a.y === b.y).toBe(true);
            for (let k = 0; k <= 8; k++) {
              const q = { x: Math.floor(a.x + ((b.x - a.x) * k) / 8), y: Math.floor(a.y + ((b.y - a.y) * k) / 8) };
              if (i < path.length - 1 || k < 8) expect(tiles(fx, /^(odesk|reception|kitchen|bossdesk|printer|plant|bin)/)).not.toContain(key(q));
            }
          }
        }
      }
    });
  }

  it("turns a server section into four rack tiles a bought rack stands on", () => {
    const { s, p, loc } = office(2), sec = p.sections[1];
    expect(refitSection(s, p.id, sec.id, "servers").ok).toBe(true);
    const plan = officePlan(s, loc)!, fx = fixtures(loc, { ...plan, floor: sec.floor });
    expect(fx[`buckets${sec.id}`]).toBeDefined();
    expect(desks(s)).toBe(4);
    s.hour += 24 * 14;
    loc.readyAt = s.hour;
    expect(wallTiles(loc, officePlan(s, loc))).toHaveLength(4);
    const r = buyRack(s, loc.id, "rack-47", 1);
    if (!r.ok) throw new Error(r.error);
    expect(s.racks.find((x) => x.id === r.id)!.tile).toEqual(wallTiles(loc, officePlan(s, loc))[0]);
    expect(fixtures(loc, officePlan(s, loc, sec.floor))[`buckets${sec.id}`]).toBeUndefined();
  });
});
