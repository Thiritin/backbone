import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { brandsOf, isOfficeRouter, MODELS, modelById, priceOf, shopModels, type DeviceKind } from "../src/sim/10-catalog/hardware";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { upsMinutes } from "../src/sim/60-infra/incidents";
import { exitsOf, uplinkMbps } from "../src/sim/60-infra/network";
import { pduOf } from "../src/sim/60-infra/pdu";
import { deviceWatts, linkStatus } from "../src/sim/60-infra/status";
import { announceBlock } from "../src/sim/90-actions/addresses";
import { addLocation, atServer, buyRack, powerCycle, remotePower, reset, sellDevice, setPower } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { buyDevice } from "./fixtures";
import { orderTransit } from "../src/sim/90-actions/network";
import { installRouter } from "../src/sim/90-actions/routers";
import { powerTick } from "../src/sim/60-infra/power";
import { readyGame } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const jan = (year: number) => hourOf(new Date(Date.UTC(year, 0, 1, 9)));
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

describe("router catalog", () => {
  it("lists the small-office, branch and edge routers with the brief's prices, years and speeds", () => {
    const row = (id: string) => { const m = modelById(id); return [m.brand, m.from, m.price, m.throughputGbit, m.fullTable]; };
    expect(["fb-7050", "fb-7390", "fb-7590", "fb-5690"].map(row)).toEqual([
      ["AVN", 2006, 150, 0.1, false], ["AVN", 2010, 220, 0.3, false], ["AVN", 2018, 249, 1, false], ["AVN", 2024, 330, 2.5, false],
    ]);
    expect(["isr-1841", "isr-2811", "isr-2911", "isr-4451", "isr-8300"].map(row)).toEqual([
      ["Sysko", 2005, 1300, 0.1, false], ["Sysko", 2005, 2500, 0.3, false], ["Sysko", 2009, 2800, 1, false], ["Sysko", 2013, 8000, 2, true], ["Sysko", 2020, 9000, 10, true],
    ]);
    expect(["rb1100", "ccr1036", "ccr2004", "ccr2216"].map(row)).toEqual([
      ["MicroTick", 2010, 300, 1, false], ["MicroTick", 2013, 1000, 10, true], ["MicroTick", 2020, 450, 10, true], ["MicroTick", 2022, 2500, 100, true],
    ]);
    expect(["mx80", "mx204", "mx304"].map(row)).toEqual([["Junipurr", 2010, 25000, 80, true], ["Junipurr", 2017, 40000, 400, true], ["Junipurr", 2022, 80000, 1600, true]]);
    expect(["edge-s", "edge-m", "edge-l", "edge-xl", "edge-xxl"].map((id) => modelById(id).fullTable)).toEqual([false, true, true, true, true]);
    expect(modelById("isr-1841").ports).toHaveLength(2);
    expect(modelById("isr-4451").ports).toHaveLength(4);
    expect(modelById("rb1100").ports).toHaveLength(13);
    expect(modelById("ccr1036").ports.map((p) => p.gbit)).toEqual([...Array(12).fill(1), ...Array(4).fill(10)]);
    expect(modelById("home-router")).toMatchObject({ price: 0, throughputGbit: 0.1, fullTable: false });
  });

  it("sells a router only from its own manufacturer, at its list price", () => {
    expect(brandsOf(modelById("mx80"))).toEqual(["Junipurr"]);
    expect(priceOf(modelById("mx80"), "Junipurr")).toBe(25000);
    expect(brandsOf(modelById("sw-24"))).toEqual(["Sysko"]);
    expect(brandsOf(modelById("ex2200-24t"))).toEqual(["Junipurr"]);
    const s = { ...readyGame(1), cash: 1e6 };
    s.hour = jan(2013);
    expect(buyDevice(s, "ccr1036", "Sysko", 1, "loc1")).toEqual({ ok: false, error: "error.unknownBrand" });
    expect(buyDevice(s, "ccr1036", "MicroTick", 1, "loc1").ok).toBe(true);
    expect(dev(s, s.devices.at(-1)!.id).price).toBe(1000);
  });

  it("adds UPS sizes and switched PDUs", () => {
    expect(["ups-1500", "ups-3000", "ups-5k", "ups-10k"].map((id) => { const m = modelById(id); return [m.from, m.height, m.price, m.batteryWh, m.psus]; })).toEqual([
      [2005, 1, 180, 600, 1], [2005, 2, 900, 1800, 1], [2005, 3, 2500, 3500, 1], [2008, 6, 6000, 8000, 2],
    ]);
    expect(["pdu-8", "pdu-24"].map((id) => { const m = modelById(id); return [brandsOf(m), m.from, m.height, m.price, m.outlets]; })).toEqual([[["Eatin", "APCee"], 2005, 1, 700, 8], [["Eatin", "APCee"], 2008, 0, 1200, 24]]);
  });

  it("keeps every kind on sale in every year from 2005 to 2035 and the newest model of each line on sale", () => {
    const kinds = [...new Set(MODELS.filter((m) => m.price > 0 && m.kind !== "part").map((m) => m.kind))] as DeviceKind[];
    for (const kind of kinds) for (let year = kind === "chassis" ? 2008 : 2005; year <= 2035; year++) expect(shopModels(year).some((m) => m.kind === kind), `${kind} ${year}`).toBe(true);
    for (const id of ["fb-5690", "isr-8300", "ccr2216", "mx304", "edge-xxl", "sw-32e", "fw-400g", "ups-10k", "pdu-24"]) expect(shopModels(2035).map((m) => m.id)).toContain(id);
    expect(modelById("edge-xxl")).toMatchObject({ from: 2027, price: 150000, throughputGbit: 1600 });
    expect(modelById("sw-32e")).toMatchObject({ from: 2027, price: 60000 });
    expect(modelById("fw-400g")).toMatchObject({ from: 2027, price: 70000, throughputGbit: 400 });
    expect(shopModels(2029).map((m) => m.id)).not.toContain("edge-xl");
    expect(shopModels(2029).map((m) => m.id)).not.toContain("sw-32d");
  });
});

