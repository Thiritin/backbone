import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { UI_LOOKS, versionsOf } from "../src/sim/10-catalog/software-versions";
import { lookOf } from "../src/sim/60-infra/licence";
import { eraAt, erasFrom } from "../src/ui/apps/browser/consoles/PanelBase";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const CPANIC = erasFrom(2005, 2014);
const cpanicHost = (year: number) => {
  const s = withServer(newGame(1));
  skipTo(s, year);
  const id = panelServer(s, BASEMENT_SERVER, "cpanic"), c = s.clusters.find((x) => x.id === id)!;
  return { s, c };
};

describe("console look by installed version", () => {
  it("names catalog versions in release order, starting at each product's first", () => {
    for (const [product, gens] of Object.entries(UI_LOOKS)) {
      const at = gens.map(([v]) => versionsOf(product).findIndex((x) => x.version === v));
      expect(at[0], product).toBe(0);
      expect(at.every((i, n) => i > (at[n - 1] ?? -1)), product).toBe(true);
    }
  });

  it("keeps the old look for an old version in a late year", () => {
    const { s, c } = cpanicHost(2006);
    expect(s.devices.find((d) => d.id === BASEMENT_SERVER)!.software.find((x) => x.id === "cpanic")!.version).toBe("10");
    s.hour = hourOfMonth("2020-01");
    expect(lookOf(s, BASEMENT_SERVER, "cpanic")).toBe("early");
    expect(eraAt(CPANIC, { game: s, c })).toBe("early");
  });

  it("shows the late look for a version from its generation", () => {
    const { s, c } = cpanicHost(2016);
    expect(lookOf(s, BASEMENT_SERVER, "cpanic")).toBe("late");
    expect(eraAt(CPANIC, { game: s, c })).toBe("late");
  });

  it("falls back to the game year when the version is unknown", () => {
    const { s, c } = cpanicHost(2006);
    s.devices.find((d) => d.id === BASEMENT_SERVER)!.software.find((x) => x.id === "cpanic")!.version = "unknown";
    expect(lookOf(s, BASEMENT_SERVER, "cpanic")).toBeNull();
    expect(eraAt(CPANIC, { game: s, c })).toBe("early");
    s.hour = hourOfMonth("2020-01");
    expect(eraAt(CPANIC, { game: s, c })).toBe("late");
  });
});
