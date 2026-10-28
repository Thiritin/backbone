import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { GENERATIONS, START_CASH } from "../src/sim/10-catalog/economy";
import { brandsFor, MODELS, modelById, shopModels } from "../src/sim/10-catalog/hardware";
import { newGame, type GameState } from "../src/sim/50-state";
import { freeSlots, linkStatus, portPeers, storageStacks } from "../src/sim/60-infra/status";
import {
  addLocation, buyDevice, buyRack, connect, disconnect, mountDevice, mountStack, sellDevice, setBond, setPortGroup, unmountDevice,
} from "../src/sim/90-actions/hardware";

const atYear = (year: number, cash = 1_000_000): GameState => ({ ...newGame(1), hour: hourOf(new Date(Date.UTC(year, 0, 1))), cash });
const ok = (r: ReturnType<typeof buyDevice>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof buyDevice>) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const mounted = (s: GameState, model: string, rack: string, slot: number, brand = brandsFor(modelById(model).kind)[0]) => {
  const id = ok(buyDevice(s, model, brand, 1, s.racks.find((r) => r.id === rack)!.locationId));
  ok(mountDevice(s, id, rack, slot));
  return id;
};
// A ready datacenter location in Frankfurt with one 47U rack per position.
function colo(s: GameState, positions = 1) {
  const loc = ok(addLocation(s, "interaction-fra", "positions", positions));
  s.locations.find((l) => l.id === loc)!.readyAt = s.hour;
  const racks = Array.from({ length: positions }, (_, i) => ok(buyRack(s, loc, "rack-47", i + 1)));
  return { loc, racks, handoff: s.devices.find((d) => d.panel === loc)!.id };
}

describe("catalog", () => {
  it("has unique ids and sane numbers", () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    for (const m of MODELS) {
      expect(m.idleWatts).toBeLessThanOrEqual(m.watts);
      expect(m.ports.length > 0).toBe(m.kind !== "part");
      // Panel gateways and parts take no units; edge routers take 1 or 2.
      expect(m.height).toBe(m.kind === "part" || (m.kind === "gateway" && !m.price) ? 0 : m.kind === "server" || m.kind === "gateway" ? m.height : 1);
    }
    expect(() => modelById("nope")).toThrow();
    expect(MODELS.some((m) => m.id === "tower")).toBe(false);
  });
  it("scales servers from the generation row", () => {
    const g1 = modelById("g1-compute");
    expect(g1.server).toMatchObject({ cores: 2, ramGb: 8, maxRamGb: 16, diskGb: 500, disk: "HDD" });
    expect([g1.price, g1.watts, g1.idleWatts, g1.ports[0]]).toEqual([2500, 250, 100, { media: "rj45", gbit: 1 }]);
    expect(modelById("g1-compute-2psu")).toMatchObject({ price: 2750, psus: 2, watts: 263 });
    expect(modelById("g3-compute").ports[0]).toEqual({ media: "sfp", gbit: 10 });
    expect(modelById("g5-compute").ports[0].gbit).toBe(25);
    expect(modelById("g7-memory")).toMatchObject({ height: 2, price: 9900, watts: 720, ports: expect.arrayContaining([{ media: "sfp", gbit: 100 }]) });
    expect(modelById("g7-memory").server).toMatchObject({ cores: 128, ramGb: 4096 });
    expect(modelById("g6-arm").server!.arch).toBe("arm");
    expect(MODELS.filter((m) => m.id.endsWith("-arm")).map((m) => m.from)).toEqual([2020, 2023]);
    expect(MODELS.some((m) => m.id === "g1-highmem" || m.id === "g1-compute-1s" || m.id === "g4-gpu")).toBe(false);
    expect(GENERATIONS[6].cores).toBe(128);
    expect(modelById("sw-8")).toMatchObject({ height: 1, watts: 8, price: 60 });
    expect(modelById("handoff")).toMatchObject({ name: "Datacenter handoff", height: 0, watts: 0 });
  });
  it("draws more power for every bigger or denser model than the 1U compute of its generation", () => {
    GENERATIONS.forEach((_, i) => {
      const base = modelById(`g${i + 1}-compute`).watts;
      for (const v of ["compute-2psu", "highmem", "storage"]) {
        const m = MODELS.find((x) => x.id === `g${i + 1}-${v}`);
        if (m) expect(m.watts).toBeGreaterThan(base);
      }
    });
  });
  it("sells each generation until two generations later and never sells gateways", () => {
    const ids = (y: number) => shopModels(y).map((m) => m.id);
    expect(ids(2005)).toEqual(expect.arrayContaining(["g1-compute", "sw-8", "sw-24", "patch-24"]));
    expect(ids(2005)).not.toContain("home-router");
    expect(ids(2005)).not.toContain("handoff");
    expect(ids(2010)).toEqual(expect.arrayContaining(["g1-compute", "g2-compute"]));
    expect(ids(2011)).not.toContain("g1-compute");
    expect(ids(2026)).toEqual(expect.arrayContaining(["g6-compute", "g7-compute", "sw-24", "sw-32c"]));
  });
});

