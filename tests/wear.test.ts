import { describe, expect, it } from "vitest";
import { COMPONENTS, componentKinds, modelById } from "../src/sim/10-catalog/hardware";
import { newGame, type Device, type GameState } from "../src/sim/50-state";
import { arrayLost, BOOT_HOURS, deviceHealth, linkStatus, raidTolerance, raidUsable, rackPower } from "../src/sim/60-infra/status";
import { failComponents, failureChance, rebuildHours, tick, type SimEvent } from "../src/sim/88-tick/tick";
import {
  addLocation, buyCircuit, buyDevice, buyRack, connect, replaceComponent, setCableColor, setFeed, setLabel, setPower,
  setRaid, setRebuildRate, unmountDevice,
} from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addNode, createCluster, provisionService } from "../src/sim/90-actions/clusters";
import { installed, withServer } from "./fixtures";
import { deserialize, serialize } from "../src/sim/91-save/save";

const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 1_000_000 });
const ok = (r: ReturnType<typeof setPower>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ReturnType<typeof setPower>) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const comp = (s: GameState, id: string, kind: string, n = 0) => dev(s, id).components.filter((c) => c.kind === kind)[n];
const fail = (s: GameState, id: string, ...componentIds: string[]) => {
  s.devices = s.devices.map((d) => (d.id === id ? failComponents(s, d, componentIds) : d));
};
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
// Replaces the starting server with a stored model in the basement rack, cabled to the switch.
function server(s: GameState, model: string, brand = "Dwell"): string {
  ok(unmountDevice(s, "dev3"));
  const id = ok(buyDevice(s, model, brand, 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 1));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 0 }));
  return id;
}
const part = (s: GameState, kind: string, loc = "loc1") => ok(buyDevice(s, `part-${kind}`, "Generic", 1, loc));

describe("components and failure rates", () => {
  it("builds every model from its parts", () => {
    const kinds = (id: string) => componentKinds(modelById(id));
    expect(kinds("g1-compute")).toEqual(["hdd", "psu", "fan", "fan", "fan", "fan", "ram", "ram", "ram", "ram", "board", "cpu", "cpu", "nic"]);
    expect(kinds("g4-storage").filter((k) => k === "ssd")).toHaveLength(12);
    expect(kinds("g1-compute-2psu").filter((k) => k === "psu")).toHaveLength(2);
    expect(kinds("sw-24")).toEqual(["psu", "fan", "fan", "board"]);
    expect(kinds("fw-1g")).toEqual(["psu", "fan", "fan", "board"]);
    expect(kinds("patch-24")).toEqual([]);
    expect(modelById("part-hdd")).toMatchObject({ kind: "part", price: 120, height: 0 });
    expect(withServer(newGame(1)).devices[0].components.every((c) => c.installedAt === 0 && c.failedAt === null)).toBe(true);
  });
  it("uses the rate before and after the life expectancy, the manufacturer factor and double while hot", () => {
    const s = rich();
    const d = dev(s, "dev3");
    const hdd = comp(s, "dev3", "hdd");
    expect(failureChance(s, d, hdd)).toBeCloseTo(0.015 / 8760, 12);
    s.hour = 5 * 8760;
    expect(failureChance(s, d, hdd)).toBeCloseTo(0.08 / 8760, 12);
    expect(failureChance(s, { ...d, brand: "SuperMacro" }, hdd)).toBeCloseTo((0.08 * 1.3) / 8760, 12);
    fail(s, "dev3", comp(s, "dev3", "fan").id);
    expect(deviceHealth(s, "dev3").state).toBe("hot");
    expect(failureChance(s, dev(s, "dev3"), hdd)).toBeCloseTo((0.08 * 2) / 8760, 12);
    // After 5 years only the drive is past its life; fans last 6.
    expect(deviceHealth(s, "dev3").worn.map((c) => c.kind)).toEqual(["hdd"]);
    expect(COMPONENTS.cpu).toEqual({ life: 15, before: 0.0005, after: 0.002, price: 400, hotSwap: "no" });
  });
  it("draws failures every hour and only notifies with monitoring", () => {
    const play = (monitoring: boolean) => {
      const s = rich();
      ok(unmountDevice(s, "dev3"));
      const first = ok(buyDevice(s, "g1-archive", "Dwell", 5, "loc1"));
      s.devices = s.devices.map((d) => ({ ...d, components: d.components.map((c) => ({ ...c, installedAt: -10 * 8760 })) }));
      for (let i = 0; i < 5; i++) ok(mountDevice(s, `dev${Number(first.slice(3)) + i}`, "rack2", 1 + 4 * i));
      if (monitoring) s.unlocks = ["monitoring"];
      const events = run(s, 2000);
      return { failed: s.devices.flatMap((d) => d.components.filter((c) => c.failedAt !== null)).length, events: events.filter((e) => e.key === "event.componentFailed").length };
    };
    const quiet = play(false), loud = play(true);
    expect(quiet.failed).toBeGreaterThan(0);
    expect(quiet.events).toBe(0);
    expect(loud).toEqual({ failed: quiet.failed, events: quiet.failed });
  });
});

