import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { componentParts, fits, MODELS, manufacturerByName, modelById, partOffers, shopModels, vendorsOf } from "../src/sim/10-catalog/hardware";
import { BUNDLE, partPrice, partsPrice, presetPrice } from "../src/sim/10-catalog/parts";
import { newGame, type GameState } from "../src/sim/50-state";
import { installedCores, installedRamGb, raidUsable } from "../src/sim/60-infra/status";
import { replaceComponent, type CartLine } from "../src/sim/90-actions/hardware";
import { buyCart, buyDevice } from "./fixtures";
import { mountDevice } from "./plugged";
import { withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const rich = (year = 2005): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000, hour: hourOf(new Date(Date.UTC(year, 5, 1))) });
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

describe("server prices", () => {
  it("never cost more than the parts bought one by one, and mostly cost less", () => {
    let cheaper = 0, total = 0;
    for (const brand of ["Dwell", "Hewlett-Packet", "SuperMacro"]) {
      for (const m of MODELS.filter((x) => x.server && x.psus === 1)) {
        for (const vendor of vendorsOf(m)) {
          for (const year of [m.from, 2026]) {
            const parts = partsPrice(componentParts(m, vendor), year), preset = presetPrice(m, year, brand, vendor);
            total++;
            if (preset < parts) cheaper++;
            expect(preset, `${m.id} ${vendor} ${brand} ${year}`).toBeLessThanOrEqual(Math.round(BUNDLE * parts * (manufacturerByName(brand)?.priceFactor ?? 1)));
          }
        }
      }
    }
    expect(cheaper / total).toBeGreaterThan(0.7);
  });

  it("have no bare chassis: a bought server comes with its CPUs, RAM and drives", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(installedCores(dev(s, id))).toBe(2);
    expect(installedRamGb(dev(s, id))).toBe(8);
    expect(raidUsable(dev(s, id))).toBe(500);
  });
});

