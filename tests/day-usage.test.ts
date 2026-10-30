import { describe, expect, it } from "vitest";
import { curveFor, curveLoad, daySwing, PRIVATE_BLOGS, TRAFFIC_USE } from "../src/sim/10-catalog/usage";

// Hour 0 is a Saturday midnight.
const at = (day: number, h: number) => day * 24 + h;
const SAT = 0, SUN = 1, MON = 2, TUE = 3;

describe("usage by day", () => {
  it("weights each kind of site by weekday: gamers on Saturday, shops on Sunday, news on Monday", () => {
    expect(curveLoad("game", at(SAT, 20))).toBeGreaterThan(curveLoad("game", at(SUN, 20)));
    expect(curveLoad("shop", at(SUN, 20))).toBeGreaterThan(curveLoad("shop", at(SAT, 20)));
    expect(curveLoad("news", at(MON, 7))).toBeGreaterThan(curveLoad("news", at(TUE, 7)));
  });

  it("swings a service's day by up to 15% so no two days look the same", () => {
    const days = Array.from({ length: 28 }, (_, d) => daySwing(5, "w1", at(d, 12)));
    expect(new Set(days).size).toBe(28);
    expect(Math.min(...days)).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...days)).toBeLessThanOrEqual(1.15);
    expect(daySwing(5, "w1", at(3, 0))).toBe(daySwing(5, "w1", at(3, 23)));
  });

  it("gives most private customers a personal page that barely loads and sends a tenth of its traffic", () => {
    const curves = Array.from({ length: 400 }, (_, i) => curveFor("webHosting", "private", 5, `c${i}`));
    const blogs = curves.filter((c) => c === "blog").length / curves.length;
    expect(blogs).toBeGreaterThan(PRIVATE_BLOGS - 0.07);
    expect(blogs).toBeLessThan(PRIVATE_BLOGS + 0.07);
    expect(curves.filter((c) => c !== "blog").every((c) => c === "personal")).toBe(true);
    expect(Math.max(...Array.from({ length: 168 }, (_, h) => curveLoad("personal", h)))).toBeLessThan(0.1);
    expect(TRAFFIC_USE.personal).toBe(0.1);
    expect(curveFor("gameServer", "private", 5, "c1")).toBe("game");
  });
});
