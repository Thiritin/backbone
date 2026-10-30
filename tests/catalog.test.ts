import { describe, expect, it } from "vitest";
import { hourOf, monthIndexOf } from "../src/sim/00-core/time";
import { GENERATIONS } from "../src/sim/10-catalog/economy";
import { brandFrom, brandOnSale, brandUntil, brandWatts, brandsFor, MANUFACTURERS, MODELS, modelById, priceOf, shopModels, type DeviceModel } from "../src/sim/10-catalog/hardware";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { deviceWatts, linkStatus } from "../src/sim/60-infra/status";
import { addLocation, buyRack, connect, disconnect } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { mountDevice } from "./plugged";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

const ok = (r: ReturnType<typeof buyDevice>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const lines = (gen: number) => MODELS.filter((m) => m.id.startsWith(`g${gen}-`));
const line = (gen: number, id: string) => MODELS.find((m) => m.id === `g${gen}-${id}`);

describe("server lines", () => {
  it("offers every line in every generation, GPU from 2011 and ARM from 2020", () => {
    GENERATIONS.forEach((g, i) => {
      const ids = lines(i + 1).map((m) => m.id.slice(`g${i + 1}-`.length));
      const twin = g.year >= 2008;
      expect(ids).toEqual(["compute", "compute-2psu", "value", "micro", "dense", "memory", "bigmem", "quad", "storage", "storage-24", "backup", "archive", ...(g.year >= 2011 ? ["gpu"] : []), ...(g.year >= 2017 ? ["gpu-8"] : []), ...(twin ? ["twin-node"] : []), ...(g.year >= 2020 ? ["arm"] : []), ...(twin ? ["twin"] : [])]);
    });
  });
  it("scales specs from the generation row", () => {
    expect(line(1, "dense")).toMatchObject({ height: 1, watts: 375, price: 4000, server: { cores: 4, ramGb: 8, diskGb: 500 } });
    expect(line(1, "memory")).toMatchObject({ height: 2, watts: 400, price: 4500, server: { cores: 2, ramGb: 32 } });
    expect(line(4, "storage")!.server).toMatchObject({ bays: [{ ff: "3.5", count: 12 }], diskGb: 24000, disk: "SSD" });
    expect(line(1, "backup")!.server).toMatchObject({ bays: [{ ff: "3.5", count: 12 }], diskGb: 960, disk: "HDD", cores: 1, ramGb: 4 });
    expect(line(7, "archive")!.server).toMatchObject({ bays: [{ ff: "3.5", count: 60 }], diskGb: 1_680_000, disk: "HDD", cores: 32, ramGb: 256 });
    expect(line(5, "gpu")).toMatchObject({ height: 4, server: { gpus: 4 } });
    expect(line(6, "arm")).toMatchObject({ height: 1, price: 4500, server: { arch: "arm" } });
  });
  it("draws more for every bigger or denser line than the smaller ones in its generation", () => {
    GENERATIONS.forEach((_, i) => {
      const balanced = line(i + 1, "compute")!.watts;
      // A Twin node shares its chassis's supplies and fans, so it draws less than a 1U.
      const x86 = lines(i + 1).filter((m) => m.server?.arch === "x86" && !m.chassis && m.id !== `g${i + 1}-compute` && m.id !== `g${i + 1}-value` && m.id !== `g${i + 1}-micro`);
      for (const m of x86) expect(m.watts, m.id).toBeGreaterThan(balanced);
      const twoU = x86.filter((m) => m.height === 2), fourU = x86.filter((m) => m.height === 4);
      for (const big of fourU) for (const small of twoU) expect(big.watts, `${big.id} > ${small.id}`).toBeGreaterThan(small.watts);
      expect(line(i + 1, "archive")!.watts).toBeGreaterThan(line(i + 1, "backup")!.watts);
      expect(line(i + 1, "storage")!.watts).toBeGreaterThan(line(i + 1, "memory")!.watts);
    });
  });
  it("makes archive storage the cheapest per TB", () => {
    for (let g = 1; g <= 7; g++) {
      const perTb = (id: string) => line(g, id)!.price / line(g, id)!.server!.diskGb;
      expect(perTb("archive")).toBeLessThan(perTb("backup"));
      expect(perTb("backup")).toBeLessThan(perTb("storage"));
    }
  });
});

describe("switches, firewalls and patch panels", () => {
  const same = (a: DeviceModel, b: DeviceModel) => JSON.stringify(a.ports) === JSON.stringify(b.ports);
  it("has the L2 and L3 table and makes L3 cost and draw more than the L2 model with the same ports", () => {
    const switches = MODELS.filter((m) => m.kind === "switch");
    // The generic switches of the first builds live on as Sysko's, with their ports, so saves keep their cabling.
    expect(switches.filter((m) => m.id.startsWith("sw-")).map((m) => [m.id, m.layer, m.ports.length, m.from, m.brand])).toEqual([
      ["sw-8", 2, 8, 2005, "Sysko"], ["sw-24", 2, 26, 2005, "Sysko"], ["sw-48", 2, 52, 2008, "Sysko"], ["sw-48-l3", 3, 52, 2008, "Sysko"],
      ["sw-48x", 2, 48, 2011, "Sysko"], ["sw-48q", 3, 54, 2014, "Sysko"], ["sw-48y", 3, 56, 2017, "Sysko"], ["sw-32c", 3, 32, 2017, "Sysko"], ["sw-32d", 3, 32, 2022, "Sysko"], ["sw-32e", 3, 32, 2027, "Sysko"],
    ]);
    const pairs = switches.filter((m) => m.layer === 3).flatMap((l3) => switches.filter((l2) => l2.layer === 2 && l2.brand === l3.brand && same(l2, l3)).map((l2) => [l2, l3]));
    expect(pairs.length).toBeGreaterThan(0);
    for (const [l2, l3] of pairs) {
      expect(l3.price).toBeGreaterThan(l2.price);
      expect(l3.watts).toBeGreaterThan(l2.watts);
    }
  });
  it("sells firewalls by year and patch panels with 24 or 48 jacks", () => {
    const fw = (y: number) => shopModels(y).filter((m) => m.kind === "firewall").map((m) => m.throughputGbit!);
    // Sysko's old generic firewalls keep their ids; every year has a small box and a datacenter one.
    expect([2005, 2011, 2017, 2023].map((y) => Math.max(...fw(y)))).toEqual([1, 240, 240, 1500]);
    for (let y = 2005; y <= 2030; y++) expect(shopModels(y).filter((m) => m.kind === "firewall" && m.price < 1000).length, `${y}`).toBeGreaterThan(0);
    expect(modelById("fw-10g")).toMatchObject({ height: 1, kind: "firewall", brand: "Sysko", throughputGbit: 10 });
    expect(MODELS.filter((m) => m.kind === "patch").map((m) => [m.id, m.ports.length / 2, m.ports[0].media])).toEqual([
      ["patch-24", 24, "rj45"], ["patch-24f", 24, "sfp"], ["patch-48", 48, "rj45"], ["patch-48f", 48, "sfp"],
    ]);
  });
});

describe("manufacturers", () => {
  it("varies price within 10% and failure rate within 30% per class", () => {
    for (const m of MANUFACTURERS) {
      expect(Math.abs(m.priceFactor - 1)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.abs(m.failureFactor - 1)).toBeLessThanOrEqual(0.3 + 1e-9);
    }
    expect(brandsFor("server")).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid", "Gigabutt"]);
    expect(brandsFor("switch")).toEqual(["Hewlett-Packet", "Sysko", "Junipurr", "Aristotle", "MicroTick", "Nettgear", "Ubiquitea", "D-Lunk"]);
    expect(brandsFor("firewall")).toEqual(["Sysko", "Junipurr", "Fortinope", "Pablo Alto", "Netgoat", "SoPhosphate"]);
    expect(brandsFor("patch")).toEqual(["Pandoot"]);
    const g1 = modelById("g1-compute");
    expect(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid", "Gigabutt"].map((b) => priceOf(g1, b))).toEqual([2500, 2700, 2250, 2375, 2250]);
  });
  it("charges the manufacturer's price and rejects a brand that does not make the class", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = ok(buyDevice(s, "ups-1500", "APCee", 1, "loc1"));
    expect(s.devices.find((d) => d.id === id)).toMatchObject({ brand: "APCee", price: 189 });
    expect(s.cash).toBe(100_000 - 189);
    expect(ok(buyDevice(s, "patch-48", "Pandoot", 1, "loc1"))).toBeTruthy();
    for (const [model, brand] of [["patch-24", "Sysko"], ["sw-8", "Dwell"], ["sw-24", "Junipurr"], ["fw-1g", "Fortinope"], ["g1-compute", "Sysko"]]) {
      expect(buyDevice(s, model, brand, 1, "loc1")).toEqual({ ok: false, error: "error.unknownBrand" });
    }
  });
});

describe("firewall links", () => {
  // A 10G server behind an L2 switch whose 1G copper uplink runs through a 1G firewall to the handoff.
  function setup(): { s: GameState; srv: string; sw: string; fw: string; handoff: string } {
    const s = { ...withServer(newGame(1)), hour: hourOf(new Date(Date.UTC(2011, 0, 1))), cash: 1_000_000 };
    const loc = ok(addLocation(s, "interaction-fra", "cage", 4));
    s.locations.find((l) => l.id === loc)!.readyAt = s.hour;
    const rack = ok(buyRack(s, loc, "rack-47", 1));
    const put = (model: string, brand: string, slot: number) => {
      const id = ok(buyDevice(s, model, brand, 1, loc));
      ok(mountDevice(s, id, rack, slot));
      return id;
    };
    return { s, srv: put("g3-compute", "Dwell", 1), sw: put("sw-48", "Sysko", 40), fw: put("fw-1g", "Sysko", 41), handoff: s.devices.find((d) => d.panel === loc)!.id };
  }
  it("forwards like a switch and caps the speed at its throughput", () => {
    const { s, srv, sw, fw, handoff } = setup();
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 48 }));
    ok(connect(s, { device: sw, port: 0 }, { device: fw, port: 0 }));
    expect(linkStatus(s, srv).online).toBe(false);
    const up = ok(connect(s, { device: fw, port: 1 }, { device: handoff, port: 0 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: null });
    expect(linkStatus(s, fw)).toEqual({ online: true, gbit: 1, warning: null });
    ok(disconnect(s, up));
    ok(connect(s, { device: sw, port: 1 }, { device: handoff, port: 0 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 10, warning: null });
  });
});