describe("presets with extras", () => {
  it("adds the extras to the preset's parts and prices them per part", () => {
    const s = rich();
    const cash = s.cash;
    const id = ok(buyCart(s, [{ model: "g1-compute", brand: "Dwell", qty: 2, extras: [{ kind: "ram", size: 2, qty: 4 }] }], { kind: "cash" }, "loc1"));
    const stick = partPrice("ram", 2, undefined, 2005);
    expect(cash - s.cash).toBe(2 * (2500 + 4 * stick));
    expect(installedRamGb(dev(s, id))).toBe(16);
    expect(dev(s, id).components.filter((c) => c.kind === "ram")).toHaveLength(8);
    expect(dev(s, id).price).toBe(2500 + 4 * stick);
  });

  it("refuses extras beyond the slots", () => {
    const s = rich();
    const line = (extras: CartLine["extras"]): CartLine => ({ model: "g1-compute", brand: "Dwell", qty: 1, extras });
    const cash = s.cash;
    expect(err(buyCart(s, [line([{ kind: "ram", size: 2, qty: 5 }])], { kind: "cash" }, "loc1"))).toBe("error.noSlot");
    expect(err(buyCart(s, [line([{ kind: "cpu", size: 1, qty: 1 }])], { kind: "cash" }, "loc1"))).toBe("error.noSlot");
    expect(err(buyCart(s, [line([{ kind: "hdd", size: 500, ff: "3.5", qty: 4 }])], { kind: "cash" }, "loc1"))).toBe("error.noSlot");
    expect(err(buyCart(s, [line([{ kind: "ram", size: 2, qty: 4 }, { kind: "hdd", size: 500, ff: "3.5", qty: 3 }])], { kind: "cash" }, "loc1"))).toBe("ok");
    expect(s.cash).toBeLessThan(cash);
  });

  it("refuses a drive of the wrong form factor", () => {
    const s = rich(2012);
    // G3 compute has 2.5" bays; the shop sells 3.5" drives for the backup line.
    expect(partOffers(2012).some((p) => p.kind === "hdd" && p.ff === "3.5")).toBe(true);
    const line = (ff: string): CartLine => ({ model: "g3-compute", brand: "Dwell", qty: 1, extras: [{ kind: "hdd", size: 3000, ff, qty: 1 }] });
    expect(err(buyCart(s, [line("3.5")], { kind: "cash" }, "loc1"))).toBe("error.wrongFormFactor");
    expect(err(buyCart(s, [line("nvme")], { kind: "cash" }, "loc1"))).toBe("error.wrongFormFactor");
    expect(fits(modelById("g1-storage"), [{ kind: "ssd", size: 500, ff: "2.5" }])).toBe("error.wrongFormFactor");
    expect(fits(modelById("g4-compute"), [{ kind: "nvme", size: 1000, ff: "nvme" }, { kind: "ssd", size: 2000, ff: "2.5" }])).toBeNull();
  });

  it("refuses parts the shop does not sell and extras on switches", () => {
    const s = rich();
    expect(err(buyCart(s, [{ model: "g1-compute", brand: "Dwell", qty: 1, extras: [{ kind: "ram", size: 4096, qty: 1 }] }], { kind: "cash" }, "loc1"))).toBe("error.tooMuchRam");
    expect(err(buyCart(s, [{ model: "g1-compute", brand: "Dwell", qty: 1, extras: [{ kind: "ram", size: 3, qty: 1 }] }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
    expect(err(buyCart(s, [{ model: "sw-8", brand: "Sysko", qty: 1, extras: [{ kind: "ram", size: 2, qty: 1 }] }], { kind: "cash" }, "loc1"))).toBe("error.notBuildable");
    expect(err(buyCart(s, [{ model: "g1-compute", brand: "Dwell", qty: 1, extras: [{ kind: "ram", size: 2, qty: 0 }] }], { kind: "cash" }, "loc1"))).toBe("error.badQuantity");
  });
});

describe("Parts tab", () => {
  it("sells the sizes of the current generation and the one before", () => {
    const sizes = (year: number, kind: string) => partOffers(year).filter((p) => p.kind === kind).map((p) => p.size);
    expect(sizes(2005, "ram")).toEqual([2]);
    expect(sizes(2012, "ram")).toEqual(expect.arrayContaining([4, 8]));
    expect(sizes(2012, "ram")).not.toContain(2);
    expect(sizes(2024, "ram").filter((x) => x !== undefined)).toEqual(expect.arrayContaining([32, 64]));
    expect(partOffers(2012).filter((p) => p.kind === "cpu").map((p) => p.size)).toEqual(expect.arrayContaining([6]));
    for (const kind of ["psu", "fan", "nic"]) expect(partOffers(2005).filter((p) => p.kind === kind)).toHaveLength(1);
    expect(partOffers(2005).filter((p) => p.kind === "board").map((p) => p.vendor)).toEqual(["indel", "amb"]);
    // NVMe bays come with G4, and so do the drives.
    expect(partOffers(2012).some((p) => p.kind === "nvme")).toBe(false);
    expect(partOffers(2015).filter((p) => p.kind === "nvme").map((p) => p.size)).toEqual([1000]);
    expect(shopModels(2015).filter((m) => m.server).length).toBeGreaterThan(0);
  });

  it("sells small HDDs while they were common and big ones when they arrive", () => {
    const hdd = (year: number) => partOffers(year).filter((p) => p.kind === "hdd" && p.ff === "3.5").map((p) => p.size);
    expect(hdd(2005)).toEqual(expect.arrayContaining([80, 160, 500]));
    expect(hdd(2005)).not.toContain(1000);
    expect(hdd(2012)).not.toContain(160);
    expect(hdd(2020)).toEqual(expect.arrayContaining([4000, 12000]));
    expect(partPrice("hdd", 160, "3.5", 2005)).toBe(80);
  });

  it("stores a bought part with its size, and refuses one the shop does not sell", () => {
    const s = rich(2012);
    const id = ok(buyCart(s, [{ model: "part-ram", brand: "Generic", qty: 2, part: { kind: "ram", size: 8 } }], { kind: "cash" }, "loc1"));
    expect(dev(s, id)).toMatchObject({ model: "part-ram", store: "loc1", price: partPrice("ram", 8, undefined, 2012), part: { kind: "ram", size: 8 } });
    expect(err(buyCart(s, [{ model: "part-ram", brand: "Generic", qty: 1, part: { kind: "ram", size: 5 } }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
    expect(err(buyCart(s, [{ model: "part-ram", brand: "Generic", qty: 1, part: { kind: "hdd", size: 500, ff: "3.5" } }], { kind: "cash" }, "loc1"))).toBe("error.notInShop");
  });

  it("replaces a component with a part of the same kind and at least its size", () => {
    const s = rich(2009);
    const id = ok(buyDevice(s, "g2-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", 10));
    dev(s, id).on = false;
    const stick = dev(s, id).components.find((c) => c.kind === "ram")!;
    expect(stick.size).toBe(4);
    ok(buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: { kind: "ram", size: 2 } }));
    expect(err(replaceComponent(s, id, stick.id))).toBe("error.noPart");
    const big = ok(buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: { kind: "ram", size: 4 } }));
    expect(err(replaceComponent(s, id, stick.id))).toBe("ok");
    expect(dev(s, id).maintenance).toMatchObject({ partId: big, spec: { kind: "ram", size: 4 } });
  });
});