describe("RAID", () => {
  it("trades usable space for drives survived per level", () => {
    const s = rich();
    const id = server(s, "g1-storage");
    expect(dev(s, id).raid).toBe("1");
    expect(dev(s, "dev3").raid).toBe("none");
    ok(setPower(s, id, false));
    const rows = (["none", "1", "5", "6", "10"] as const).map((level) => {
      ok(setRaid(s, id, level));
      return [level, raidUsable(dev(s, id)), raidTolerance(dev(s, id))];
    });
    expect(rows).toEqual([["none", 6000, 0], ["1", 3000, 1], ["5", 5500, 1], ["6", 5000, 2], ["10", 3000, 1]]);
    const drives = dev(s, id).components.filter((c) => c.kind === "hdd");
    expect(arrayLost({ ...dev(s, id), components: dev(s, id).components.map((c) => (c === drives[0] || c === drives[2] ? { ...c, failedAt: 0 } : c)) })).toBe(false);
    expect(arrayLost({ ...dev(s, id), components: dev(s, id).components.map((c) => (c === drives[0] || c === drives[1] ? { ...c, failedAt: 0 } : c)) })).toBe(true);
    expect(dev(s, id).dataLost).toBeNull();
  });
  it("loses data on a level change only when the server holds data", () => {
    const s = rich();
    const id = server(s, "g1-storage");
    ok(setPower(s, id, false));
    ok(setRaid(s, id, "5"));
    expect(dev(s, id).dataLost).toBeNull();
    ok(setPower(s, id, true));
    s.hour += BOOT_HOURS;
    ok(addNode(s, installed(s, ok(createCluster(s, "loc1", "Storage 1"))), id));
    ok(provisionService(s, addCustomer(s, "Ada", "private"), "vps", { label: "ada.example", plan: "vps-s" }));
    ok(setPower(s, id, false));
    s.hour = 7;
    ok(setRaid(s, id, "none"));
    expect(dev(s, id).dataLost).toBe(7);
  });
  it("only changes the level of a server that is off and has enough drives", () => {
    const s = rich();
    expect(err(setRaid(s, "dev3", "1"))).toBe("error.raidLevel");
    expect(err(setRaid(s, "dev4", "none"))).toBe("error.notServer");
    const id = server(s, "g1-storage");
    expect(err(setRaid(s, id, "5"))).toBe("error.powerOffFirst");
    ok(setRebuildRate(s, id, "high"));
    expect(err(setRebuildRate(s, id, "warp" as never))).toBe("error.unknownRate");
  });
  it("keeps a degraded array running, then rebuilds the replaced drive", () => {
    const s = rich();
    const id = server(s, "g1-storage");
    const drive = comp(s, id, "hdd", 3);
    fail(s, id, drive.id);
    expect(deviceHealth(s, id)).toMatchObject({ state: "degraded", failed: [{ ...drive, failedAt: 0 }] });
    expect(linkStatus(s, id).online).toBe(true);
    expect(dev(s, id).dataLost).toBeNull();
    part(s, "hdd");
    ok(replaceComponent(s, id, drive.id));
    expect(deviceHealth(s, id).state).toBe("maintenance");
    expect(linkStatus(s, id).online).toBe(true);
    ok(setRebuildRate(s, id, "low"));
    run(s, 1);
    const fresh = dev(s, id).components[3];
    expect(fresh).toMatchObject({ kind: "hdd", installedAt: 1, failedAt: null });
    expect(fresh.id).not.toBe(drive.id);
    expect(dev(s, id).rebuild).toEqual({ componentId: fresh.id, doneAt: 1 + rebuildHours(dev(s, id)) });
    expect(rebuildHours(dev(s, id))).toBeCloseTo((500 * 1000 * 0.7) / 50 / 3600, 9);
    expect(deviceHealth(s, id).state).toBe("rebuilding");
    run(s, 2);
    expect(deviceHealth(s, id).state).toBe("ok");
  });
  it("loses the data of a drive without RAID and comes back empty after the swap", () => {
    const s = rich();
    const drive = comp(s, "dev3", "hdd");
    s.hour = 10;
    fail(s, "dev3", drive.id);
    expect(dev(s, "dev3").dataLost).toBe(10);
    expect(deviceHealth(s, "dev3").state).toBe("down");
    expect(linkStatus(s, "dev3").online).toBe(false);
    part(s, "hdd");
    expect(err(replaceComponent(s, "dev3", drive.id))).toBe("error.powerOffFirst");
    ok(setPower(s, "dev3", false));
    ok(replaceComponent(s, "dev3", drive.id));
    run(s, 1);
    ok(setPower(s, "dev3", true));
    s.hour += BOOT_HOURS;
    expect(linkStatus(s, "dev3").online).toBe(true);
    expect(dev(s, "dev3")).toMatchObject({ dataLost: 10, rebuild: null });
  });
});

