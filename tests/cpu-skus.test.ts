import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { GENERATIONS } from "../src/sim/10-catalog/economy";
import { CPU_SKUS, cpuModel, cpuSkus, defaultSku, skuById, skuOf, VENDORS } from "../src/sim/10-catalog/cpus";
import { brandsOf, componentParts, cpuOptions, cpuWattsOf, fits, LINEUP, MODELS, modelById, modelName, partOffers, presetSku } from "../src/sim/10-catalog/hardware";
import { partPrice, presetPrice } from "../src/sim/10-catalog/parts";
import { device, deviceDefaults, type GameState } from "../src/sim/50-state";
import { installedCores, perCoreOf } from "../src/sim/60-infra/status";
import { unitPrice } from "../src/sim/90-actions/hardware";
import { buyCart, buyDevice, withServer, newGame } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const rich = (year: number): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000, hour: hourOf(new Date(Date.UTC(year, 5, 1))) });
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

describe("CPU parts", () => {
  it("gives every x86 socket generation a range of parts with threads and clocks, Ampear from 2020", () => {
    GENERATIONS.forEach((g, i) => {
      for (const v of VENDORS) {
        const rows = cpuSkus(v, i + 1);
        if (v === "ampear" && g.year < 2020) { expect(rows).toEqual([]); continue; }
        expect(rows.length, `${v} G${i + 1}`).toBeGreaterThanOrEqual(2);
        for (const c of rows) {
          expect(c.threads).toBeGreaterThanOrEqual(c.cores);
          expect(c.boost).toBeGreaterThanOrEqual(c.ghz);
          expect(c.tdp).toBeGreaterThan(0);
          expect(c.perCore).toBeGreaterThan(0.5);
          expect(c.from).toBeGreaterThanOrEqual(g.year);
        }
        expect(new Set(rows.map((c) => c.cores)).size, `${v} G${i + 1} core counts`).toBeGreaterThanOrEqual(2);
      }
    });
    expect(new Set(CPU_SKUS.map((c) => c.id)).size).toBe(CPU_SKUS.length);
    expect(skuById("indel-xenon-e5-2690")).toMatchObject({ cores: 8, threads: 16, ghz: 2.9, boost: 3.8 });
  });

  it("gives a fast part more per core than its generation row and a slow one less", () => {
    const row = cpuModel("indel", 3)!;
    expect(skuById("indel-xenon-e5-2690")!.perCore).toBeGreaterThan(row.perCore);
    expect(skuById("indel-xenon-e5-2603")!.perCore).toBeLessThan(row.perCore);
    expect(skuById("ampear-ultra-q80-30")!.perCore).toBeGreaterThan(skuById("ampear-ultra-q64-22")!.perCore);
  });

  it("ships presets with the part nearest their share, the clock line with the fastest, and names it on the part", () => {
    expect(presetSku(modelById("g3-compute"), "indel")!.name).toBe("Xenon E5-2620");
    expect(presetSku(modelById("g5-compute"), "amb")!.name).toBe("Epyk 7551");
    expect(presetSku(modelById("g1-compute"), "indel")!.name).toBe("Xenon 3.6");
    const fast = presetSku(modelById("g5-micro"), "indel")!;
    expect(fast.boost).toBe(Math.max(...cpuOptions(modelById("g5-micro"), "indel", 2017).map((c) => c.boost)));
    const parts = componentParts(modelById("g3-compute"));
    expect(parts.filter((p) => p.kind === "cpu").map((p) => [p.size, p.sku])).toEqual([[6, "indel-xenon-e5-2620"], [6, "indel-xenon-e5-2620"]]);
    // A part from before parts had names resolves to the nearest of its vendor and generation.
    expect(skuOf({ size: 8, vendor: "indel", gen: 3 })!.name).toBe("Xenon E5-2650");
    expect(defaultSku("amb", 4, 24)!.name).toBe("Opteroni 6386 SE");
  });

  it("sells every part of the sockets on sale and still takes a spare asked for by size", () => {
    const offers = partOffers(2012).filter((p) => p.kind === "cpu");
    expect(offers.every((p) => p.sku)).toBe(true);
    expect(offers.map((p) => p.sku)).toContain("indel-xenon-e5-2690");
    expect(offers.map((p) => p.sku)).toContain("amb-opteroni-6276");
    expect(offers.map((p) => p.sku)).not.toContain("indel-xenon-e5-2697-v2");
    expect(partOffers(2013).map((p) => p.sku)).toContain("indel-xenon-e5-2697-v2");
    const s = rich(2012);
    const named = ok(buyDevice(s, "part-cpu", "Generic", 1, "loc1", { part: { kind: "cpu", size: 8, vendor: "indel", gen: 3, sku: "indel-xenon-e5-2690" } }));
    expect(dev(s, named).part).toMatchObject({ sku: "indel-xenon-e5-2690" });
    expect(err(buyDevice(s, "part-cpu", "Generic", 1, "loc1", { part: { kind: "cpu", size: 8, vendor: "indel", gen: 3 } }))).toBe("ok");
    expect(err(buyDevice(s, "part-cpu", "Generic", 1, "loc1", { part: { kind: "cpu", size: 8, vendor: "indel", gen: 3, sku: "indel-xenon-e5-2650-v3" } }))).toBe("error.notInShop");
  });

  it("prices a part by its own factor and lets a configured server pick any part of its socket", () => {
    expect(partPrice("cpu", 8, undefined, 2012, { vendor: "indel", gen: 3, sku: "indel-xenon-e5-2690" })).toBe(Math.round(8 * 70 * 1.6));
    expect(partPrice("cpu", 8, undefined, 2012, { vendor: "indel", gen: 3, sku: "indel-xenon-e5-2650" })).toBe(Math.round(8 * 70 * 1.15));
    const m = modelById("g3-compute");
    const base = unitPrice({ model: m.id, brand: "Dwell", qty: 1 }, 2012), fast = unitPrice({ model: m.id, brand: "Dwell", qty: 1, cpu: "indel-xenon-e5-2690" }, 2012);
    expect(fast).toBeGreaterThan(base);
    expect(fast).toBe(presetPrice(m, 2012, "Dwell", "indel", "indel-xenon-e5-2690"));
    const s = rich(2012);
    const id = ok(buyCart(s, [{ model: m.id, brand: "Dwell", qty: 1, cpu: "indel-xenon-e5-2690" }], { kind: "cash" }, "loc1"));
    expect(dev(s, id).components.filter((c) => c.kind === "cpu").map((c) => c.sku)).toEqual(["indel-xenon-e5-2690", "indel-xenon-e5-2690"]);
    expect(installedCores(dev(s, id))).toBe(16);
    expect(perCoreOf(dev(s, id))).toBe(skuById("indel-xenon-e5-2690")!.perCore);
    expect(err(buyCart(s, [{ model: m.id, brand: "Dwell", qty: 1, cpu: "amb-opteroni-6276" }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
    expect(err(buyCart(s, [{ model: m.id, brand: "Dwell", qty: 1, cpu: "indel-xenon-e5-2620-v3" }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
  });

  it("draws each part's TDP and refuses two different parts in one server", () => {
    const m = modelById("g3-compute");
    expect(cpuWattsOf(m, componentParts(m, "indel", "indel-xenon-e5-2690"))).toBe(2 * 135);
    const d = { ...device("d", m.id, "Dwell", null, 0, null, "d", 0), ...deviceDefaults(m.id, 0, componentParts(m, "indel", "indel-xenon-e5-2643")) };
    expect(installedCores(d)).toBe(8);
    const board = { kind: "board" as const, vendor: "indel" as const };
    expect(fits(m, [board, { kind: "cpu", size: 8, vendor: "indel", gen: 3, sku: "indel-xenon-e5-2650" }, { kind: "cpu", size: 8, vendor: "indel", gen: 3, sku: "indel-xenon-e5-2690" }])).toBe("error.mixedCpus");
    expect(fits(m, [board, { kind: "cpu", size: 8, vendor: "indel", gen: 3, sku: "indel-xenon-e5-2690" }, { kind: "cpu", size: 8, vendor: "indel", gen: 3 }])).toBeNull();
  });
});

describe("maker lineups", () => {
  it("names every server in the maker's own numbering and sells a line only where the maker has a name for it", () => {
    for (const m of MODELS.filter((x) => x.server || x.nodes)) {
      expect(m.brands!.length, m.id).toBeGreaterThan(0);
      for (const b of m.brands!) expect(modelName(m, b), `${m.id} ${b}`).not.toBe(m.name);
    }
    expect(modelName(modelById("g3-compute"), "Dwell")).toBe("PowerEdgy R620");
    expect(modelName(modelById("g3-compute"), "Hewlett-Packet")).toBe("ProLight DL360p Gen8");
    expect(modelName(modelById("g5-dense"), "SuperMacro")).toBe("SuperSaver 6019P-WTR");
    expect(modelName(modelById("g5-compute"), "Lenovoid")).toBe("ThinkSystem SR630");
    expect(modelName(modelById("g4-twin"), "Dwell")).toBe("PowerEdgy C6320");
    expect(modelName(modelById("g4-twin-node"), "Dwell")).toBe("PowerEdgy C6320 node");
    expect(modelName(modelById("sw-8"), "Sysko")).toBe("Catalust 2960-8TC");
    expect(brandsOf(modelById("g1-compute"))).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro"]);
    expect(brandsOf(modelById("g3-compute"))).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid"]);
    expect(brandsOf(modelById("g4-compute"))).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid", "Gigabutt"]);
    expect(brandsOf(modelById("g6-arm"))).toEqual(["Hewlett-Packet", "SuperMacro", "Gigabutt"]);
    expect(brandsOf(modelById("g1-dense"))).toEqual(["SuperMacro"]);
    expect(Object.keys(LINEUP)).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid", "Gigabutt"]);
  });

  it("adds the clock, four-socket, 24-bay storage and 8-card GPU lines", () => {
    expect(modelById("g5-quad").server).toMatchObject({ sockets: 4, ramGb: 2048 });
    expect(componentParts(modelById("g5-quad")).filter((p) => p.kind === "cpu")).toHaveLength(4);
    expect(modelById("g5-storage-24").server!.bays).toEqual([{ ff: "nvme", count: 24 }]);
    expect(modelById("g1-storage-24").server).toMatchObject({ bays: [{ ff: "2.5", count: 24 }], drives: 8, diskGb: 8 * 73 });
    expect(modelById("g5-gpu-8").server!.gpus).toBe(8);
    expect(MODELS.some((m) => m.id === "g4-gpu-8")).toBe(false);
    expect(modelById("g5-micro").server!.fast).toBe(true);
    const s = rich(2017);
    const id = ok(buyDevice(s, "g5-micro", "Hewlett-Packet", 1, "loc1"));
    expect(dev(s, id).components.find((c) => c.kind === "cpu")!.sku).toBe("indel-xenon-gold-6144");
    expect(err(buyDevice(s, "g5-micro", "Dwell", 1, "loc1"))).toBe("error.unknownBrand");
  });
});
