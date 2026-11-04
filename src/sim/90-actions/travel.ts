// The player drives or flies to a location to do hand work there; the computer stays locked until they arrive.
import { COUNTRY, datacenterById } from "../20-world/datacenters";
import { PLACES, placeOf, type LatLon } from "../20-world/places";
import type { GameState } from "../50-state";
import { BOOKED_HOURS, playerAt, trip } from "../60-infra/handwork";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export type TravelMode = "drive" | "fly";
// Countries across the sea from the mainland: a trip into or out of one flies.
const ISLANDS = new Set(["GB", "IE"]);
// A flight: taxis and the airport at both ends, the flight at cruise speed, a fare per great-circle km with a floor.
export const FLIGHT = { transferHours: 3, kmh: 800, perKm: 0.35, minFee: 180 } as const;

export function greatCircleKm(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function flight(km: number): { hours: number; fee: number } {
  return { hours: Math.ceil(FLIGHT.transferHours + km / FLIGHT.kmh), fee: Math.round(Math.max(FLIGHT.minFee, km * FLIGHT.perKm)) };
}

const spot = (s: GameState, id: string, city: string): LatLon | undefined => placeOf(s, id) ?? PLACES.find((p) => p.city === city);

// The hours, fee and mode of the trip to a location, a booked visit included; null when it is overseas.
export function drive(s: GameState, locationId: string): { hours: number; fee: number; by: TravelMode } | null {
  const here = playerAt(s), loc = s.locations.find((l) => l.id === locationId), t = loc && trip(here.city, loc.city);
  if (!loc || !t) return null;
  const booked = loc.dc && datacenterById(loc.dc).visitBooking ? BOOKED_HOURS : 0;
  const a = spot(s, here.id, here.city), b = spot(s, loc.id, loc.city);
  if (COUNTRY[here.city] !== COUNTRY[loc.city] && (ISLANDS.has(COUNTRY[here.city]) || ISLANDS.has(COUNTRY[loc.city])) && a && b) {
    const f = flight(greatCircleKm(a, b));
    return { hours: f.hours + booked, fee: f.fee, by: "fly" };
  }
  return { hours: t.hours + booked, fee: t.fee, by: "drive" };
}

export function travelTo(s: GameState, locationId: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.noLocation");
  if (s.player.until > s.hour) return fail("error.away");
  if (playerAt(s).id === loc.id) return fail("error.alreadyThere");
  if (loc.readyAt > s.hour) return fail("error.locationNotReady");
  const d = drive(s, loc.id);
  if (!d) return fail("error.tooFar");
  if (s.cash < d.fee) return fail("error.noCash");
  s.cash = Math.round((s.cash - d.fee) * 100) / 100;
  s.ledger.push({ hour: s.hour, category: "travel", key: d.by === "fly" ? "ledger.fly" : "ledger.drive", params: { place: loc.name }, amount: -d.fee });
  s.player = { ...s.player, at: loc.id, until: s.hour + d.hours, doing: "travel", by: d.by };
  return { ok: true };
}