describe("power supplies, fans and power", () => {
  it("survives one of two power supplies and swaps it while running", () => {
    const s = rich();
    const id = server(s, "g1-compute-2psu");
    const [a, b] = dev(s, id).components.filter((c) => c.kind === "psu");
    fail(s, id, a.id);
    expect(deviceHealth(s, id).state).toBe("degraded");
    expect(linkStatus(s, id).online).toBe(true);
    part(s, "psu");
    ok(replaceComponent(s, id, a.id));
    run(s, 1);
    fail(s, id, b.id, dev(s, id).components.find((c) => c.kind === "psu" && c.id !== b.id)!.id);
    expect(deviceHealth(s, id).state).toBe("down");
    const single = rich();
    fail(single, "dev3", comp(single, "dev3", "psu").id);
    expect(linkStatus(single, "dev3").online).toBe(false);
    part(single, "psu");
    expect(err(replaceComponent(single, "dev3", comp(single, "dev3", "psu").id))).toBe("error.powerOffFirst");
  });
  it("swaps a fan while running and needs the device off for RAM", () => {
    const s = rich();
    const fan = comp(s, "dev3", "fan");
    fail(s, "dev3", fan.id);
    expect(linkStatus(s, "dev3").online).toBe(true);
    expect(err(replaceComponent(s, "dev3", fan.id))).toBe("error.noPart");
    part(s, "fan");
    ok(replaceComponent(s, "dev3", fan.id));
    expect(err(replaceComponent(s, "dev3", fan.id))).toBe("error.busy");
    run(s, 1);
    expect(deviceHealth(s, "dev3").state).toBe("ok");
    const ram = comp(s, "dev3", "ram");
    part(s, "ram");
    expect(err(replaceComponent(s, "dev3", ram.id))).toBe("error.powerOffFirst");
    expect(err(replaceComponent(s, "dev3", "c99"))).toBe("error.unknownComponent");
    ok(setPower(s, "dev3", false));
    // Preventive: the RAM stick works, and the swap still goes through.
    ok(replaceComponent(s, "dev3", ram.id));
  });
  it("takes everything behind a switch down when the switch is powered off", () => {
    const s = rich();
    expect(rackPower(s, "rack2").watts).toBe(258);
    ok(setPower(s, "dev4", false));
    expect(deviceHealth(s, "dev4").state).toBe("off");
    expect([linkStatus(s, "dev4").online, linkStatus(s, "dev3").online]).toEqual([false, false]);
    expect(rackPower(s, "rack2").watts).toBe(250);
    ok(setPower(s, "dev4", true));
    s.hour += BOOT_HOURS;
    expect(linkStatus(s, "dev3").online).toBe(true);
    const stored = ok(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    expect(err(setPower(s, stored, false))).toBe("error.notMounted");
    expect(err(mountDevice(s, part(s, "fan"), "rack2", 10))).toBe("error.notMountable");
  });
  it("labels devices and colours cables", () => {
    const s = rich();
    ok(setLabel(s, "dev3", "  web  "));
    expect(dev(s, "dev3").label).toBe("web");
    ok(setLabel(s, "dev3", ""));
    expect(dev(s, "dev3").label).toBeNull();
    expect(err(setLabel(s, "dev3", "x".repeat(41)))).toBe("error.labelTooLong");
    ok(setCableColor(s, "cab6", "#ff8800"));
    expect(s.cables[0].color).toBe("#ff8800");
    expect(err(setCableColor(s, "cab6", "red"))).toBe("error.badColor");
    ok(setCableColor(s, "cab6", null));
    expect(err(setCableColor(s, "x", null))).toBe("error.unknownCable");
  });
});

describe("remote hands", () => {
  it("swaps after the response time plus 15 minutes and bills at least an hour", () => {
    const s = rich();
    const loc = ok(addLocation(s, "interaction-fra", "positions", 1));
    s.locations.find((l) => l.id === loc)!.readyAt = 0;
    const rack = ok(buyRack(s, loc, "rack-42", 1));
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc));
    ok(mountDevice(s, id, rack, 1));
    const fan = comp(s, id, "fan");
    part(s, "fan");
    expect(err(replaceComponent(s, id, fan.id))).toBe("error.noPart");
    part(s, "fan", loc);
    const cash = s.cash;
    ok(replaceComponent(s, id, fan.id));
    expect(s.cash).toBe(cash - 120);
    expect(s.ledger.at(-1)).toMatchObject({ category: "maintenance", key: "ledger.remoteHands", params: { hours: 1 }, amount: -120 });
    expect(dev(s, id).maintenance!.doneAt).toBe(2.25);
    run(s, 2);
    expect(dev(s, id).maintenance).not.toBeNull();
    run(s, 1);
    expect(dev(s, id).maintenance).toBeNull();
    expect(comp(s, id, "fan").installedAt).toBe(3);
    // The basement has no remote hands: the swap is done by the next hour, for free.
    part(s, "fan");
    const before = s.cash;
    ok(replaceComponent(s, "dev3", comp(s, "dev3", "fan").id));
    expect(dev(s, "dev3").maintenance!.doneAt).toBe(3.25);
    expect(s.cash).toBe(before);
  });
});