describe("new game", () => {
  it("starts with a server and switch in the basement rack, online through the home router", () => {
    const s = newGame(3);
    expect(s.cash).toBe(START_CASH);
    expect(s.locations).toEqual([{ id: "loc1", dc: null, city: "Frankfurt", az: "fra1", name: "Basement", space: "basement", positions: 1, readyAt: 0, extraCircuit: false }]);
    expect(s.racks).toEqual([{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0, provided: false, feedB: false, highDensity: false }]);
    expect(s.devices.map((d) => [d.model, d.brand, d.name, d.rackId, d.panel, d.price, d.boughtAt])).toEqual([
      ["g1-compute", "Dwell", "fra1-srv-01", "rack2", null, 2500, 0],
      ["sw-8", "Sysko", "fra1-sw-01", "rack2", null, 60, 0],
      ["home-router", "Sysko", "fra1-gw-01", null, "loc1", 0, 0],
    ]);
    expect(linkStatus(s, "dev3")).toEqual({ online: true, gbit: 1, warning: null });
    expect(freeSlots(s, "rack2", 1)).toEqual(Array.from({ length: 22 }, (_, i) => i + 2));
    expect(portPeers(s, "dev3")).toEqual([{ device: "dev4", port: 0 }, null]);
    expect(portPeers(s, "dev4")[7]).toEqual({ device: "dev5", port: 0 });
  });
});

describe("buyDevice and storage", () => {
  it("buys identical units into storage, pays for all of them and books one line", () => {
    const s = atYear(2005, 10_000);
    const first = ok(buyDevice(s, "g1-compute", "SuperMacro", 3, "loc1"));
    expect(first).toBe("dev8");
    // SuperMacro sells at 0.9 × the catalog price.
    expect(s.cash).toBe(3250);
    expect(s.ledger).toEqual([{ hour: s.hour, category: "hardware", key: "ledger.hardware", params: { model: "Balanced 1U G1", qty: 3 }, amount: -6750 }]);
    expect(dev(s, first)).toMatchObject({ rackId: null, panel: null, brand: "SuperMacro", name: "srv-01", price: 2250, boughtAt: s.hour });
    ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    expect(storageStacks(s, "loc1")).toEqual([
      { model: "g1-compute", brand: "SuperMacro", ids: ["dev8", "dev9", "dev10"] },
      { model: "sw-8", brand: "Sysko", ids: ["dev11"] },
    ]);
    expect(linkStatus(s, first).online).toBe(false);
  });
  it("rejects every invalid purchase", () => {
    const s = atYear(2005);
    expect(err(buyDevice(s, "g2-compute", "Dwell", 1, "loc1"))).toBe("error.notInShop");
    expect(err(buyDevice(s, "home-router", "Sysko", 1, "loc1"))).toBe("error.notInShop");
    expect(err(buyDevice(s, "g1-compute", "Appel", 1, "loc1"))).toBe("error.unknownBrand");
    expect(err(buyDevice(s, "g1-compute", "Dwell", 0, "loc1"))).toBe("error.badQuantity");
    expect(err(buyDevice(s, "g1-compute", "Dwell", 1.5, "loc1"))).toBe("error.badQuantity");
    s.cash = 4999;
    expect(err(buyDevice(s, "g1-compute", "Dwell", 2, "loc1"))).toBe("error.noCash");
  });
});

