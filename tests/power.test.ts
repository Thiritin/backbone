import { describe, expect, it, vi } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { cpuLoad, deviceHealth, linkStatus, powered, rackPower, roomPower, working } from "../src/sim/60-infra/status";
import { addLocation, buyRack, connect, mountDevice, mountStack, resetBreaker, setPlugged, setPower, unmountDevice } from "../src/sim/90-actions/hardware";
import { buyDevice, freeFloor, newGame } from "./fixtures";
import { breakerTick, TRIP_HOURS } from "../src/sim/60-infra/power";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { hourOfMonth, nowHours } from "../src/sim/00-core/time";
import { fanRuns, ROOM, roomTemperature } from "../src/sim/60-infra/sensors";
import { mountStack as mountPlugged } from "./plugged";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { failComponents, powerPerHour, tick, tickMinute } from "../src/sim/88-tick/tick";
import { runServers, settle, withServer } from "./fixtures";

const rich = (): GameState => ({ ...withServer(newGame(7)), cash: 1_000_000 });
const ok = (r: ReturnType<typeof setPlugged>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const psus = (s: GameState, id: string) => dev(s, id).components.filter((c) => c.kind === "psu");
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
// Swaps the starting server for a freshly mounted one of the given model, cabled to the switch.
function fresh(s: GameState, model: string): string {
  ok(unmountDevice(s, "dev3"));
  settle(s);
  const id = ok(buyDevice(s, model, "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 1));
  settle(s);
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 0 }));
  settle(s);
  return id;
}

describe("power plugs", () => {
  it("counts the starting hardware as plugged in", () => {
    const s = rich();
    expect(psus(s, "dev3").every((c) => c.plugged !== false)).toBe(true);
    expect(linkStatus(s, "dev3").online).toBe(true);
  });

  it("mounts devices plugged in and powered at once", () => {
    const s = rich();
    const id = fresh(s, "g1-compute");
    expect(psus(s, id).every((c) => c.plugged === true)).toBe(true);
    expect(powered(s, id)).toBe(true);
    const before = rackPower(s, "rack2").watts;
    ok(setPlugged(s, id, psus(s, id)[0].id, false));
    settle(s);
    expect(powered(s, id)).toBe(false);
    expect(deviceHealth(s, id).state).toBe("nopower");
    expect(rackPower(s, "rack2").watts).toBeLessThan(before);
  });

  it("mounts every unit of a stack plugged in", () => {
    const s = rich();
    ok(buyDevice(s, "g1-compute", "Dwell", 2, "loc1"));
    ok(mountStack(s, "g1-compute", "Dwell", "rack2", 2));
    settle(s);
    const mounted = s.devices.filter((d) => d.rackId === "rack2" && d.model === "g1-compute" && d.id !== "dev3");
    expect(mounted).toHaveLength(2);
    for (const d of mounted) expect(powered(s, d.id)).toBe(true);
  });

  it("boots a device once it gets its first live supply", () => {
    const s = rich();
    const id = fresh(s, "g1-compute");
    ok(setPlugged(s, id, psus(s, id)[0].id, false));
    settle(s);
    ok(setPlugged(s, id, psus(s, id)[0].id, true));
    settle(s);
    expect(powered(s, id)).toBe(true);
    expect(deviceHealth(s, id).state).toBe("booting");
    expect(working(s, id)).toBe(false);
    run(s, 1);
    expect(working(s, id)).toBe(true);
    expect(linkStatus(s, id).online).toBe(true);
    ok(setPlugged(s, id, psus(s, id)[0].id, false));
    settle(s);
    expect(working(s, id)).toBe(false);
  });

  it("runs on either of two supplies and goes down when its only plugged one fails", () => {
    const s = rich();
    const id = fresh(s, "g1-compute-2psu");
    const [a, b] = psus(s, id);
    ok(setPlugged(s, id, a.id, true));
    settle(s);
    ok(setPlugged(s, id, b.id, true));
    settle(s);
    run(s, 1);
    s.devices = s.devices.map((d) => (d.id === id ? failComponents(s, d, [a.id]) : d));
    expect(working(s, id)).toBe(true);
    // A second plug into an already running device does not reboot it.
    ok(setPlugged(s, id, b.id, false));
    settle(s);
    expect(working(s, id)).toBe(false);
    ok(setPlugged(s, id, b.id, true));
    settle(s);
    expect(deviceHealth(s, id).state).toBe("booting");
    run(s, 1);
    const one = rich();
    const solo = fresh(one, "g1-compute-2psu");
    const [x, y] = psus(one, solo);
    ok(setPlugged(one, solo, x.id, true));
    settle(one);
    ok(setPlugged(one, solo, y.id, true));
    settle(one);
    run(one, 1);
    ok(setPlugged(one, solo, y.id, false));
    settle(one);
    expect(deviceHealth(one, solo).state).toBe("ok");
    one.devices = one.devices.map((d) => (d.id === solo ? failComponents(one, d, [x.id]) : d));
    expect(working(one, solo)).toBe(false);
  });

  it("refuses to plug a stored device or a part that is not a supply", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    const r1 = setPlugged(s, id, psus(s, id)[0].id, true);
    expect(r1.ok ? "ok" : r1.error).toBe("error.notMounted");
    const fan = dev(s, "dev3").components.find((c) => c.kind === "fan")!;
    const r2 = setPlugged(s, "dev3", fan.id, false);
    expect(r2.ok ? "ok" : r2.error).toBe("error.unknownComponent");
  });

  it("loads an old save without plug states as plugged in", () => {
    const s = rich();
    const raw = JSON.parse(serialize(s));
    for (const d of raw.devices) for (const c of d.components) delete c.plugged;
    const loaded = deserialize(JSON.stringify(raw));
    expect(working(loaded, "dev3")).toBe(true);
    expect(linkStatus(loaded, "dev3").online).toBe(true);
  });
});

