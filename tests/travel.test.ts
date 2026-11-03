// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/ui/map/routes";
import { CITIES } from "../src/ui/map/world-data";
import { along, arc, driveMs, km, next, routeOf, type Stage, type TripEvent } from "../src/ui/travel/route";

const city = (code: string) => CITIES.find((c) => c.code === code)!;

describe("travel", () => {
  it("finds a stored route both ways", () => {
    const [a, b] = [CITIES[0], CITIES[1]].sort((p, q) => (p.code < q.code ? -1 : 1));
    const key = `${a.code}-${b.code}`, had = ROUTES[key];
    ROUTES[key] = [[a.lon, a.lat], [7, 50], [b.lon, b.lat]];
    try {
      expect(routeOf(a.name, b.name)).toEqual(ROUTES[key]);
      expect(routeOf(b.name, a.name)).toEqual([...ROUTES[key]].reverse());
    } finally {
      if (had) ROUTES[key] = had; else delete ROUTES[key];
    }
  });

  it("draws a great-circle arc when no route is stored", () => {
    const fra = city("fra"), ker = city("ker"), had = ROUTES["fra-ker"];
    delete ROUTES["fra-ker"];
    const r = routeOf(fra.name, ker.name);
    if (had) ROUTES["fra-ker"] = had;
    expect(r.length).toBe(33);
    expect(r[0][0]).toBeCloseTo(fra.lon, 5);
    expect(r[32][1]).toBeCloseTo(ker.lat, 5);
    expect(km(r)).toBeGreaterThan(150);
    expect(arc([0, 0], [0, 0])).toHaveLength(2);
  });

  it("sizes the drive and walks the line by length", () => {
    expect(driveMs(0)).toBe(6000);
    expect(driveMs(900)).toBe(9000);
    expect(driveMs(5000)).toBe(12000);
    const p = along([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 3 }], 0.5);
    expect(p).toEqual({ x: 1, y: 1, deg: 90, i: 1 });
  });

  it("goes door, map, leave, road, arrive, room", () => {
    const seq: [TripEvent, Stage][] = [["door", "map"], ["done", "map"], ["pick", "leave"], ["close", "leave"], ["done", "road"], ["done", "arrive"], ["door", "arrive"], ["done", "room"]];
    let s: Stage = "room";
    for (const [e, want] of seq) expect((s = next(s, e))).toBe(want);
    expect(next("map", "close")).toBe("room");
  });
});