describe("mounting", () => {
  it("mounts a stored device and names it after the location", () => {
    const s = atYear(2005, 5000);
    const id = ok(buyDevice(s, "g1-storage", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", 2));
    expect(dev(s, id)).toMatchObject({ rackId: "rack2", slot: 2, name: "fra1-srv-02" });
    expect(storageStacks(s, "loc1")).toEqual([]);
    expect(freeSlots(s, "rack2", 1)[0]).toBe(4);
  });
  it("rejects every invalid mount", () => {
    const s = atYear(2005);
    const id = ok(buyDevice(s, "g1-storage", "Dwell", 1, "loc1"));
    expect(err(mountDevice(s, "x", "rack2", 2))).toBe("error.unknownDevice");
    expect(err(mountDevice(s, "dev3", "rack2", 2))).toBe("error.alreadyMounted");
    expect(err(mountDevice(s, "dev5", "rack2", 2))).toBe("error.alreadyMounted");
    expect(err(mountDevice(s, id, "nope", 2))).toBe("error.unknownRack");
    expect(err(mountDevice(s, id, "rack2", 24))).toBe("error.outOfBounds");
    expect(err(mountDevice(s, id, "rack2", 0))).toBe("error.outOfBounds");
    expect(err(mountDevice(s, id, "rack2", 1))).toBe("error.slotTaken");
    expect(err(mountDevice(s, id, "rack2", 23))).toBe("error.slotTaken");
  });
  it("mounts a stack on consecutive slots, lowest first, or fails when it does not fit", () => {
    const s = atYear(2005);
    ok(buyDevice(s, "g1-storage", "Dwell", 12, "loc1"));
    expect(err(mountStack(s, "g1-storage", "Dwell", "rack2", 12))).toBe("error.noRoom");
    expect(err(mountStack(s, "g1-storage", "Dwell", "rack2", 13))).toBe("error.notInStorage");
    expect(err(mountStack(s, "g1-storage", "SuperMacro", "rack2", 1))).toBe("error.notInStorage");
    expect(err(mountStack(s, "g1-storage", "Dwell", "nope", 1))).toBe("error.unknownRack");
    const first = ok(mountStack(s, "g1-storage", "Dwell", "rack2", 3));
    expect(first).toBe("dev8");
    expect(s.devices.filter((d) => d.model === "g1-storage" && d.rackId).map((d) => d.slot)).toEqual([2, 4, 6]);
    expect(storageStacks(s, "loc1")[0].ids).toHaveLength(9);
  });
  it("unmounts to storage, unplugs every cable and keeps name, bond and groups", () => {
    const s = newGame(1);
    ok(setBond(s, "dev3", "balance"));
    ok(setPortGroup(s, "dev4", [2, 3]));
    ok(unmountDevice(s, "dev4"));
    expect(dev(s, "dev4")).toMatchObject({ rackId: null, panel: null, name: "fra1-sw-01", groups: [[2, 3]] });
    expect(s.cables).toEqual([]);
    expect(linkStatus(s, "dev3").online).toBe(false);
    ok(unmountDevice(s, "dev3"));
    expect(dev(s, "dev3").bond).toBe("balance");
    expect(err(unmountDevice(s, "dev3"))).toBe("error.notMounted");
    expect(err(unmountDevice(s, "dev5"))).toBe("error.notMounted");
    expect(err(unmountDevice(s, "x"))).toBe("error.unknownDevice");
    ok(mountDevice(s, "dev4", "rack2", 10));
    expect(dev(s, "dev4").name).toBe("fra1-sw-01");
  });
});

describe("sellDevice", () => {
  it("sells a mounted device after unplugging it, and a stored one", () => {
    const s = atYear(2005, 5000);
    ok(sellDevice(s, "dev3"));
    expect(s.devices.map((d) => d.id)).toEqual(["dev4", "dev5"]);
    expect(s.cables.map((c) => c.id)).toEqual(["cab7"]);
    expect(s.cash).toBe(7500);
    expect(s.ledger.at(-1)).toEqual({ hour: 0, category: "sales", key: "ledger.sale", params: { device: "fra1-srv-01" }, amount: 2500 });
    const stored = ok(buyDevice(s, "sw-24", "Sysko", 1, "loc1"));
    ok(sellDevice(s, stored));
    expect(s.cash).toBe(7500);
    expect(err(sellDevice(s, "dev3"))).toBe("error.unknownDevice");
    expect(err(sellDevice(s, "dev5"))).toBe("error.cannotSell");
  });
});

describe("connect", () => {
  it("picks copper, DAC or fiber", () => {
    const s = atYear(2011);
    const { racks: [a, b], handoff } = colo(s, 2);
    const srv = mounted(s, "g3-compute", a, 1);
    const swA = mounted(s, "sw-48", a, 41);
    const swB = mounted(s, "sw-48", b, 41);
    const kind = (r: ReturnType<typeof connect>) => s.cables.find((c) => c.id === ok(r))!.kind;
    expect(kind(connect(s, { device: swA, port: 0 }, { device: handoff, port: 0 }))).toBe("copper");
    expect(kind(connect(s, { device: srv, port: 0 }, { device: swA, port: 48 }))).toBe("dac");
    expect(kind(connect(s, { device: swA, port: 49 }, { device: swB, port: 48 }))).toBe("fiber");
  });
  it("rejects every invalid cable", () => {
    const s = atYear(2011);
    const { racks: [a] } = colo(s);
    const srv = mounted(s, "g3-compute", a, 1);
    const sw = mounted(s, "sw-48", a, 41);
    const stored = ok(buyDevice(s, "sw-48", "Sysko", 1, "loc1"));
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 48 }));
    expect(err(connect(s, { device: "x", port: 0 }, { device: sw, port: 1 }))).toBe("error.unknownDevice");
    expect(err(connect(s, { device: srv, port: 9 }, { device: sw, port: 1 }))).toBe("error.unknownPort");
    expect(err(connect(s, { device: sw, port: 2 }, { device: sw, port: 1 }))).toBe("error.sameDevice");
    expect(err(connect(s, { device: srv, port: 0 }, { device: sw, port: 49 }))).toBe("error.portInUse");
    expect(err(connect(s, { device: sw, port: 0 }, { device: "dev4", port: 1 }))).toBe("error.otherLocation");
    expect(err(connect(s, { device: sw, port: 0 }, { device: stored, port: 1 }))).toBe("error.notMounted");
    expect(err(connect(s, { device: srv, port: 1 }, { device: sw, port: 0 }))).toBe("error.mediaMismatch");
    const sw24 = mounted(s, "sw-24", a, 40);
    expect(err(connect(s, { device: srv, port: 1 }, { device: sw24, port: 24 }))).toBe("error.speedMismatch");
  });
  it("disconnects", () => {
    const s = newGame(1);
    ok(disconnect(s, "cab6"));
    expect(linkStatus(s, "dev3").online).toBe(false);
    expect(err(disconnect(s, "cab6"))).toBe("error.unknownCable");
  });
});

