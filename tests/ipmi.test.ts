import { describe, expect, it } from "vitest";
import { hashRng, rand } from "../src/sim/00-core/rng";
import { hasBmc, MANUFACTURERS } from "../src/sim/10-catalog/hardware";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { ipmiIp } from "../src/sim/60-infra/addresses";
import { bmcHangChance, hangChance, powerTick } from "../src/sim/60-infra/power";
import { deviceHealth, halting, powered, working } from "../src/sim/60-infra/status";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { resolve } from "../src/sim/80-business/browser";
import { atServer, powerCycle, reset, resetBmc, setPower, shutdown } from "../src/sim/90-actions/hardware";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { hire, queueOperation } from "../src/sim/90-actions/staff";
import { readyGame } from "./fixtures";

const game = (model = "g2-compute", brand = "Dwell"): GameState => {
  const s = readyGame(5);
  const d = s.devices.find((x) => x.id === "dev3")!;
  d.model = model;
  d.brand = brand;
  return s;
};
const dev3 = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

describe("management controllers", () => {
  it("come with the brand and generation", () => {
    for (const brand of ["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid"]) expect(hasBmc("g1-compute", brand)).toBe(false);
    expect(hasBmc("g2-compute", "Dwell")).toBe(true);
    expect(hasBmc("g2-compute", "Hewlett-Packet")).toBe(true);
    expect(hasBmc("g2-compute", "SuperMacro")).toBe(false);
    expect(hasBmc("g2-compute", "Lenovoid")).toBe(false);
    expect(hasBmc("g3-compute", "SuperMacro")).toBe(true);
    expect(hasBmc("g3-compute", "Lenovoid")).toBe(true);
    expect(hasBmc("g5-dense", "Dwell")).toBe(true);
    expect(hasBmc("g4-arm", "SuperMacro")).toBe(true);
    expect(hasBmc("sw-8", "Sysko")).toBe(false);
    expect(MANUFACTURERS.filter((m) => m.kinds.includes("server")).map((m) => m.name)).toEqual(["Dwell", "Hewlett-Packet", "SuperMacro", "Lenovoid", "Gigabutt"]);
  });

  it("have a management address in the location's range", () => {
    const s = game();
    expect(ipmiIp(s, "dev3")).toMatch(/^192\.168\.3\.\d+$/);
    expect(ipmiIp(s, "dev3")!.split(".")[3]).toBe(String(10 + (3 % 240)));
    s.locations[0].dc = DATACENTERS[0].id;
    expect(ipmiIp(s, "dev3")).toBe(`10.${s.locations.indexOf(s.locations[0]) + 1}.2.13`);
    expect(ipmiIp(game("g1-compute"), "dev3")).toBeNull();
  });

  it("answer in the browser, also when the server is off, and not when hung", () => {
    const s = game();
    const url = `http://${ipmiIp(s, "dev3")}/`;
    expect(resolve(s, url)).toMatchObject({ page: { kind: "ipmi", deviceId: "dev3" }, load: "fast" });
    setPower(s, "dev3", false);
    expect(resolve(s, url).load).toBe("fast");
    dev3(s).bmcHung = true;
    expect(resolve(s, url).load).toBe("down");
    const plain = game("g1-compute");
    expect(resolve(plain, "http://192.168.3.13/").page.kind).toBe("notfound");
  });
});