describe("announcing a block", () => {
  // A ready rack in a datacenter at the given year, with a server cabled to the handoff.
  function colo(year: number) {
    const s = { ...readyGame(1), cash: 1e7 };
    s.hour = jan(year);
    const loc = ok(addLocation(s, "hetzler-park", "suite", 20));
    s.locations = s.locations.map((l) => (l.id === loc ? { ...l, readyAt: s.hour } : l));
    const rack = ok(buyRack(s, loc, "rack-42", 1));
    s.racks = s.racks.map((r) => (r.id === rack ? { ...r, arriveAt: null } : r));
    return { s, loc, rack };
  }
  const block = (s: GameState) => s.ips.blocks[0].id;

  it("needs a full-table router at the location, which a router without one does not provide", () => {
    const { s, loc, rack } = colo(2013);
    expect(err(announceBlock(s, block(s), loc))).toBe("error.needsBgpRouter");
    const small = ok(buyDevice(s, "isr-2911", "Sysko", 1, loc));
    ok(mountDevice(s, small, rack, 1));
    expect(err(announceBlock(s, block(s), loc))).toBe("error.needsBgpRouter");
    const big = ok(buyDevice(s, "ccr1036", "MicroTick", 1, loc));
    ok(mountDevice(s, big, rack, 3));
    expect(err(announceBlock(s, block(s), loc))).toBe("ok");
    expect(s.ips.blocks[0].locationId).toBe(loc);
  });

  it("does not count a router that is switched off or sits in another location", () => {
    const { s, loc, rack } = colo(2013);
    const big = ok(buyDevice(s, "ccr1036", "MicroTick", 1, loc));
    ok(mountDevice(s, big, rack, 1));
    ok(setPower(s, big, false));
    expect(err(announceBlock(s, block(s), loc))).toBe("error.needsBgpRouter");
    ok(setPower(s, big, true));
    s.hour += 2;
    const other = colo(2013);
    expect(err(announceBlock(other.s, block(other.s), other.loc))).toBe("error.needsBgpRouter");
    expect(err(announceBlock(s, block(s), loc))).toBe("ok");
  });

  it("is never possible from the basement, whose small-office routers never hold a full table", () => {
    const s = { ...readyGame(1), cash: 1e6 };
    s.hour = jan(2024);
    expect(err(announceBlock(s, block(s), "loc1"))).toBe("error.lirNeedsDatacenter");
    for (const id of ["fb-7050", "fb-7390", "fb-7590", "fb-5690", "home-router"]) expect(modelById(id).fullTable).toBe(false);
  });
});