describe("linkStatus", () => {
  it("goes online through a switch to the datacenter handoff", () => {
    const s = atYear(2005);
    const { racks: [rack], handoff } = colo(s);
    const srv = mounted(s, "g1-compute", rack, 1);
    const sw = mounted(s, "sw-24", rack, 41);
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 0 }));
    expect(linkStatus(s, srv).online).toBe(false);
    ok(connect(s, { device: sw, port: 23 }, { device: handoff, port: 1 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: null });
    expect(linkStatus(s, sw).online).toBe(true);
  });
  it("goes online through a patch panel in another rack, front to back", () => {
    const s = atYear(2005);
    const { racks: [a, b], handoff } = colo(s, 2);
    const sw = mounted(s, "sw-24", a, 41);
    ok(connect(s, { device: sw, port: 0 }, { device: handoff, port: 0 }));
    const srv = mounted(s, "g1-compute", b, 1);
    const pp = mounted(s, "patch-24", b, 41);
    ok(connect(s, { device: srv, port: 0 }, { device: pp, port: 3 }));
    ok(connect(s, { device: pp, port: 4 }, { device: sw, port: 5 }));
    expect(linkStatus(s, srv).online).toBe(false);
    ok(connect(s, { device: pp, port: 27 }, { device: sw, port: 6 }));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: null });
  });
  it("adds up a grouped balance bond and warns when the switch ports are not grouped", () => {
    const s = atYear(2005);
    const { racks: [rack], handoff } = colo(s);
    const srv = mounted(s, "g1-compute", rack, 1);
    const sw = mounted(s, "sw-24", rack, 41);
    ok(connect(s, { device: sw, port: 23 }, { device: handoff, port: 0 }));
    ok(connect(s, { device: srv, port: 0 }, { device: sw, port: 0 }));
    ok(connect(s, { device: srv, port: 1 }, { device: sw, port: 1 }));
    expect(linkStatus(s, srv).gbit).toBe(1);
    ok(setBond(s, srv, "balance"));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 1, warning: "bondNotGrouped" });
    ok(setPortGroup(s, sw, [1, 0]));
    expect(linkStatus(s, srv)).toEqual({ online: true, gbit: 2, warning: null });
  });
});

describe("setBond and setPortGroup", () => {
  it("rejects non-servers for bonds", () => {
    const s = newGame(1);
    expect(err(setBond(s, "dev4", "balance"))).toBe("error.notServer");
    expect(err(setBond(s, "x", "balance"))).toBe("error.unknownDevice");
  });
  it("replaces overlapping groups, clears with one port or none, and validates", () => {
    const s = atYear(2005);
    const sw = ok(buyDevice(s, "sw-24", "Sysko", 1, "loc1"));
    const groups = () => dev(s, sw).groups;
    ok(setPortGroup(s, sw, [0, 1]));
    ok(setPortGroup(s, sw, [4, 5, 6]));
    ok(setPortGroup(s, sw, [1, 2]));
    expect(groups()).toEqual([[4, 5, 6], [1, 2]]);
    ok(setPortGroup(s, sw, [5]));
    expect(groups()).toEqual([[1, 2]]);
    ok(setPortGroup(s, sw, []));
    expect(groups()).toEqual([]);
    expect(err(setPortGroup(s, sw, [0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe("error.groupSize");
    expect(err(setPortGroup(s, sw, [0, 99]))).toBe("error.unknownPort");
    expect(err(setPortGroup(s, "dev5", [0, 1]))).toBe("error.notSwitch");
    expect(err(setPortGroup(s, "x", [0, 1]))).toBe("error.unknownDevice");
  });
});