describe("old model ids", () => {
  it("maps one-socket and high-memory servers from older saves onto the new lines", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    ok(buyDevice(s, "g1-compute", "Dwell", 2, "loc1"));
    const raw = JSON.parse(serialize(s));
    raw.devices[3].model = "g1-compute-1s";
    raw.devices[4].model = "g2-highmem";
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.devices.map((d) => d.model)).toEqual(["g1-compute", "sw-8", "home-router", "g1-compute", "g2-memory"]);
    for (const d of loaded.devices) expect(() => modelById(d.model)).not.toThrow();
  });
});

describe("manufacturer variation", () => {
  const m = modelById("g2-compute");
  const month = (year: number, mo: number) => year * 12 + mo;
  it("shifts the release in months", () => {
    expect(["SuperMacro", "Dwell", "Hewlett-Packet", "Lenovoid"].map((b) => brandFrom(m, b) - m.from * 12)).toEqual([-4, 0, 3, 6]);
  });
  it("a SuperMacro model is on sale before Dwell's and leaves later", () => {
    expect(brandOnSale(m, "SuperMacro", month(2007, 8))).toBe(true);
    expect(brandOnSale(m, "Dwell", month(2007, 8))).toBe(false);
    expect(brandOnSale(m, "Dwell", month(2008, 0))).toBe(true);
    expect(brandOnSale(m, "Hewlett-Packet", month(2008, 2))).toBe(false);
    expect(brandOnSale(m, "Hewlett-Packet", month(2008, 3))).toBe(true);
    expect(brandUntil(m, "SuperMacro")).toBe(m.until! + 1);
    expect(brandUntil(m, "Hewlett-Packet")).toBe(m.until! - 1);
    expect(brandOnSale(m, "Dwell", month(m.until! + 1, 0))).toBe(false);
    expect(brandOnSale(m, "SuperMacro", month(m.until! + 1, 0))).toBe(true);
  });
  it("lists a model in the shop while any brand sells it", () => {
    // Only SuperMacro sells the dense line: it opens before Dwell's year and closes a year after.
    expect(shopModels(2007).map((x) => x.id)).toContain("g2-dense");
    expect(shopModels(2006).map((x) => x.id)).not.toContain("g2-dense");
    expect(shopModels(m.until! + 1).map((x) => x.id)).toContain("g2-dense");
    expect(shopModels(m.until! + 2).map((x) => x.id)).not.toContain("g2-dense");
  });
  it("watts differ by brand", () => {
    expect(brandWatts(m, "SuperMacro")).toBeCloseTo(m.watts * 1.05, 9);
    expect(brandWatts(m, "Hewlett-Packet")).toBeCloseTo(m.watts * 0.95, 9);
    expect(brandWatts(m, "Dwell")).toBe(m.watts);
    expect(brandWatts(m, "Lenovoid")).toBe(m.watts);
  });
  it("a device draws its brand's watts", () => {
    const draw = (brand: string) => deviceWatts(device("d", "g2-compute", brand, null, 0, null, "d", 0));
    expect(draw("SuperMacro")).toBeGreaterThan(draw("Dwell"));
    expect(draw("Hewlett-Packet")).toBeLessThan(draw("Dwell"));
    expect(draw("Dwell")).toBe(m.watts);
  });
  it("refuses to buy a brand before its release month", () => {
    const s = newGame(1);
    s.hour = hourOf(new Date(Date.UTC(2008, 1, 1)));
    expect(monthIndexOf(s.hour)).toBe(month(2008, 1));
    s.cash = 1e9;
    expect(buyDevice(s, "g2-bigmem", "Hewlett-Packet", 1, "loc1")).toEqual({ ok: false, error: "error.notInShop" });
    expect(buyDevice(s, "g2-dense", "SuperMacro", 1, "loc1").ok).toBe(true);
    expect(buyDevice(s, "g2-dense", "Dwell", 1, "loc1")).toEqual({ ok: false, error: "error.unknownBrand" });
  });
});