describe("the basement router", () => {
  const homeUp = (s: GameState) => exitsOf(s, s.locations[0])[0].cap;

  it("caps the home line at its own speed and is replaced by a bought small-office router", () => {
    const s = { ...readyGame(1), cash: 1e6 };
    s.homeLine = { id: "biz-fiber-1000", next: null };
    expect(homeUp(s)).toBe(100);
    s.hour = jan(2014);
    const mid = ok(buyDevice(s, "fb-7390", "AVN", 1, "loc1"));
    expect(dev(s, mid)).toMatchObject({ store: "loc1", panel: null });
    ok(installRouter(s, mid));
    expect(dev(s, mid)).toMatchObject({ store: null, rackId: "rack2", slot: 23, name: "fra1-gw-01" });
    expect(dev(s, "dev5")).toMatchObject({ store: "loc1", rackId: null });
    expect(homeUp(s)).toBe(300);
    s.homeLine = { id: "vdsl-50", next: null };
    expect(homeUp(s)).toBe(10);
    s.homeLine = { id: "biz-fiber-1000", next: null };
    s.hour = jan(2018);
    const fast = ok(buyDevice(s, "fb-7590", "AVN", 1, "loc1"));
    ok(installRouter(s, fast));
    expect(homeUp(s)).toBe(1000);
    // The 7390 goes back into storage and can be sold.
    expect(dev(s, mid)).toMatchObject({ store: "loc1", rackId: null, name: expect.stringMatching(/^fra1-gw-/) });
    expect(sellDevice(s, mid).ok).toBe(true);
  });

  it("keeps the cabling and the servers online across the swap", () => {
    const s = { ...readyGame(1), cash: 1e6 };
    s.hour = jan(2018);
    expect(linkStatus(s, "dev3").online).toBe(true);
    const cable = s.cables.find((c) => c.b.device === "dev5")!;
    const fast = ok(buyDevice(s, "fb-7590", "AVN", 1, "loc1"));
    ok(installRouter(s, fast));
    expect(s.cables.find((c) => c.id === cable.id)!.b).toEqual({ device: fast, port: cable.b.port });
    expect(linkStatus(s, "dev3").online).toBe(true);
  });

  it("only goes in the basement, on a shelf of its rack", () => {
    const s = { ...readyGame(1), cash: 1e6 };
    s.hour = jan(2018);
    const loc = ok(addLocation(s, "hetzler-park", "suite", 20));
    expect(err(buyDevice(s, "fb-7590", "AVN", 1, loc))).toBe("error.basementOnly");
    const fast = ok(buyDevice(s, "fb-7590", "AVN", 1, "loc1"));
    expect(isOfficeRouter(modelById("fb-7590"))).toBe(true);
    expect(err(installRouter(s, "dev3"))).toBe("error.alreadyMounted");
    const spare = ok(buyDevice(s, "fb-7590", "AVN", 1, "loc1"));
    ok(mountDevice(s, spare, "rack2", 5));
    expect(dev(s, spare)).toMatchObject({ rackId: "rack2", slot: 5 });
    ok(installRouter(s, fast));
    expect(err(installRouter(s, fast))).toBe("error.alreadyMounted");
    const sw = ok(buyDevice(s, "sw-48y", "Sysko", 1, "loc1"));
    expect(err(installRouter(s, sw))).toBe("error.notOfficeRouter");
  });
});

describe("router throughput in a datacenter", () => {
  it("passes on no more than the router can route", () => {
    const rate = (model: string) => {
      const s = newGame(1);
      s.cash = 1e6;
      s.unlocks = ["network"];
      const loc = ok(addLocation(s, "equinox-fr5", "cage", 4));
      s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
      s.devices = s.devices.filter((d) => d.model !== "handoff");
      const router = ok(buyDevice(s, model, "Sysko", 1, loc));
      s.devices = s.devices.map((d) => (d.id === router ? { ...d, store: null, panel: loc } : d));
      ok(orderTransit(s, loc, "cogentle", 1, 0.2));
      s.hour += 24 * 15;
      return uplinkMbps(s, s.network.uplinks[0]);
    };
    expect(rate("edge-s")).toBe(1000);
    expect(rate("isr-1841")).toBe(100);
    expect(rate("isr-2811")).toBe(300);
  });
});

describe("UPS sizes", () => {
  it("carry a location for as many minutes as their battery lasts at its load", () => {
    const s = { ...readyGame(1), cash: 1e6 };
    s.hour = jan(2008);
    const load = (extra: string[]) => s.devices.filter((d) => d.rackId || extra.includes(d.id)).reduce((n, d) => n + deviceWatts(d), 0);
    const small = ok(buyDevice(s, "ups-1500", "Eatin", 1, "loc1"));
    ok(mountDevice(s, small, "rack2", 5));
    expect(upsMinutes(s, "loc1")).toBeCloseTo((600 / load([])) * 60, 6);
    const big = ok(buyDevice(s, "ups-10k", "Eatin", 1, "loc1"));
    ok(mountDevice(s, big, "rack2", 8));
    expect(upsMinutes(s, "loc1")).toBeCloseTo(((600 + 8000) / load([])) * 60, 6);
    expect(upsMinutes(s, "loc1")).toBeGreaterThan(60);
  });
});

