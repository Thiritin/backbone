import { describe, expect, it } from "vitest";
import { BORDERS, COUNTRIES, LAKES, RIVERS } from "../src/ui/map/world-geo";
import { CITIES } from "../src/ui/map/world-data";

const chunks = import.meta.glob<{ GEO: Record<string, [number, number][][]> }>("../src/ui/map/geo/*.ts", { eager: true });

describe("map geo data", () => {
  it("has world borders, rivers, lakes and country label points", () => {
    for (const d of [BORDERS, RIVERS, LAKES, COUNTRIES]) expect(d.length).toBeGreaterThan(100);
    expect(COUNTRIES.every(([iso]) => iso.length === 2)).toBe(true);
  });

  it("keeps every city chunk around its city with roads and green", () => {
    for (const [path, m] of Object.entries(chunks)) {
      const city = CITIES.find((c) => c.code === path.split("/").pop()!.replace(".ts", ""))!;
      expect(city, path).toBeTruthy();
      expect(m.GEO.major.length, path).toBeGreaterThan(0);
      for (const [lon, lat] of m.GEO.major[0]) {
        expect(Math.abs(lon - city.lon), path).toBeLessThan(0.5);
        expect(Math.abs(lat - city.lat), path).toBeLessThan(0.5);
      }
    }
  });
});
