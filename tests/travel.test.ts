// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { addLocation, buyRack, moveServer, shipStock } from "../src/sim/90-actions/hardware";
import { useStore } from "../src/ui/store";
import { useTrip } from "../src/ui/travel/route";
import { drive, flight, FLIGHT, greatCircleKm, travelTo } from "../src/sim/90-actions/travel";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, newGame, withServer } from "./fixtures";
import { COUNTRY, DATACENTERS, listed } from "../src/sim/20-world/datacenters";
import { CITIES } from "../src/ui/map/world-data";
import { BASEMENT_PLACE, PLACES } from "../src/sim/20-world/places";
import { decode } from "../src/ui/map/streets/decode";
import { along, arc, driveMs, driveOf, km, next, routeOf, type LL, type Stage, type TripEvent } from "../src/ui/travel/route";

const city = (code: string) => CITIES.find((c) => c.code === code)!;

describe("travel", () => {
  it("lists only datacenters in European cities", () => {
    const shown = DATACENTERS.filter((d) => listed(d.city));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.filter((d) => !["DE", "NL", "GB", "FR", "IT", "AT", "CH"].includes(COUNTRY[d.city])).map((d) => d.city)).toEqual([]);
  });

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

  it("plays a job done in person from the desktop as the trip instead of skipping the clock", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const dc = (addLocation(s, "interaction-fra", "cage", 4) as { id: string }).id;
    for (const l of s.locations) l.readyAt = 0;
    buyRack(s, dc, "rack-42", 1);
    for (const r of s.racks) r.arriveAt = null;
    useStore.setState({ game: s, surface: "desktop", speed: 1 });
    const hour = s.hour;
    expect(useStore.getState().act(moveServer, ["dev3"], dc, "self").ok).toBe(true);
    const st = useStore.getState();
    expect(useTrip.getState()).toMatchObject({ stage: "leave", trip: { from: { id: "loc1" }, to: { id: dc }, resume: 1, by: "drive" } });
    expect(st).toMatchObject({ surface: "world", speed: 0 });
    expect(st.game.hour).toBe(hour);
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

describe("unready locations", () => {
  const rented = () => {
    const s: GameState = { ...newGame(1), cash: 100_000 };
    const r = addLocation(s, "interaction-fra", "cage", 4);
    if (!r.ok) throw new Error(r.error);
    return { s, loc: r.id! };
  };

  it("refuses a visit until the space is handed over", () => {
    const { s, loc } = rented(), cash = s.cash, player = { ...s.player };
    expect(s.locations.find((l) => l.id === loc)!.readyAt).toBeGreaterThan(s.hour);
    expect(travelTo(s, loc)).toEqual({ ok: false, error: "error.locationNotReady" });
    expect([s.cash, s.player]).toEqual([cash, player]);
    s.hour = s.locations.find((l) => l.id === loc)!.readyAt;
    expect(travelTo(s, loc).ok).toBe(true);
  });

  it("takes no shipment by courier or by hand", () => {
    const { s, loc } = rented();
    expect(buyDevice(s, "g1-compute", "Dwell", 1, "loc1").ok).toBe(true);
    const id = s.devices.find((d) => d.store === "loc1")!.id;
    for (const self of [false, true]) expect(shipStock(s, [id], loc, self)).toEqual({ ok: false, error: "error.locationNotReady" });
  });
});

describe("trip mode", () => {
  const at = (dc: string, space: "share" | "cage" = "cage") => {
    const s: GameState = { ...newGame(1), cash: 100_000 };
    const r = addLocation(s, dc, space, space === "cage" ? 4 : 1);
    if (!r.ok) throw new Error(r.error);
    for (const l of s.locations) l.readyAt = 0;
    return { s, loc: r.id! };
  };

  it("flies across the sea and drives on the mainland, by the flight table", () => {
    const lon = at("globalsnitch-lon"), dist = greatCircleKm(BASEMENT_PLACE, DATACENTERS.find((d) => d.id === "globalsnitch-lon")!);
    expect(Math.round(dist)).toBe(635);
    expect(flight(dist)).toEqual({ hours: Math.ceil(FLIGHT.transferHours + dist / FLIGHT.kmh), fee: Math.round(dist * FLIGHT.perKm) });
    expect(drive(lon.s, lon.loc)).toEqual({ hours: 4, fee: 222, by: "fly" });
    expect(flight(100)).toEqual({ hours: 4, fee: FLIGHT.minFee });
    expect(drive(at("hetzler-nbg", "share").s, at("hetzler-nbg", "share").loc)).toEqual({ hours: 4, fee: 90, by: "drive" });
  });

  it("stores the mode and books the flight", () => {
    const { s, loc } = at("globalsnitch-lon"), cash = s.cash;
    expect(travelTo(s, loc).ok).toBe(true);
    expect(s.player).toMatchObject({ at: loc, by: "fly", until: s.hour + 4 });
    expect(s.cash).toBe(cash - 222);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.fly", amount: -222 });
    expect(deserialize(serialize(s)).player.by).toBe("fly");
    const old = JSON.parse(serialize(s));
    delete old.player.by;
    expect(deserialize(JSON.stringify(old)).player.by).toBe("drive");
  });
});
