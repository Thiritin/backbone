import { afterEach, describe, expect, it, vi } from "vitest";
import { cpuTemperature, inletTemperature, sensorsOf } from "../src/sim/60-infra/sensors";
import { cpuLoad, drawWatts, rackPower } from "../src/sim/60-infra/status";
import { cpuUtil } from "../src/sim/60-infra/usage";
import { BASEMENT_SERVER, readyGame } from "./fixtures";

const setup = () => {
  const s = readyGame(1), d = s.devices.find((x) => x.id === BASEMENT_SERVER)!;
  d.on = true;
  return { s, d };
};

afterEach(() => vi.restoreAllMocks());

describe("load-based power draw", () => {
  it("draws idle, midpoint and rated watts at 0, 50 and 100% CPU, and the rack follows", () => {
    const { s, d } = setup(), busy = new Set([d.id]);
    const at = (u: number) => { vi.spyOn(cpuLoad, "of").mockReturnValue(u); return drawWatts(s, d, busy); };
    const idle = at(0), half = at(0.5), full = at(1);
    expect(drawWatts(s, d, new Set())).toBeCloseTo(idle);
    expect(half).toBeCloseTo((idle + full) / 2);
    expect(full).toBeGreaterThan(idle);
  });

  it("reads a node's utilisation from its workloads", () => {
    const { s, d } = setup();
    const u = cpuUtil(s, d);
    expect(u).toBeGreaterThan(0);
    expect(u).toBeLessThanOrEqual(1);
  });

  it("raises the rack's draw with the server's load", () => {
    const { s, d } = setup();
    vi.spyOn(cpuLoad, "of").mockReturnValue(0);
    const low = rackPower(s, d.rackId!).watts;
    vi.spyOn(cpuLoad, "of").mockReturnValue(1);
    expect(rackPower(s, d.rackId!).watts).toBeGreaterThan(low);
  });
});

describe("CPU temperature and fan curve", () => {
  it("runs 20 degrees over the inlet at full load with low fans, hotter and faster with two failed fans", () => {
    const { s, d } = setup();
    vi.spyOn(cpuLoad, "of").mockReturnValue(1);
    const healthy = sensorsOf(s, d);
    expect(healthy.cpuC).toBeCloseTo(inletTemperature(s, d) + 20, 0);
    expect(healthy.cpuC).toBeLessThan(50);
    expect(healthy.fanDuty).toBe(30);
    const fans = d.components.filter((c) => c.kind === "fan");
    expect(fans.length).toBeGreaterThanOrEqual(2);
    fans.slice(0, 2).forEach((c) => (c.failedAt = s.hour));
    const hot = sensorsOf(s, d);
    expect(hot.cpuC).toBeCloseTo(inletTemperature(s, d) + 40, 0);
    expect(hot.fanDuty).toBeGreaterThan(healthy.fanDuty);
    expect(hot.fans.filter((f) => f.rpm === 0)).toHaveLength(2);
    expect(Math.max(...hot.fans.map((f) => f.rpm))).toBeGreaterThan(Math.max(...healthy.fans.map((f) => f.rpm)));
  });

  it("follows the server's real load and sits at the inlet when off", () => {
    const { s, d } = setup();
    expect(cpuTemperature(s, d)).toBeCloseTo(inletTemperature(s, d) + 20 * cpuUtil(s, d), 0);
    d.on = false;
    expect(cpuTemperature(s, d)).toBe(inletTemperature(s, d));
    expect(sensorsOf(s, d).fanDuty).toBe(0);
  });
});