describe("feeds and circuits", () => {
  it("doubles the limit with a high-density feed and bills feeds monthly", () => {
    const s = rich();
    const loc = ok(addLocation(s, "interaction-fra", "positions", 1));
    const rack = ok(buyRack(s, loc, "rack-42", 1));
    expect(rackPower(s, rack).limitWatts).toBe(6000);
    ok(setFeed(s, rack, "highDensity", true));
    ok(setFeed(s, rack, "b", true));
    expect(rackPower(s, rack).limitWatts).toBe(12000);
    run(s, 744);
    const feeds = s.ledger.filter((l) => l.key === "ledger.feed").map((l) => [l.params.feed, l.amount]);
    expect(feeds).toEqual([["feedB", -240], ["highDensity", -360]]);
    expect(err(setFeed(s, "rack2", "b", true))).toBe("error.noFeeds");
    const share = ok(addLocation(s, "interaction-fra", "share", 8));
    expect(err(setFeed(s, s.racks.find((r) => r.locationId === share)!.id, "b", true))).toBe("error.providedRack");
  });
  it("adds one household circuit to the basement for €400", () => {
    const s = rich();
    ok(buyCircuit(s, "loc1"));
    expect(rackPower(s, "rack2").limitWatts).toBe(6000);
    expect(s.cash).toBe(1_000_000 - 400);
    expect(err(buyCircuit(s, "loc1"))).toBe("error.alreadyBought");
    expect(err(buyCircuit(s, ok(addLocation(s, "spree-colo", "positions", 1))))).toBe("error.notBasement");
  });
});

describe("saves", () => {
  it("gives older devices components installed when they were bought and fills the other new fields", () => {
    const s = rich();
    s.hour = 9000;
    const id = ok(buyDevice(s, "sw-24", "Sysko", 1, "loc1"));
    const raw = JSON.parse(serialize(s));
    for (const d of raw.devices as Partial<Device>[]) {
      for (const k of ["components", "on", "label", "raid", "rebuildRate", "rebuild", "maintenance", "dataLost"] as const) delete d[k];
    }
    for (const c of raw.cables) delete c.color;
    for (const r of raw.racks) {
      delete r.feedB;
      delete r.highDensity;
    }
    for (const l of raw.locations) delete l.extraCircuit;
    delete raw.unlocks;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded).toEqual(s);
    expect(loaded.devices.find((d) => d.id === id)!.components.every((c) => c.installedAt === 9000)).toBe(true);
  });
});
