import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { brandsFor, MODELS, modelById, partOffers, priceOf } from "../src/sim/10-catalog/hardware";
import { chassisPrice, CHASSIS_FLOOR, partPrice, partSold, presetPrice } from "../src/sim/10-catalog/parts";
import { newGame, type GameState } from "../src/sim/50-state";
import { deviceValue, resaleValue } from "../src/sim/60-infra/status";
import { sellDevice } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { withServer } from "./fixtures";

const SERVERS = MODELS.filter((m) => m.server);
const at = (year: number): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000, hour: hourOf(new Date(Date.UTC(year, 5, 1))) });

// Per unit: 1000 GB of RAM, SSD or NVMe, 1000 GB (one TB) of HDD, one core.
const ram = (y: number) => partPrice("ram", 1000, undefined, y) / 1000;
const ssd = (y: number) => partPrice("ssd", 1000, undefined, y) / 1000;
const nvme = (y: number) => partPrice("nvme", 1000, undefined, y) / 1000;
const hdd = (y: number) => partPrice("hdd", 1000, "3.5", y);
const cpu = (y: number) => partPrice("cpu", 1, undefined, y);

describe("part prices by year", () => {
  it("hits the keyframes", () => {
    expect([2005, 2018, 2023, 2026].map(ram)).toEqual([200, 13, 3.5, 22]);
    expect([2018, 2023, 2026].map(ssd)).toEqual([0.35, 0.07, 0.3]);
    expect([2018, 2023, 2026].map(nvme)).toEqual([0.5, 0.09, 0.33]);
    expect([2005, 2018, 2023, 2026].map(hdd)).toEqual([500, 35, 18, 15]);
    expect([2005, 2018, 2023, 2026].map(cpu)).toEqual([200, 45, 30, 28]);
  });

  it("runs in straight lines between keyframes and stays flat after the last", () => {
    expect(ram(2011)).toBeCloseTo(28, 6);
    expect(hdd(2021)).toBeCloseTo(25 - (7 * 1) / 3, 0);
    expect(cpu(2015)).toBeCloseTo(55, 6);
    expect(ram(2040)).toBe(ram(2028));
    expect(cpu(2040)).toBe(cpu(2028));
  });

  it("sells SSDs from 2009 and NVMe drives from 2014", () => {
    expect([2008, 2009].map((y) => partSold("ssd", y))).toEqual([false, true]);
    expect([2013, 2014].map((y) => partSold("nvme", y))).toEqual([false, true]);
    expect(partSold("ram", 2005)).toBe(true);
    expect(partOffers(2012).some((p) => p.kind === "nvme")).toBe(false);
  });

  it("prices the fixed parts", () => {
    const fixed = (kind: "psu" | "fan" | "board" | "nic", y: number) => partPrice(kind, undefined, undefined, y);
    expect([2005, 2015, 2030].map((y) => fixed("psu", y))).toEqual([150, 90, 90]);
    expect([2005, 2015, 2030].map((y) => fixed("board", y))).toEqual([600, 400, 400]);
    expect([2005, 2030].map((y) => fixed("fan", y))).toEqual([25, 25]);
    // 10G NICs cost 4 times the base until 2017, then 2 times.
    expect(fixed("nic", 2005)).toBe(80);
    expect(fixed("nic", 2016)).toBe(Math.round(4 * 40));
    expect(fixed("nic", 2017)).toBe(Math.round(2 * 40));
  });

  it("charges a preset at most its list price at its generation's launch year, less only where the list price tops the bundle price", () => {
    expect(SERVERS.length).toBeGreaterThan(0);
    for (const m of SERVERS) {
      for (const b of brandsFor("server")) {
        expect(presetPrice(m, m.from, b), `${m.id} ${b}`).toBeLessThanOrEqual(priceOf(m, b));
        expect(presetPrice(m, m.from, b), `${m.id} ${b}`).toBeGreaterThan(priceOf(m, b) * 0.3);
      }
    }
    expect(presetPrice(modelById("g1-compute"), 2005, "Dwell")).toBe(2500);
  });

  it("keeps the chassis above a quarter of the list price", () => {
    for (const m of SERVERS) expect(chassisPrice(m), m.id).toBeGreaterThanOrEqual(Math.round(m.price * CHASSIS_FLOOR));
    const m = modelById("g1-compute");
    expect(chassisPrice(m)).toBe(Math.round(m.price * CHASSIS_FLOOR));
  });

  it("follows the parts after the launch year", () => {
    const m = modelById("g1-compute");
    expect(presetPrice(m, 2009)).toBeLessThan(presetPrice(m, 2005));
    const g7 = modelById("g7-compute");
    expect(presetPrice(g7, 2026)).toBeGreaterThan(presetPrice(g7, 2023));
    expect(ram(2026)).toBeGreaterThan(ram(2023));
  });

  it("resells a part at the current part price on the resale curve", () => {
    const s = at(2023);
    const offer = partOffers(2023).find((p) => p.kind === "ram")!;
    const bought = buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: offer });
    if (!bought.ok) throw new Error(bought.error);
    const id = bought.id!;
    const d = s.devices.find((x) => x.id === id)!;
    expect(d.price).toBe(partPrice("ram", offer.size, offer.ff, 2023));
    s.hour = hourOf(new Date(Date.UTC(2026, 5, 1)));
    const value = resaleValue(s, partPrice("ram", offer.size, offer.ff, 2026), d.boughtAt);
    expect(deviceValue(s, d)).toBe(value);
    expect(value).toBeGreaterThan(resaleValue(s, d.price, d.boughtAt));
    const cash = s.cash;
    sellDevice(s, id);
    expect(s.cash - cash).toBeCloseTo(value, 2);
  });
});
