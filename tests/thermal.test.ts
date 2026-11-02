import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { inletTemperature } from "../src/sim/60-infra/sensors";
import { cpuLoad, rackPower } from "../src/sim/60-infra/status";
import { THERMAL, thermalTick } from "../src/sim/60-infra/thermal";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { failureChance, tick } from "../src/sim/88-tick/tick";
import { BASEMENT_SERVER, readyGame, runServers } from "./fixtures";

// Busy servers run at full load, so they draw their rated watts.
beforeEach(() => { vi.spyOn(cpuLoad, "of").mockReturnValue(1); });
afterEach(() => { vi.restoreAllMocks(); });

// The basement turned into one datacenter position holding the basement server and extra copies of it.
function hall(copies: number): GameState {
  const s = readyGame(1);
  s.locations = s.locations.map((l) => (l.id === "loc1" ? { ...l, dc: "equinox-fr5", space: "cage", positions: 1 } : l));
  s.racks = s.racks.map((r) => (r.id === "rack2" ? { ...r, flatKw: 20 } : r));
  const base = s.devices.find((d) => d.id === BASEMENT_SERVER)!;
  for (let i = 0; i < copies; i++) s.devices.push({ ...base, id: `hot${i}`, slot: 2 + i, name: `hot-${i}`, hostname: `hot${i}` });
  runServers(s);
  return s;
}
const dev = (s: GameState, id = BASEMENT_SERVER) => s.devices.find((d) => d.id === id)!;

describe("cooling and overheating", () => {
  it("heats a dense hall faster than a sparse one while its cooling is out", () => {
    const dense = hall(12), sparse = hall(0);
    expect(rackPower(dense, "rack2").watts).toBeGreaterThan(3000);
    for (const s of [dense, sparse]) {
      s.ops.cooling = { loc1: s.hour + 1 };
      thermalTick(s, 10);
    }
    expect(dense.ops.heat.loc1).toBeGreaterThan(4 * sparse.ops.heat.loc1);
    expect(sparse.ops.heat.loc1).toBeGreaterThan(0);
  });

  it("shuts the servers off within minutes, then boots them and records an incident once the hall is cool", () => {
    const s = hall(12);
    const start = s.hour;
    s.ops.cooling = { loc1: start + 1.5 };
    const events = tick(s);
    expect(events.some((e) => e.key === "event.overheated")).toBe(true);
    expect(dev(s).on).toBe(false);
    expect(dev(s).overheatedAt! - start * 60).toBeLessThan(30);
    expect(dev(s).log.some((l) => l.key === "ipmi.log.overheat")).toBe(true);

    tick(s);
    expect(dev(s).on).toBe(true);
    expect(dev(s).overheatedAt).toBeUndefined();
    expect(dev(s).bootUntil).toBeGreaterThan(s.hour - 1);
    expect(s.ops.heat.loc1).toBeUndefined();
    const inc = s.ops.incidents.at(-1)!;
    expect(inc.cause).toBe("heat");
    expect(inc.dark).toBeGreaterThan(30);
    expect(inc.devices).toContain(dev(s).name);
  });

  it("throttles a server above 35 degrees and counts its hot hours into its failure rate", () => {
    const s = hall(0);
    const perf = nodeUsage(s, BASEMENT_SERVER).perf;
    s.ops.heat = { loc1: 17 };
    expect(inletTemperature(s, dev(s))).toBeGreaterThanOrEqual(THERMAL.throttleC);
    expect(inletTemperature(s, dev(s))).toBeLessThan(THERMAL.shutdownC);
    expect(nodeUsage(s, BASEMENT_SERVER).perf).toBeCloseTo(perf * THERMAL.throttlePerf);

    s.ops.cooling = { loc1: s.hour + 2 };
    tick(s);
    expect(dev(s).on).toBe(true);
    expect(dev(s).hotHours).toBe(1);
    const c = dev(s).components[0];
    const before = failureChance(s, dev(s), c);
    dev(s).hotHours = THERMAL.wearHours;
    expect(failureChance(s, dev(s), c)).toBeCloseTo(before * 2 / (1 + 1 / THERMAL.wearHours));
  });
});