describe("idle draw", () => {
  it("draws idle watts for a server with no running workload and up to rated watts by its load once one runs", () => {
    const s = rich();
    expect(rackPower(s, "rack2").watts).toBe(100 + 8 + 10);
    const idle = powerPerHour(s);
    runServers(s);
    vi.spyOn(cpuLoad, "of").mockReturnValue(0.5);
    expect(rackPower(s, "rack2").watts).toBe(175 + 8 + 10);
    expect(powerPerHour(s)).toBeGreaterThan(idle);
    vi.spyOn(cpuLoad, "of").mockReturnValue(1);
    expect(rackPower(s, "rack2").watts).toBe(250 + 8 + 10);
    vi.restoreAllMocks();
    s.workloads = s.workloads.map((w) => ({ ...w, stopped: true }));
    expect(rackPower(s, "rack2").watts).toBe(100 + 8 + 10);
  });
});

describe("main breaker", () => {
  const basement = (s: GameState) => s.locations.find((l) => l.id === "loc1")!;
  // Sets the shelf's limit just below its draw.
  const overload = (s: GameState) => { s.racks.find((r) => r.id === "rack2")!.flatKw = rackPower(s, "rack2").watts / 1000 - 0.001; };
  const minutes = (s: GameState, n: number) => Array.from({ length: n }, () => tickMinute(s)).flat();
  const tripped = () => {
    const s = rich();
    overload(s);
    minutes(s, 70);
    return s;
  };

  it("trips after an hour over the limit and cuts every device in the room", () => {
    const s = rich();
    overload(s);
    expect(minutes(s, 50).some((e) => e.key === "event.roomTripped")).toBe(false);
    expect(working(s, "dev3")).toBe(true);
    expect(minutes(s, 20)).toContainEqual({ app: "Locations", key: "event.roomTripped", params: { location: basement(s).name } });
    expect(basement(s).tripped).toBe(true);
    expect(powered(s, "dev3")).toBe(false);
    expect(powered(s, "dev4")).toBe(false);
    expect(dev(s, "dev3").on).toBe(true);
    expect(roomPower(s, basement(s)).watts).toBe(0);
  });

  it("holds under the limit", () => {
    const s = rich();
    expect(minutes(s, 180).some((e) => e.key === "event.roomTripped")).toBe(false);
    expect(basement(s).tripped).toBe(false);
  });

  it("refuses the reset while the room would still draw too much", () => {
    const s = tripped();
    expect(resetBreaker(s, "loc1")).toEqual({ ok: false, error: "error.breakerOverload" });
    expect(basement(s).tripped).toBe(true);
  });

  it("resets once a device is off and boots the rest in order", () => {
    const s = tripped();
    expect(setPower(s, "dev3", false).ok).toBe(true);
    expect(resetBreaker(s, "loc1").ok).toBe(true);
    expect(basement(s).tripped).toBe(false);
    expect(powered(s, "dev4")).toBe(true);
    expect(dev(s, "dev4").bootUntil).toBeGreaterThan(nowHours(s));
    expect(dev(s, "dev3").on).toBe(false);
  });

  it("is reset by the datacenter's remote hands for their hourly rate", () => {
    const s = rich();
    const id = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
    const r = ok(buyRack(s, id, "rack-47", 1));
    ok(buyDevice(s, "g1-compute", "Dwell", 17, id));
    ok(mountPlugged(s, "g1-compute", "Dwell", r, 16));
    runServers(s);
    s.racks.find((x) => x.id === r)!.flatKw = rackPower(s, r).watts / 1000 - 0.001;
    const loc = () => s.locations.find((l) => l.id === id)!;
    breakerTick(s);
    s.hour += TRIP_HOURS;
    expect(breakerTick(s).map((e) => e.key)).toContain("event.roomTripped");
    expect(resetBreaker(s, id)).toEqual({ ok: false, error: "error.breakerProvider" });
    const hands = datacenterById(loc().dc!).remoteHands, cash = s.cash;
    s.hour += hands.responseHours;
    expect(breakerTick(s)).toContainEqual({ app: "Locations", key: "event.breakerReset", params: { location: loc().name, fee: hands.perHour } });
    expect(loc().tripped).toBe(false);
    expect(s.cash).toBeCloseTo(cash - hands.perHour);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.remoteHands", amount: -hands.perHour });
  });

  it("loads an old save untripped", () => {
    const data = JSON.parse(serialize(rich()));
    for (const l of data.locations) delete l.tripped;
    expect(deserialize(JSON.stringify(data)).locations.every((l) => l.tripped === false)).toBe(true);
  });
});

describe("room temperature", () => {
  const basement = (s: GameState) => s.locations.find((l) => l.id === "loc1")!;
  const idle = (s: GameState) => { const c = structuredClone(s); for (const d of c.devices) d.on = false; return roomTemperature(c, basement(c)); };

  it("adds 2 degrees per kW in a cool basement and 1 while the window fan runs", () => {
    const s = rich(), kw = roomPower(s, basement(s)).watts / 1000;
    expect(kw).toBeGreaterThan(0);
    expect(fanRuns(s, basement(s))).toBe(false);
    expect(roomTemperature(s, basement(s)) - idle(s)).toBeCloseTo(ROOM.perKw * kw);
    s.hour = hourOfMonth("2005-07");
    expect(fanRuns(s, basement(s))).toBe(true);
    expect(roomTemperature(s, basement(s)) - idle(s)).toBeCloseTo(ROOM.fanPerKw * kw);
  });

  it("holds a hall at its set point", () => {
    const s = rich();
    const id = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
    expect(roomTemperature(s, s.locations.find((l) => l.id === id)!)).toBe(ROOM.hallC);
  });
});
