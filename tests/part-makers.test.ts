import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DDR_BY_GEN, defaultFamily, DRIVE_FAMILIES, familiesOn, familyById, familyName, familyOf, familySizes, isRamFamily, RAM_FAMILIES, type Family } from "../src/sim/10-catalog/families";
import { cardOf, gpuPrice, OTHER_CARDS } from "../src/sim/10-catalog/gpu";
import { componentParts, fits, modelById, partOffers } from "../src/sim/10-catalog/hardware";
import { partPrice, presetPrice } from "../src/sim/10-catalog/parts";
import { device, deviceDefaults, newGame, type GameState } from "../src/sim/50-state";
import { failureChance } from "../src/sim/88-tick/tick";
import { partLabel } from "../src/ui/apps/hw";
import { makerOf, partClass } from "../src/ui/apps/shop/filter";
import { buyCart, buyDevice, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const ddrOf = (f: Family | undefined) => (f && isRamFamily(f) ? f.ddr : "");
const rich = (year: number): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000, hour: hourOf(new Date(Date.UTC(year, 5, 1))) });

describe("memory and drive families", () => {
  it("sells sticks of the board's DDR type by year and drives of every class in their years", () => {
    const ddr = (f: Family) => (isRamFamily(f) ? f.ddr : "");
    expect(familiesOn("ram", 2005).map(ddr)).toEqual(["DDR2", "DDR2"]);
    expect(new Set(familiesOn("ram", 2015).map(ddr))).toEqual(new Set(["DDR3", "DDR4"]));
    expect(familiesOn("ram", 2024).every((f) => ddr(f) === "DDR5")).toBe(true);
    expect(familySizes(familyById("sumsang-ddr4-rdimm")!, 2014)).toEqual([8, 16]);
    expect(familySizes(familyById("sumsang-ddr4-rdimm")!, 2020)).toEqual([8, 16, 32, 64, 128]);
    const rpm = (f: Family) => (isRamFamily(f) ? 0 : f.rpm);
    expect(familiesOn("hdd", 2007).map(rpm)).toEqual(expect.arrayContaining([7200, 15000, 10000]));
    expect(familiesOn("hdd", 2024).every((f) => rpm(f) === 7200)).toBe(true);
    expect(familiesOn("ssd", 2008)).toEqual([]);
    expect(familiesOn("nvme", 2013)).toEqual([]);
    expect(familiesOn("nvme", 2019).map((f) => f.id)).toContain("indel-optane-dc-p4800x");
    expect(new Set([...RAM_FAMILIES, ...DRIVE_FAMILIES].map((f) => f.id)).size).toBe(RAM_FAMILIES.length + DRIVE_FAMILIES.length);
    expect(familyName(familyById("seagull-exos")!)).toBe("Seagull Exos");
    expect(familyName(familyById("sumsang-ddr4-rdimm")!)).toBe("Sumsang DDR4-2933 RDIMM");
  });

  it("ships presets with a family of the year and resolves old parts to one", () => {
    const parts = componentParts(modelById("g1-compute"));
    expect(parts.find((p) => p.kind === "hdd")).toMatchObject({ size: 500, ff: "3.5", sku: "seagull-barracuda-es" });
    expect(parts.find((p) => p.kind === "ram")).toMatchObject({ size: 2, sku: "kingstown-ddr2-rdimm" });
    expect(componentParts(modelById("g5-compute")).find((p) => p.kind === "ssd")!.sku).toBe("sumsang-pm863");
    expect(componentParts(modelById("g7-compute")).find((p) => p.kind === "nvme")!.sku).toBe("sumsang-pm9a3");
    // A 3.5" SSD preset has no family of its form factor and takes the 2.5" one whose sizes come closest.
    expect(componentParts(modelById("g4-storage")).find((p) => p.kind === "ssd")).toMatchObject({ ff: "3.5", sku: "indel-dc-s3500" });
    expect(componentParts(modelById("g7-compute")).find((p) => p.kind === "ram")!.sku).toBe("kingstown-ddr5-rdimm");
    expect(ddrOf(familyOf({ kind: "ram", size: 8 }, 2012, 3))).toBe("DDR3");
    expect(familyOf({ kind: "hdd", size: 4000, ff: "3.5" }, 2016)!.id).toBe("seagull-exos");
    expect(ddrOf(defaultFamily("ram", 2014, 16, undefined, DDR_BY_GEN[3]))).toBe("DDR4");
  });

  it("prices and fails a part by its maker and class", () => {
    expect(partPrice("hdd", 4000, "3.5", 2016, { sku: "seagull-exos" })).toBe(Math.round(4 * 40 * 0.92 * 1.1));
    expect(partPrice("hdd", 4000, "3.5", 2016, { sku: "wd-ultrastar-7k" })).toBe(Math.round(4 * 40 * 1));
    expect(partPrice("nvme", 750, "nvme", 2018, { sku: "indel-optane-dc-p4800x" })).toBe(Math.round(750 * 0.5 * 1.1 * 4));
    expect(partPrice("ram", 32, undefined, 2016, { sku: "crucible-ddr4-udimm" })).toBe(Math.round(32 * 8 * 0.9 * 0.85));
    expect(partPrice("ram", 32, undefined, 2016)).toBe(32 * 8);
    const s = rich(2016), d = s.devices.find((x) => x.id === "dev3")!, hdd = d.components.find((c) => c.kind === "hdd")!;
    const seagull = failureChance(s, d, hdd), wd = failureChance(s, d, { ...hdd, sku: "wd-re" });
    expect(seagull / wd).toBeCloseTo(1.2 / 0.8, 9);
    // The list price at launch stays whatever the parts cost.
    expect(presetPrice(modelById("g1-compute"), 2005, "Dwell")).toBe(2500);
  });

  it("takes only sticks of the board's DDR type, and any stick without a maker", () => {
    const m = modelById("g4-compute");
    expect(fits(m, [{ kind: "ram", size: 16, sku: "sumsang-ddr4-rdimm" }])).toBeNull();
    expect(fits(m, [{ kind: "ram", size: 16, sku: "sumsang-ddr3-rdimm" }])).toBe("error.wrongRam");
    expect(fits(m, [{ kind: "ram", size: 16 }])).toBeNull();
    const s = rich(2015);
    expect(err(buyCart(s, [{ model: m.id, brand: "Dwell", qty: 1, extras: [{ kind: "ram", size: 16, qty: 1, sku: "kingstown-ddr3-rdimm" }] }], { kind: "cash" }, "loc1"))).toBe("error.wrongRam");
    const id = ok(buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: { kind: "ram", size: 16, sku: "hyenix-ddr4-rdimm" } }));
    expect(s.devices.find((x) => x.id === id)!.part).toMatchObject({ sku: "hyenix-ddr4-rdimm" });
    expect(err(buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: { kind: "ram", size: 16, sku: "sumsang-ddr5-rdimm" } }))).toBe("error.notInShop");
  });

  it("files parts under their makers with full labels", () => {
    const offers = partOffers(2016);
    expect(offers.filter((p) => p.kind === "ram").every((p) => p.sku && familyById(p.sku))).toBe(true);
    expect(new Set(offers.filter((p) => p.kind === "hdd").map((p) => makerOf("Generic", p)))).toEqual(new Set(["Seagull", "Western Digitail", "Toshibark"]));
    expect(partLabel({ kind: "ssd", size: 960, ff: "2.5", sku: "sumsang-pm863" })).toBe('Sumsang PM863 960 GB, 2.5"');
    expect(partLabel({ kind: "ram", size: 32, sku: "hyenix-ddr4-rdimm" })).toBe("SK Hyenix DDR4-3200 RDIMM 32 GB");
    expect(partLabel({ kind: "gpu", size: 2018, sku: "t4" })).toBe("GPU nVidea T4");
    expect(partClass("nvme")).toBe("Drives");
    expect(partClass("fan")).toBe("Power and cooling");
    expect(makerOf("Generic", { kind: "gpu", size: 2023, sku: "instinkt-mi300x" })).toBe("AMB");
  });

  it("sells cards of every line and prices them by their own line", () => {
    expect(OTHER_CARDS.map((c) => c.id)).toContain("instinkt-mi100");
    expect(cardOf(2020, "instinkt-mi100").name).toBe("AMB Radeon Instinkt MI100");
    expect(cardOf(2020).name).toBe("nVidea Tezla A100");
    expect(gpuPrice(cardOf(2018, "t4"), 2021)).toBe(1250);
    expect(gpuPrice(cardOf(2018, "t4"), 2020)).toBeCloseTo(2000);
    const m = modelById("g6-gpu"), d = { ...device("d", m.id, "Dwell", null, 0, null, "d", 0), ...deviceDefaults(m.id, 0, componentParts(m)) };
    expect(d.components.filter((c) => c.kind === "gpu").map((c) => c.sku)).toEqual(Array(4).fill("tezla-a100"));
  });
});
