import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { BOOT_HOURS, deviceHealth, linkStatus, powered, rackPower, working } from "../src/sim/60-infra/status";
import { buyDevice, connect, mountDevice, mountStack, setPlugged, unmountDevice } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { failComponents, powerPerHour, tick } from "../src/sim/88-tick/tick";
import { runServers, withServer } from "./fixtures";

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
  const id = ok(buyDevice(s, model, "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 1));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 0 }));
  return id;
}

describe("power plugs", () => {
  it("counts the starting hardware as plugged in", () => {
    const s = rich();
    expect(psus(s, "dev3").every((c) => c.plugged !== false)).toBe(true);
    expect(linkStatus(s, "dev3").online).toBe(true);
  });

  it("mounts devices unplugged, without power, draw or link", () => {
    const s = rich();
    const id = fresh(s, "g1-compute");
    expect(psus(s, id).every((c) => c.plugged === false)).toBe(true);
    expect(powered(s, id)).toBe(false);
    expect(working(s, id)).toBe(false);
    expect(linkStatus(s, id).online).toBe(false);
    expect(deviceHealth(s, id).state).toBe("nopower");
    const before = rackPower(s, "rack2").watts;
    ok(setPlugged(s, id, psus(s, id)[0].id, true));
    expect(rackPower(s, "rack2").watts).toBeGreaterThan(before);
  });

  it("mounts every unit of a stack unplugged", () => {
    const s = rich();
    ok(buyDevice(s, "g1-compute", "Dwell", 2, "loc1"));
    ok(mountStack(s, "g1-compute", "Dwell", "rack2", 2));
    const mounted = s.devices.filter((d) => d.rackId === "rack2" && d.model === "g1-compute" && d.id !== "dev3");
    expect(mounted).toHaveLength(2);
    for (const d of mounted) expect(powered(s, d.id)).toBe(false);
  });

  it("boots a device once it gets its first live supply", () => {
    const s = rich();
    const id = fresh(s, "g1-compute");
    ok(setPlugged(s, id, psus(s, id)[0].id, true));
    expect(powered(s, id)).toBe(true);
    expect(deviceHealth(s, id).state).toBe("booting");
    expect(working(s, id)).toBe(false);
    run(s, BOOT_HOURS);
    expect(working(s, id)).toBe(true);
    expect(linkStatus(s, id).online).toBe(true);
    ok(setPlugged(s, id, psus(s, id)[0].id, false));
    expect(working(s, id)).toBe(false);
  });

  it("runs on either of two supplies and goes down when its only plugged one fails", () => {
    const s = rich();
    const id = fresh(s, "g1-compute-2psu");
    const [a, b] = psus(s, id);
    ok(setPlugged(s, id, a.id, true));
    ok(setPlugged(s, id, b.id, true));
    run(s, BOOT_HOURS);
    s.devices = s.devices.map((d) => (d.id === id ? failComponents(s, d, [a.id]) : d));
    expect(working(s, id)).toBe(true);
    // A second plug into an already running device does not reboot it.
    ok(setPlugged(s, id, b.id, false));
    expect(working(s, id)).toBe(false);
    ok(setPlugged(s, id, b.id, true));
    expect(deviceHealth(s, id).state).toBe("booting");
    run(s, BOOT_HOURS);
    const one = rich();
    const solo = fresh(one, "g1-compute-2psu");
    const [x, y] = psus(one, solo);
    ok(setPlugged(one, solo, x.id, true));
    ok(setPlugged(one, solo, y.id, true));
    run(one, BOOT_HOURS);
    ok(setPlugged(one, solo, y.id, false));
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
  it("draws idle watts for a server with no running workload and rated watts once one runs", () => {
    const s = rich();
    expect(rackPower(s, "rack2").watts).toBe(100 + 8);
    const idle = powerPerHour(s);
    runServers(s);
    expect(rackPower(s, "rack2").watts).toBe(250 + 8);
    expect(powerPerHour(s)).toBeGreaterThan(idle);
    s.workloads = s.workloads.map((w) => ({ ...w, stopped: true }));
    expect(rackPower(s, "rack2").watts).toBe(100 + 8);
  });
});
