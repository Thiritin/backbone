import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { GAME_TITLES, NEVER, latestRelease, pickTitle, resourcesOf, slotsFor, titleById, weightAt } from "../src/sim/10-catalog/games";
import { gameOf } from "../src/sim/60-infra/games";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("game titles", () => {
  it("arrive in their year and fade a quarter a year to a tenth", () => {
    const cs = titleById("counterstrife")!, pw = titleById("pallworld")!;
    expect(weightAt(pw, 2023)).toBe(0);
    expect(weightAt(pw, 2024)).toBe(pw.weight);
    expect(weightAt(cs, 2012)).toBe(cs.weight);
    expect(weightAt(cs, 2013)).toBeCloseTo(cs.weight * 0.75);
    expect(weightAt(cs, 2040)).toBeCloseTo(cs.weight * 0.1);
    expect(GAME_TITLES.filter((g) => g.fade === NEVER).length).toBeGreaterThan(0);
  });

  it("are drawn only from the titles of the year, the same for the same key", () => {
    for (let k = 0; k < 200; k++) expect(weightAt(titleById(pickTitle(1, k, 2006))!, 2006)).toBeGreaterThan(0);
    expect(pickTitle(1, 7, 2015)).toBe(pickTitle(1, 7, 2015));
    expect(new Set(Array.from({ length: 300 }, (_, k) => pickTitle(2, k, 2020))).size).toBeGreaterThan(4);
  });

  it("convert slots to resources and back without exceeding the RAM", () => {
    for (const g of GAME_TITLES) {
      const r = resourcesOf(g, 16);
      expect(slotsFor(g, r.ramGb)).toBe(Math.min(16, g.slots[1]));
      expect(slotsFor(g, 0.5) * g.perSlot.ramGb).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    expect(slotsFor(titleById("rost")!, 0.01)).toBe(1);
    expect(slotsFor(titleById("quackiii")!, 100)).toBe(32);
  });

  it("know their newest release of a year", () => {
    const g = titleById("blockcraft")!;
    expect([2010, 2012, 2013, 2020, 2030].map((y) => latestRelease(g, y))).toEqual([0, 0, 1, 3, 4]);
  });

  it("leave a save from before them without games, every service legacy", () => {
    const s = newGame(1), old = JSON.parse(serialize(s));
    delete old.gameServers;
    const back = deserialize(JSON.stringify(old));
    expect(back.gameServers).toEqual([]);
    expect(gameOf(back, "svc1")).toBeNull();
  });
});
