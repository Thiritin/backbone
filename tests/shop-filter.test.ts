import { describe, expect, it } from "vitest";
import { shopModels } from "../src/sim/10-catalog/hardware";
import { CORES, matchesFilter, NO_FILTER, RAMS } from "../src/ui/apps/shop/filter";

const models = (year: number) => shopModels(year).filter((m) => m.server);
const left = (year: number, p: object) => models(year).filter((m) => matchesFilter(m, { ...NO_FILTER, ...p }));

describe("shop filter", () => {
  it("an empty filter keeps every model", () => {
    expect(left(2014, {})).toHaveLength(models(2014).length);
  });
  it("each dimension keeps only matching specs", () => {
    expect(left(2014, { form: "2U" }).every((m) => m.height === 2 && !m.shelf)).toBe(true);
    expect(left(2014, { cores: 16 }).every((m) => m.server!.cores >= 16)).toBe(true);
    expect(left(2014, { ram: 256 }).every((m) => m.server!.ramGb >= 256)).toBe(true);
    expect(left(2014, { disk: "SSD" }).every((m) => m.server!.disk === "SSD")).toBe(true);
    expect(left(2014, { form: "2U", cores: 16, disk: "SSD" }).length).toBeLessThan(left(2014, { form: "2U" }).length);
  });
  it("stricter steps never add models", () => {
    for (const [k, steps] of [["cores", CORES], ["ram", RAMS]] as const) {
      const n = steps.map((v) => left(2014, { [k]: v }).length);
      expect(n).toEqual([...n].sort((a, b) => b - a));
    }
  });
  it("2005 sells towers", () => {
    expect(left(2005, { form: "Tower" }).length).toBeGreaterThan(0);
  });
});
