import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { bareParts, componentParts, fits, MODELS, modelById, partOffers, shopModels } from "../src/sim/10-catalog/hardware";
import { bareChassisPrice, partPrice, partsPrice, presetPrice } from "../src/sim/10-catalog/parts";
import { newGame, type GameState } from "../src/sim/50-state";
import { installedCores, installedRamGb, raidUsable } from "../src/sim/60-infra/status";
import { BARE_FLOOR, replaceComponent, unitPrice, type CartLine } from "../src/sim/90-actions/hardware";
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

// The CPUs, RAM and drives a preset ships with, as cart extras.
const removed = (modelId: string): NonNullable<CartLine["extras"]> => {
  const out: NonNullable<CartLine["extras"]> = [];
  for (const p of componentParts(modelById(modelId))) {
    if (!["cpu", "ram", "hdd", "ssd", "nvme"].includes(p.kind)) continue;
    const at = out.find((e) => e.kind === p.kind && e.size === p.size && e.ff === p.ff);
    if (at) at.qty++;
    else out.push({ kind: p.kind, size: p.size, ff: p.ff, qty: 1 });
  }
  return out;
};

describe("bare chassis", () => {
  it("keeps the board, fans, NIC and one power supply and nothing else", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute-2psu", "Dwell", 1, "loc1", { bare: true }));
    const kinds = dev(s, id).components.map((c) => c.kind);
    expect(kinds).toEqual(["psu", "fan", "fan", "fan", "fan", "board", "nic"]);
    expect(dev(s, id).raid).toBe("none");
    expect(installedCores(dev(s, id))).toBe(0);
    expect(installedRamGb(dev(s, id))).toBe(0);
    expect(raidUsable(dev(s, id))).toBe(0);
    expect(new Set(bareParts(modelById("g1-compute-2psu")).map((p) => p.kind))).toEqual(new Set(["psu", "fan", "board", "nic"]));
  });

  it("costs the preset price minus its parts at part prices, and the parts bring it back", () => {
    for (const brand of ["Dwell", "Hewlett-Packet", "SuperMacro"]) {
      for (const m of MODELS.filter((x) => x.server && x.psus === 1)) {
        for (const year of [m.from, 2026]) {
          const preset = presetPrice(m, year, brand), line = { model: m.id, brand, qty: 1, bare: true, extras: removed(m.id) };
          const bare = unitPrice({ ...line, extras: [] }, year);
          expect(bare, m.id).toBeGreaterThanOrEqual(Math.round(preset * BARE_FLOOR));
          if (bare > Math.round(preset * BARE_FLOOR)) expect(unitPrice(line, year), `${m.id} ${brand} ${year}`).toBe(preset);
        }
      }
    }
  });

  it("never costs less than a quarter of the preset", () => {
    const m = modelById("g1-archive");
    expect(unitPrice({ model: m.id, brand: "Dwell", qty: 1, bare: true }, 2005)).toBeGreaterThanOrEqual(Math.round(m.price * BARE_FLOOR));
  });

  it("is bought and filled from the cart, paying bare plus the extras", () => {
    const s = rich();
    const cash = s.cash;
    const extras = [{ kind: "cpu" as const, size: 1, qty: 2 }, { kind: "ram" as const, size: 2, qty: 4 }, { kind: "hdd" as const, size: 500, ff: "3.5", qty: 1 }];
    const id = ok(buyCart(s, [{ model: "g1-compute", brand: "Dwell", qty: 1, bare: true, extras }], { kind: "cash" }, "loc1"));
    // The preset sells its parts at a share of their price, so a custom build of the same machine costs more.
    const paid = bareChassisPrice(modelById("g1-compute"), 2005, "Dwell") + partsPrice(extras.flatMap((e) => Array.from({ length: e.qty }, () => ({ kind: e.kind, size: e.size }))), 2005);
    expect(cash - s.cash).toBe(paid);
    expect(dev(s, id).price).toBe(paid);
    expect(dev(s, id).components.map((c) => c.kind).sort()).toEqual(componentParts(modelById("g1-compute")).map((p) => p.kind).sort());
    expect(installedCores(dev(s, id))).toBe(2);
    expect(installedRamGb(dev(s, id))).toBe(8);
    expect(raidUsable(dev(s, id))).toBe(500);
    expect(dev(s, id).raid).toBe("none");
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
    const line = (extras: CartLine["extras"], bare = false): CartLine => ({ model: "g1-compute", brand: "Dwell", qty: 1, extras, bare });
    const cash = s.cash;
    expect(err(buyCart(s, [line([{ kind: "ram", size: 2, qty: 5 }])], { kind: "cash" }, "loc1"))).toBe("error.noSlot");
    expect(err(buyCart(s, [line([{ kind: "ram", size: 2, qty: 9 }], true)], { kind: "cash" }, "loc1"))).toBe("error.noSlot");
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
    for (const kind of ["psu", "fan", "nic", "board"]) expect(partOffers(2005).filter((p) => p.kind === kind)).toHaveLength(1);
    // NVMe bays come with G4, and so do the drives.
    expect(partOffers(2012).some((p) => p.kind === "nvme")).toBe(false);
    expect(partOffers(2015).filter((p) => p.kind === "nvme").map((p) => p.size)).toEqual([1000]);
    expect(shopModels(2015).filter((m) => m.server).length).toBeGreaterThan(0);
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