describe("power actions", () => {
  it("shut down gracefully only while the OS answers", () => {
    const s = game();
    dev3(s).hung = true;
    expect(working(s, "dev3")).toBe(false);
    expect(shutdown(s, "dev3")).toEqual({ ok: false, error: "error.unresponsive" });
    expect(dev3(s).on).toBe(true);
    dev3(s).hung = false;
    expect(shutdown(s, "dev3").ok).toBe(true);
    expect(halting(dev3(s))).toBe(true);
    expect(shutdown(s, "dev3").ok).toBe(true);
    tick(s);
    expect(dev3(s).on).toBe(false);
    expect(shutdown(s, "dev3")).toEqual({ ok: false, error: "error.alreadyOff" });
    expect(dev3(s).log.map((e) => e.key)).toEqual(["ipmi.log.shutdown"]);
  });

  it("reset and power cycle clear a hang and boot the server again", () => {
    for (const act of [reset, powerCycle]) {
      const s = game();
      dev3(s).hung = true;
      expect(act(s, "dev3").ok).toBe(true);
      expect(dev3(s).hung).toBe(false);
      expect(deviceHealth(s, "dev3").state).toBe("booting");
      run(s, 2);
      expect(working(s, "dev3")).toBe(true);
    }
  });

  it("need a management controller that answers", () => {
    const plain = game("g1-compute");
    expect(reset(plain, "dev3")).toEqual({ ok: false, error: "error.noBmc" });
    expect(powerCycle(plain, "dev3")).toEqual({ ok: false, error: "error.noBmc" });
    expect(reset(plain, "dev3", true).ok).toBe(true);
    const s = game();
    dev3(s).bmcHung = true;
    expect(reset(s, "dev3")).toEqual({ ok: false, error: "error.bmcHung" });
    expect(powerCycle(s, "dev3")).toEqual({ ok: false, error: "error.bmcHung" });
  });

  it("let a hung server out through holding its power button, which also clears the hang", () => {
    const s = game("g1-compute");
    dev3(s).hung = true;
    expect(atServer(s, "dev3", "hold").ok).toBe(true);
    expect(dev3(s).on).toBe(false);
    expect(dev3(s).hung).toBe(false);
    expect(setPower(s, "dev3", true).ok).toBe(true);
    run(s, 2);
    expect(working(s, "dev3")).toBe(true);
  });
});

describe("hung management controllers", () => {
  it("refuse IPMI until a reset on site, which takes a quarter of an hour in the basement", () => {
    const s = game();
    expect(resetBmc(s, "dev3")).toEqual({ ok: false, error: "error.bmcFine" });
    dev3(s).bmcHung = true;
    const cash = s.cash;
    expect(resetBmc(s, "dev3").ok).toBe(true);
    expect(s.cash).toBe(cash);
    expect(dev3(s).hands!.doneAt).toBeCloseTo(s.hour + 0.25, 9);
    expect(resetBmc(s, "dev3")).toEqual({ ok: false, error: "error.handsBusy" });
    tick(s);
    expect(dev3(s).bmcHung).toBe(false);
    expect(dev3(s).hands).toBeNull();
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.bmcReset");
  });

  it("cost the remote hands for an hour and their response time in a datacenter", () => {
    const s = game();
    const dc = DATACENTERS[0];
    s.locations[0].dc = dc.id;
    dev3(s).bmcHung = true;
    const cash = s.cash;
    expect(resetBmc(s, "dev3").ok).toBe(true);
    expect(s.cash).toBeCloseTo(cash - dc.remoteHands.perHour, 6);
    expect(dev3(s).hands!.doneAt).toBeCloseTo(s.hour + dc.remoteHands.responseHours + 0.25, 9);
  });

  it("make holding the power button wait for the remote hands in a datacenter and happen at once in the basement", () => {
    const s = game("g1-compute");
    s.locations[0].dc = DATACENTERS[0].id;
    const dc = DATACENTERS[0];
    const cash = s.cash;
    expect(atServer(s, "dev3", "hold").ok).toBe(true);
    expect(dev3(s).on).toBe(true);
    expect(s.cash).toBeCloseTo(cash - dc.remoteHands.perHour, 6);
    s.hour = Math.ceil(dev3(s).hands!.doneAt);
    powerTick(s);
    expect(dev3(s).on).toBe(false);
    expect(dev3(s).hands).toBeNull();
    const b = game("g1-compute");
    expect(atServer(b, "dev3", "hold").ok).toBe(true);
    expect(dev3(b).on).toBe(false);
  });
});

