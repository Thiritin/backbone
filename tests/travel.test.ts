// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CITIES } from "../src/ui/map/world-data";
import { BASEMENT_PLACE, PLACES } from "../src/sim/20-world/places";
import { decode } from "../src/ui/map/streets/decode";
import { along, arc, driveMs, driveOf, km, next, routeOf, type LL, type Stage, type TripEvent } from "../src/ui/travel/route";

const city = (code: string) => CITIES.find((c) => c.code === code)!;

describe("travel", () => {
  it("finds a stored route both ways", () => {
    const [a, b] = [CITIES[0], CITIES[1]].sort((p, q) => (p.code < q.code ? -1 : 1));
    const line: LL[] = [[a.lon, a.lat], [7, 50], [b.lon, b.lat]], routes = { [`${a.code}-${b.code}`]: line };
    expect(routeOf(a.name, b.name, routes)).toEqual(line);
    expect(routeOf(b.name, a.name, routes)).toEqual([...line].reverse());
  });

  it("draws a great-circle arc when no route is stored", () => {
    const fra = city("fra"), ker = city("ker");
    const r = routeOf(fra.name, ker.name, {});
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

  it("splices the street legs onto the city route", () => {
    const fra = city("fra"), nur = city("nur"), dc = PLACES.find((p) => p.id === "hetzler-nbg")!;
    const trunk: LL[] = [[fra.lon, fra.lat], [9, 50], [9.5, 49.9], [10, 49.8], [nur.lon, nur.lat]];
    const head: LL[] = [[BASEMENT_PLACE.lon, BASEMENT_PLACE.lat], [8.7, 50.1], [8.95, 50.0]];
    const into: LL[] = [[dc.lon, dc.lat], [11.06, 49.44], [10.1, 49.8]];
    const data = { routes: { "fra-nur": trunk }, legs: { "basement>nur": head, "hetzler-nbg>fra": into } };
    const line = driveOf({ city: "Frankfurt", place: BASEMENT_PLACE }, { city: "Nuremberg", place: dc }, data);
    expect(line).toEqual([...head, [9.5, 49.9], ...into.slice().reverse()]);
    const local: LL[] = [[1, 1], [2, 2]];
    const zeil = PLACES.find((p) => p.id === "zeilwerk")!;
    expect(driveOf({ city: "Frankfurt", place: zeil }, { city: "Frankfurt", place: BASEMENT_PLACE }, { routes: {}, legs: { "basement~zeilwerk": local } })).toEqual([[2, 2], [1, 1]]);
    expect(driveOf({ city: "Frankfurt", place: null }, { city: "Nuremberg", place: null }, data)).toEqual([[fra.lon, fra.lat], ...trunk, [nur.lon, nur.lat]]);
  });

  it("decodes packed street lines", () => {
    expect(decode("_p~iF~ps|U_ulLnnqC _mqNvxq`@")).toEqual([[[-120.2, 38.5], [-120.95, 40.7]], [[-126.453, 43.252]]]);
  });
});
