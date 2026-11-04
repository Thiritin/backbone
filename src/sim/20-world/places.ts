import type { GameState } from "../50-state";
import { DATACENTERS } from "./datacenters";
import { listingById, LISTINGS } from "./properties";

export type LatLon = { lat: number; lon: number };
export interface Place extends LatLon { id: string; city: string }

// Kellerweg 3, a residential street in Frankfurt.
export const BASEMENT_PLACE: Place = { id: "basement", city: "Frankfurt", lat: 50.1155, lon: 8.6905 };

// Every spot a trip can start or end at; the routes script reads it as JSON.
export const PLACES: Place[] = [
  BASEMENT_PLACE,
  ...DATACENTERS.map(({ id, city, lat, lon }) => ({ id, city, lat, lon })),
  ...LISTINGS.map(({ id, region, lat, lon }) => ({ id, city: region, lat, lon })),
];

// The place a location or property stands at: its datacenter, the basement, or its office listing; null for one without a fixed spot.
export function placeOf(s: GameState, id: string): Place | null {
  const loc = s.locations.find((l) => l.id === id);
  if (loc?.dc) return PLACES.find((p) => p.id === loc.dc) ?? null;
  const prop = s.properties.find((p) => p.id === id || (loc && (p.locationId === loc.id || p.hall?.locationId === loc.id)));
  if (loc?.space === "basement" || prop?.kind === "basement") return BASEMENT_PLACE;
  const listing = prop?.buildingId ? listingById(prop.buildingId) : undefined;
  return listing ? PLACES.find((p) => p.id === listing.id)! : null;
}
