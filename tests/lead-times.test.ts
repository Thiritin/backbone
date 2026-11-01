import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { leadFactor } from "../src/sim/10-catalog/hardware";
import { partPrice } from "../src/sim/10-catalog/parts";
import { type GameState } from "../src/sim/50-state";
import { buyCart, deliveryWait, type CartLine } from "../src/sim/90-actions/hardware";
import { withServer, newGame } from "./fixtures";

const at = (y: number, m: number, d = 1) => hourOf(new Date(Date.UTC(y, m - 1, d)));
const game = (y: number, m: number): GameState => ({ ...withServer(newGame(1)), hour: at(y, m), cash: 1_000_000 });
const line = (model: string, brand = "Generic"): CartLine => ({ model, brand, qty: 1 });
const wait = (y: number, m: number, model: string, brand?: string) => deliveryWait(game(y, m), [line(model, brand)]);

describe("supply shock lead times", () => {
  it("quadruples HDD deliveries after the Thailand flood and lets them recover by July 2012", () => {
    expect(wait(2011, 9, "part-hdd")).toBe(43);
    expect(wait(2011, 12, "part-hdd")).toBe(172);
    expect(wait(2011, 12, "g2-compute", "Dwell")).toBe(172);
    expect(wait(2011, 12, "part-psu")).toBe(43);
    expect(wait(2012, 7, "part-hdd")).toBe(38);
  });

  it("makes servers and switches six times slower at the height of the chip shortage", () => {
    expect(wait(2022, 1, "cat9300-48", "Sysko")).toBe(144);
    expect(wait(2022, 1, "part-nic")).toBe(144);
    expect(wait(2022, 1, "part-hdd")).toBe(24);
    expect(wait(2023, 1, "cat9300-48", "Sysko")).toBe(24);
  });

  it("slows memory, flash and every server that ships with memory in the AI crunch", () => {
    expect(wait(2026, 3, "part-ram")).toBe(120);
    expect(wait(2026, 3, "part-nvme")).toBe(120);
    expect(wait(2026, 3, "g6-compute", "Dwell")).toBe(120);
    expect(wait(2026, 3, "part-psu")).toBe(24);
    expect(wait(2027, 1, "part-ram")).toBe(24);
  });

  it("eases in and out instead of stepping", () => {
    const rise = [3, 4, 5, 6, 7, 8, 9].map((m) => leadFactor("switch", at(2021, m)));
    expect(rise[0]).toBe(1);
    expect(rise.at(-1)).toBe(6);
    rise.slice(1).forEach((f, i) => expect(f).toBeGreaterThan(rise[i]));
    expect(rise[3]).toBeCloseTo(3.5, 0);
    const fall = [7, 8, 9, 10, 11, 12].map((m) => leadFactor("switch", at(2022, m)));
    fall.slice(1).forEach((f, i) => expect(f).toBeLessThan(fall[i]));
  });

  it("ships a whole cart after its slowest line", () => {
    const s = game(2026, 3);
    const r = buyCart(s, [line("part-psu"), line("part-ram")], { kind: "cash" }, "loc1");
    expect(r.ok).toBe(true);
    const bought = s.devices.filter((d) => d.transitTo === "loc1");
    expect(bought).toHaveLength(2);
    bought.forEach((d) => expect(d.arriveAt).toBe(s.hour + 120));
  });

  it("raises HDD prices in the flood year", () => {
    expect(partPrice("hdd", 1000, undefined, 2012)).toBeGreaterThan(partPrice("hdd", 1000, undefined, 2011) * 1.4);
    expect(partPrice("hdd", 1000, undefined, 2013)).toBeLessThan(partPrice("hdd", 1000, undefined, 2011));
  });
});
