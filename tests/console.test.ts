import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { device, type GameState } from "../src/sim/50-state";
import { consoleScreen } from "../src/sim/60-infra/oob";
import { hardReboot, powerTick } from "../src/sim/60-infra/power";
import { BOOT_HOURS, booting, deviceHealth, working } from "../src/sim/60-infra/status";
import { enterSetup, exitSetup } from "../src/sim/90-actions/console";
import { setPower, setRaid } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

// readyGame: dev3 is a G1 Dwell server in rack2, cabled and up.
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const err = (r: object) => (r as { error?: string }).error;
const ok = (r: { ok: boolean }) => { expect(err(r)).toBeUndefined(); expect(r.ok).toBe(true); };
const hour = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) { s.hour += 1; powerTick(s); } };
const minutes = (s: GameState, n: number) => { s.minute += n; };
const storage = (s: GameState): string => {
  s.devices.push(device("dev90", "g1-storage", "Dwell", "rack2", 10, null, "fra1-st-01", modelById("g1-storage").price));
  return "dev90";
};

describe("BIOS setup", () => {
  it("opens during the boot hour, holds the boot and the workloads, and lets it run on when left", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    expect(working(s, d.id)).toBe(true);
    expect(err(enterSetup(s, d.id))).toBe("error.notAtPost");
    hardReboot(s, d, "ipmi.log.reset");
    expect(booting(s, d)).toBe(true);
    ok(enterSetup(s, d.id));
    expect(d.setup).toBe(true);
    expect(deviceHealth(s, d.id).state).toBe("setup");
    expect(consoleScreen(d, "setup").key).toBe("term.console.setup");
    hour(s, 3);
    expect(booting(s, dev(s, "dev3"))).toBe(true);
    expect(working(s, "dev3")).toBe(false);
    ok(exitSetup(s, "dev3"));
    expect(dev(s, "dev3").setup).toBe(false);
    expect(dev(s, "dev3").bootUntil).toBe(s.hour + BOOT_HOURS);
    minutes(s, 2);
    expect(working(s, "dev3")).toBe(false);
    minutes(s, 2);
    expect(working(s, "dev3")).toBe(true);
    expect(err(exitSetup(s, "dev3"))).toBe("error.notInSetup");
  });

  it("opens from the firmware prompt a stuck boot waits at", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    d.stuck = true;
    d.bootUntil = s.hour;
    expect(working(s, d.id)).toBe(false);
    ok(enterSetup(s, d.id));
    expect(d.stuck).toBe(false);
    expect(d.setup).toBe(true);
  });

  it("ends with a reset or a pulled plug", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, d.id));
    hardReboot(s, d, "ipmi.log.reset");
    expect(d.setup).toBe(false);
    ok(enterSetup(s, d.id));
    ok(setPower(s, d.id, false));
    expect(d.setup).toBe(false);
    expect(err(enterSetup(s, d.id))).toBe("error.serverOff");
  });

  it("is where the RAID level changes on a running server", () => {
    const s = readyGame(7), id = storage(s), d = dev(s, id);
    expect(err(setRaid(s, id, "5"))).toBe("error.raidInSetup");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, id));
    ok(setRaid(s, id, "5"));
    expect(d.raid).toBe("5");
    d.on = false;
    d.setup = false;
    ok(setRaid(s, id, "1"));
  });

  it("survives a save and defaults in an old one", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, d.id));
    expect(dev(deserialize(serialize(s)), "dev3").setup).toBe(true);
    const old = JSON.parse(serialize(s)) as { devices: Record<string, unknown>[] };
    for (const x of old.devices) delete x.setup;
    expect(dev(deserialize(JSON.stringify(old)), "dev3").setup).toBe(false);
  });
});
