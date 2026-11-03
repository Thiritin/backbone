import { describe, expect, it } from "vitest";
import { CITIES } from "../src/ui/map/world-data";
import { ROADS } from "../src/ui/map/roads";
import { ROUTES } from "../src/ui/map/routes";

const city = (code: string) => CITIES.find((c) => c.code === code)!;
const near = (p: [number, number], c: { lon: number; lat: number }) => Math.abs(p[0] - c.lon) <= 0.5 && Math.abs(p[1] - c.lat) <= 0.5;

describe("travel data", () => {
  it("has roads", () => expect(ROADS.length).toBeGreaterThan(0));
  it("routes join two known cities, from before to, and stay compact", () => {
    for (const [key, line] of Object.entries(ROUTES)) {
      const [from, to] = key.split("-");
      expect(from < to, key).toBe(true);
      expect(city(from), key).toBeDefined();
      expect(city(to), key).toBeDefined();
      expect(line.length, key).toBeLessThanOrEqual(120);
      expect(near(line[0], city(from)), key).toBe(true);
      expect(near(line[line.length - 1], city(to)), key).toBe(true);
    }
  });
});