describe("hangs", () => {
  it("follow the yearly rates", () => {
    const s = game();
    const year = 8760;
    expect(hangChance(s, dev3(s))).toBeCloseTo(0.01 / year, 12);
    dev3(s).components.find((c) => c.kind === "fan")!.failedAt = s.hour;
    expect(hangChance(s, dev3(s))).toBeCloseTo(0.02 / year, 12);
    s.frozen = ["dev3"];
    expect(hangChance(s, dev3(s))).toBeCloseTo(0.06 / year, 12);
    expect(bmcHangChance(s, dev3(s))).toBeCloseTo(0.01 / year, 12);
    s.hour += 6 * year + 1;
    expect(bmcHangChance(s, dev3(s))).toBeCloseTo(0.03 / year, 12);
  });

  it("hang a server and its controller on the hour the roll hits", () => {
    const s = game();
    s.unlocks = [...s.unlocks, "monitoring"];
    const hitHour = (salt: number, p: number) => { for (let h = 1; ; h++) if (rand(hashRng(h, 3, salt)) < p) return h; };
    s.hour = hitHour(1, hangChance(s, dev3(s)));
    const events = powerTick(s);
    expect(dev3(s).hung).toBe(true);
    expect(events.some((e) => e.key === "event.serverHung")).toBe(true);
    expect(working(s, "dev3")).toBe(false);
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.hung");
    const t = game();
    t.hour = hitHour(2, bmcHangChance(t, dev3(t)));
    powerTick(t);
    expect(dev3(t).bmcHung).toBe(true);
    expect(dev3(t).log.at(-1)?.key).toBe("ipmi.log.bmcHung");
  });

  it("never hang a controller the server lacks, and keep it running while the server is off", () => {
    const s = game("g1-compute");
    for (let h = 1; h < 3000; h++) { s.hour = h; powerTick(s); }
    expect(dev3(s).bmcHung).toBe(false);
    expect(powered(s, "dev3")).toBe(true);
  });

  it("keep the event log to the last 20 entries", () => {
    const s = game();
    for (let i = 0; i < 12; i++) { reset(s, "dev3"); powerCycle(s, "dev3"); }
    expect(dev3(s).log).toHaveLength(20);
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.cycle");
  });
});

describe("technician hand work", () => {
  const withTech = (s: GameState): GameState => {
    s.cash = 100_000;
    const c = visibleCandidates(s).find((x) => x.role === "technician")!;
    const r = hire(s, c.id);
    if (!r.ok) throw new Error(r.error);
    s.staff = s.staff.map((e) => (e.id === r.id ? { ...e, trained: ["hardware", "servers", "panels"] } : e));
    s.hour = 48 + 9 - 1;
    return s;
  };

  it("resets a hung server and a hung controller, also where the server has no controller", () => {
    const s = withTech(game("g1-compute"));
    expect(queueOperation(s, "reset", "dev3")).toEqual({ ok: false, error: "error.notHung" });
    dev3(s).hung = true;
    expect(queueOperation(s, "reset", "dev3").ok).toBe(true);
    run(s, 1);
    expect(dev3(s).hung).toBe(false);
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.reset");
    const t = withTech(game());
    expect(queueOperation(t, "bmcreset", "dev3")).toEqual({ ok: false, error: "error.bmcFine" });
    dev3(t).bmcHung = true;
    expect(queueOperation(t, "bmcreset", "dev3").ok).toBe(true);
    run(t, 2);
    expect(dev3(t).bmcHung).toBe(false);
  });

  it("shuts a responsive server down cleanly for a swap", () => {
    const s = withTech(game());
    expect(queueOperation(s, "off", "dev3").ok).toBe(true);
    run(s, 1);
    expect(halting(dev3(s))).toBe(true);
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.shutdown");
  });
});
