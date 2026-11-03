import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { REGIONS } from "../src/sim/20-world/datacenters";
import { BASEMENT_PLACE, PLACES, placeOf } from "../src/sim/20-world/places";
import { listingById } from "../src/sim/20-world/properties";
import { freeSections, refitSection, rentSection } from "../src/sim/90-actions/properties";
import { CITIES } from "../src/ui/map/world-data";
import { newGame } from "./fixtures";

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  return 6371 * Math.hypot((b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), (b.lat - a.lat) * r);
};

describe("places", () => {
  it("gives every place its own spot within 15 km of its city", () => {
    for (const r of REGIONS) {
      const city = CITIES.find((c) => c.name === r.city)!, here = PLACES.filter((p) => p.city === r.city);
      for (const p of here) expect(km(p, city), p.id).toBeLessThan(15);
      expect(new Set(here.map((p) => `${p.lat},${p.lon}`)).size, r.city).toBe(here.length);
    }
    expect(PLACES.every((p) => REGIONS.some((r) => r.city === p.city))).toBe(true);
  });

  it("finds the place of the basement, a datacenter and an office", () => {
    const s = newGame(11);
    s.cash = 1_000_000;
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    expect(placeOf(s, "loc1")).toBe(BASEMENT_PLACE);
    expect(placeOf(s, "prop1")).toBe(BASEMENT_PLACE);
    s.locations.push({ ...s.locations[0], id: "locx", dc: "hetzler-nbg", city: "Nuremberg", space: "share" });
    expect(placeOf(s, "locx")).toMatchObject({ id: "hetzler-nbg", city: "Nuremberg" });
    const sec = freeSections(s, listingById("gallushof")!)[0];
    expect(rentSection(s, "gallushof", sec).ok).toBe(true);
    const prop = s.properties.find((p) => p.buildingId === "gallushof")!;
    expect(placeOf(s, prop.id)).toMatchObject({ id: "gallushof", lat: listingById("gallushof")!.lat });
    expect(refitSection(s, prop.id, sec, "servers").ok).toBe(true);
    expect(placeOf(s, prop.locationId!)?.id).toBe("gallushof");
    expect(placeOf(s, "nope")).toBeNull();
  });
});