describe("switched PDUs", () => {
  const base = readyGame(3);
  const at = (rng: number): GameState => { const s = structuredClone(base); s.rng = { s: rng }; return s; };
  const onSrv = (s: GameState) => s.workloads.filter((w) => w.deviceId === "dev3");
  const corrupted = (s: GameState) => onSrv(s).filter((w) => w.corrupted);
  const seeds = Array.from({ length: 300 }, (_, i) => 1000 + i * 7919);
  const withPdu = (s: GameState, model = "pdu-8", slot = 10) => {
    s.cash = 1e6;
    s.hour = Math.max(s.hour, jan(2009));
    ok(mountDevice(s, ok(buyDevice(s, model, "Eatin", 1, "loc1")), "rack2", slot));
    return s;
  };

  it("lets a server without a management controller be power cycled and cut with no remote hands fee", () => {
    const s = at(5);
    s.locations[0].dc = DATACENTERS[0].id;
    expect(modelById(dev(s, "dev3").model).kind).toBe("server");
    expect(err(powerCycle(s, "dev3"))).toBe("error.noBmc");
    withPdu(s);
    expect(pduOf(s, dev(s, "dev3"))).toBeDefined();
    const cash = s.cash;
    expect(err(reset(s, "dev3"))).toBe("error.noBmc");
    expect(powerCycle(s, "dev3").ok).toBe(true);
    expect(dev(s, "dev3").log.at(-1)?.key).toMatch(/^ipmi\.log\.(cycle|corrupted|resync)$/);
    expect(dev(s, "dev3").log.some((e) => e.key === "ipmi.log.cycle")).toBe(true);
    expect(remotePower(s, "dev3", false).ok).toBe(true);
    expect(dev(s, "dev3").on).toBe(false);
    expect(dev(s, "dev3").hands ?? null).toBeNull();
    expect(s.cash).toBe(cash);
    powerTick(s);
    expect(dev(s, "dev3").on).toBe(false);
  });

  it("still sends remote hands in a datacenter rack without one", () => {
    const s = at(5);
    s.locations[0].dc = DATACENTERS[0].id;
    const cash = s.cash;
    expect(err(remotePower(s, "dev3", false))).toBe("error.noBmc");
    expect(atServer(s, "dev3", "pull").ok).toBe(true);
    expect(dev(s, "dev3").on).toBe(true);
    expect(s.cash).toBeLessThan(cash);
  });

  it("rolls for corruption like a pulled plug", () => {
    const hits = seeds.filter((r) => { const s = withPdu(at(r)); setPower(s, "dev3", false); return corrupted(s).length > 0; });
    expect(hits.length).toBeGreaterThan(0);
    for (const r of hits.slice(0, 3)) {
      const s = withPdu(at(r));
      expect(powerCycle(s, "dev3").ok).toBe(true);
      expect(corrupted(s).length).toBe(onSrv(s).length);
      const t = withPdu(at(r));
      expect(remotePower(t, "dev3", false).ok).toBe(true);
      expect(corrupted(t).length).toBe(onSrv(t).length);
    }
    const misses = seeds.filter((r) => !hits.includes(r)).slice(0, 3);
    for (const r of misses) { const s = withPdu(at(r)); powerCycle(s, "dev3"); expect(corrupted(s)).toHaveLength(0); }
  });

  it("works through a 0U PDU, covers other devices in the rack, and not a PDU that is off or a rack without one", () => {
    const s = withPdu(at(7), "pdu-24", 12);
    expect(modelById(dev(s, s.devices.at(-1)!.id).model).height).toBe(0);
    expect(powerCycle(s, "dev4").ok).toBe(true);
    const pdu = s.devices.at(-1)!;
    expect(err(powerCycle(s, pdu.id))).toBe("error.noBmc");
    setPower(s, pdu.id, false);
    expect(pduOf(s, dev(s, "dev3"))).toBeUndefined();
    expect(err(powerCycle(s, "dev3"))).toBe("error.noBmc");
    const two = ok(buyDevice(s, "pdu-8", "Eatin", 1, "loc1"));
    expect(err(mountDevice(s, two, "rack2", 14))).toBe("error.pduInstalled");
  });
});
