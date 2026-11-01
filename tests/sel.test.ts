import { describe, expect, it } from "vitest";
import { setNodeState } from "../src/sim/60-infra/cluster";
import { plugCords, sevOf } from "../src/sim/60-infra/power";
import { sensorTick } from "../src/sim/60-infra/sensors";
import { failComponents } from "../src/sim/88-tick/tick";
import { clearLog } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { pmx } from "./pmx";

const dev = (s: ReturnType<typeof pmx>["s"], id = "dev3") => s.devices.find((d) => d.id === id)!;

describe("system event log", () => {
  it("logs a failed fan as critical and a lost power supply input as a warning", () => {
    const { s } = pmx(2), d = dev(s);
    const fan = d.components.find((c) => c.kind === "fan")!, psu = d.components.find((c) => c.kind === "psu")!;
    const after = failComponents(s, d, [fan.id]);
    expect(after.log.at(-1)).toMatchObject({ key: "ipmi.log.failed.fan", sev: "crit" });
    const e = dev(s);
    plugCords(s, e, false, [psu.id]);
    expect(e.log.at(-1)).toMatchObject({ key: "ipmi.log.psuLost", sev: "warn" });
    plugCords(s, e, true, [psu.id]);
    expect(e.log.at(-1)).toMatchObject({ key: "ipmi.log.psuRestored", sev: "info" });
  });

  it("numbers the entries and keeps them to the cap", () => {
    const { s } = pmx(2), d = dev(s);
    for (let i = 0; i < 30; i++) plugCords(s, d, i % 2 === 0, [d.components.find((c) => c.kind === "psu")!.id]);
    expect(d.log).toHaveLength(20);
    expect(d.log.map((e) => e.id)).toEqual([...d.log.keys()].map((i) => d.log[0].id + i));
  });

  it("logs an inlet crossing once, and its return", () => {
    const { s } = pmx(2), d = dev(s), loc = s.locations[0].id;
    const keys = () => d.log.map((e) => e.key).filter((k) => k.startsWith("ipmi.log.inlet"));
    s.ops.heat = { [loc]: 20 };
    sensorTick(s); sensorTick(s);
    expect(keys()).toEqual(["ipmi.log.inlet.warn"]);
    s.ops.heat = { [loc]: 28 };
    sensorTick(s); sensorTick(s);
    expect(keys()).toEqual(["ipmi.log.inlet.warn", "ipmi.log.inlet.crit"]);
    expect(d.log.at(-1)!.sev).toBe("crit");
    s.ops.heat = {};
    sensorTick(s);
    expect(keys().at(-1)).toBe("ipmi.log.inlet.normal");
  });

  it("logs a node state change of a cluster", () => {
    const { s, c } = pmx(2), d = dev(s);
    setNodeState(s, "dev3", "cordoned", c);
    setNodeState(s, "dev3", "cordoned", c);
    expect(d.log.filter((e) => e.key === "ipmi.log.node.cordoned")).toHaveLength(1);
  });

  it("empties the log on request", () => {
    const { s } = pmx(2), d = dev(s);
    plugCords(s, d, false, [d.components.find((c) => c.kind === "psu")!.id]);
    expect(d.log.length).toBeGreaterThan(0);
    expect(clearLog(s, "dev3").ok).toBe(true);
    expect(dev(s).log).toEqual([]);
    expect(clearLog(s, "nope").ok).toBe(false);
  });

  it("loads entries of an old save as information with an id", () => {
    const { s } = pmx(2), raw = JSON.parse(serialize(s));
    raw.devices.find((d: { id: string }) => d.id === "dev3").log = [{ hour: 1, key: "ipmi.log.powerOn" }, { hour: 2, key: "ipmi.log.shutdown" }];
    const back = deserialize(JSON.stringify(raw))!;
    expect(dev(back).log).toEqual([{ hour: 1, key: "ipmi.log.powerOn", sev: "info", id: 0 }, { hour: 2, key: "ipmi.log.shutdown", sev: "info", id: 1 }]);
  });

  it("rates keys by severity", () => {
    expect(sevOf("ipmi.log.overheat")).toBe("crit");
    expect(sevOf("ipmi.log.pulled")).toBe("warn");
    expect(sevOf("ipmi.log.powerOn")).toBe("info");
  });
});
