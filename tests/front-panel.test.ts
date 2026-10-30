import { describe, expect, it } from "vitest";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import type { GameState } from "../src/sim/50-state";
import { powerTick } from "../src/sim/60-infra/power";
import { deviceHealth, halting, pluggedIn, psusOf, working } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { atServer, reboot, remotePower } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

const base = readyGame(5);
const game = (rng = 5, model = "g2-compute"): GameState => {
  const s = structuredClone(base);
  s.rng = { s: rng };
  s.devices.find((x) => x.id === "dev3")!.model = model;
  return s;
};
const dev3 = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
const corrupted = (s: GameState) => s.workloads.filter((w) => w.deviceId === "dev3" && w.corrupted);
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
const seeds = Array.from({ length: 300 }, (_, i) => 1000 + i * 7919);

describe("power cords", () => {
  it("unplug every supply, stop the server uncleanly and leave it switched on to boot once plugged back in", () => {
    const hits = seeds.filter((r) => { const s = game(r); atServer(s, "dev3", "pull"); return corrupted(s).length > 0; });
    expect(hits.length).toBeGreaterThan(0);
    const s = game(hits[0]);
    expect(working(s, "dev3")).toBe(true);
    expect(atServer(s, "dev3", "pull").ok).toBe(true);
    expect(psusOf(dev3(s)).every((c) => c.plugged === false)).toBe(true);
    expect(dev3(s).on).toBe(true);
    expect(deviceHealth(s, "dev3").state).toBe("nopower");
    expect(corrupted(s).length).toBeGreaterThan(0);
    expect(atServer(s, "dev3", "pull")).toEqual({ ok: false, error: "error.unplugged" });
    expect(atServer(s, "dev3", "plug").ok).toBe(true);
    expect(pluggedIn(dev3(s))).toBe(true);
    expect(deviceHealth(s, "dev3").state).toBe("booting");
    expect(atServer(s, "dev3", "plug")).toEqual({ ok: false, error: "error.plugged" });
  });
});

describe("front buttons", () => {
  it("shut a running server down cleanly with the power button and boot it with the next press", () => {
    for (const r of seeds.slice(0, 20)) {
      const s = game(r);
      expect(atServer(s, "dev3", "power").ok).toBe(true);
      expect(halting(dev3(s))).toBe(true);
      tick(s);
      expect(dev3(s).on).toBe(false);
      expect(corrupted(s)).toHaveLength(0);
      expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.shutdown");
    }
    const s = game();
    atServer(s, "dev3", "power");
    tick(s);
    expect(atServer(s, "dev3", "power").ok).toBe(true);
    expect(deviceHealth(s, "dev3").state).toBe("booting");
    run(s, 2);
    expect(working(s, "dev3")).toBe(true);
  });

  it("leave a hung server to a hold of the power button or the reset button", () => {
    const s = game();
    dev3(s).hung = true;
    expect(atServer(s, "dev3", "power")).toEqual({ ok: false, error: "error.unresponsive" });
    expect(atServer(s, "dev3", "reset").ok).toBe(true);
    expect(dev3(s).hung).toBe(false);
    expect(dev3(s).on).toBe(true);
    expect(deviceHealth(s, "dev3").state).toBe("booting");
    expect(dev3(s).log.some((e) => e.key === "ipmi.log.reset")).toBe(true);
    expect(atServer(s, "dev3", "hold").ok).toBe(true);
    expect(dev3(s).on).toBe(false);
    expect(atServer(s, "dev3", "reset")).toEqual({ ok: false, error: "error.alreadyOff" });
  });

  it("wait for the remote hands in a datacenter", () => {
    const s = game();
    s.locations[0].dc = DATACENTERS[0].id;
    const cash = s.cash;
    expect(atServer(s, "dev3", "reset").ok).toBe(true);
    expect(s.cash).toBeCloseTo(cash - DATACENTERS[0].remoteHands.perHour, 6);
    expect(dev3(s).hands?.kind).toBe("reset");
    expect(atServer(s, "dev3", "pull")).toEqual({ ok: false, error: "error.handsBusy" });
    s.hour = Math.ceil(dev3(s).hands!.doneAt);
    powerTick(s);
    expect(dev3(s).hands).toBeNull();
    expect(deviceHealth(s, "dev3").state).toBe("booting");
  });
});

describe("remote power", () => {
  it("reboots cleanly through the operating system and boots again", () => {
    for (const r of seeds.slice(0, 20)) {
      const s = game(r);
      expect(reboot(s, "dev3").ok).toBe(true);
      expect(corrupted(s)).toHaveLength(0);
      expect(deviceHealth(s, "dev3").state).toBe("booting");
    }
    const s = game();
    dev3(s).hung = true;
    expect(reboot(s, "dev3")).toEqual({ ok: false, error: "error.unresponsive" });
  });

  it("switches on and off through a management controller, and not without one or a switched PDU", () => {
    const s = game();
    expect(remotePower(s, "dev3", false).ok).toBe(true);
    expect(dev3(s).on).toBe(false);
    expect(remotePower(s, "dev3", true).ok).toBe(true);
    expect(dev3(s).on).toBe(true);
    const old = game(5, "g1-compute");
    expect(remotePower(old, "dev3", false)).toEqual({ ok: false, error: "error.noBmc" });
    dev3(s).bmcHung = true;
    expect(remotePower(s, "dev3", false)).toEqual({ ok: false, error: "error.bmcHung" });
  });
});
