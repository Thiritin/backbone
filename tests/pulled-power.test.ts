import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { rebuildHours, tick } from "../src/sim/88-tick/tick";
import { lostDisk } from "../src/sim/60-infra/cluster";
import { REBUILD_PERF, nodeUsage } from "../src/sim/60-infra/usage";
import { powerCycle, reset, setPower, shutdown } from "../src/sim/90-actions/hardware";
import { recover, restoreWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const base = readyGame(3);
const at = (rng: number): GameState => { const s = structuredClone(base); s.rng = { s: rng }; return s; };
const dev3 = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
const onDev3 = (s: GameState) => s.workloads.filter((w) => w.deviceId === "dev3");
const corrupted = (s: GameState) => onDev3(s).filter((w) => w.corrupted);
// A rng state for which the first roll after the call is a hit or a miss.
const seeds = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i * 7919);

describe("pulled power", () => {
  it("has workloads on the basement server to lose", () => {
    expect(onDev3(base).length).toBeGreaterThan(0);
    expect(dev3(base).raid).toBe("none");
  });

  it("corrupts about 15% of the time and the same seed always rolls the same", () => {
    const hits = seeds(400).filter((r) => { const s = at(r); setPower(s, "dev3", false); return corrupted(s).length > 0; });
    expect(hits.length / 400).toBeGreaterThan(0.09);
    expect(hits.length / 400).toBeLessThan(0.21);
    const s = at(hits[0]);
    setPower(s, "dev3", false);
    expect(corrupted(s).length).toBe(onDev3(s).length);
    expect(dev3(s).log.at(-1)).toEqual({ hour: s.hour, key: "ipmi.log.corrupted" });
    const t = at(hits[0]);
    setPower(t, "dev3", false);
    expect(t.workloads).toEqual(s.workloads);
  });

  it("never corrupts after a graceful shutdown", () => {
    for (const r of seeds(100)) {
      const s = at(r);
      expect(shutdown(s, "dev3").ok).toBe(true);
      expect(corrupted(s)).toHaveLength(0);
      expect(dev3(s).on).toBe(false);
    }
  });

  it("does not roll for a server without running workloads", () => {
    const s = at(1000);
    s.workloads = s.workloads.map((w) => ({ ...w, stopped: true }));
    const rng = s.rng.s;
    setPower(s, "dev3", false);
    expect(s.rng.s).toBe(rng);
  });

  it("also corrupts on a reset and a power cycle", () => {
    const s = at(1000);
    const hit = seeds(200).find((r) => { const t = at(r); setPower(t, "dev3", false); return corrupted(t).length > 0; })!;
    for (const act of [reset, powerCycle]) {
      const t = at(hit);
      dev3(t).model = "g2-compute";
      expect(act(t, "dev3").ok).toBe(true);
      expect(corrupted(t).length).toBeGreaterThan(0);
      expect(dev3(t).on).toBe(true);
      expect(dev3(t).bootUntil).toBeGreaterThan(t.hour);
    }
    expect(s.workloads).toEqual(base.workloads);
  });

  it("announces the corruption once with an alert and takes the workloads down", () => {
    const hit = seeds(200).find((r) => { const t = at(r); setPower(t, "dev3", false); return corrupted(t).length > 0; })!;
    const s = at(hit);
    setPower(s, "dev3", false);
    setPower(s, "dev3", true);
    expect(onDev3(s).every((w) => lostDisk(s, w))).toBe(true);
    expect(tick(s).filter((e) => e.key === "event.dataCorrupted")).toHaveLength(1);
    expect(tick(s).filter((e) => e.key === "event.dataCorrupted")).toHaveLength(0);
  });
});

describe("raid with its redundancy intact", () => {
  const mirrored = (rng: number): GameState => {
    const s = at(rng);
    const d = dev3(s);
    d.components.push({ ...d.components.find((c) => c.kind === "hdd" || c.kind === "ssd")!, id: "c99" });
    d.raid = "1";
    return s;
  };

  it("resyncs for the rebuild time and loses nothing", () => {
    const hit = seeds(300).find((r) => { const t = at(r); setPower(t, "dev3", false); return corrupted(t).length > 0; })!;
    const s = mirrored(hit);
    setPower(s, "dev3", false);
    expect(corrupted(s)).toHaveLength(0);
    const rb = dev3(s).rebuild!;
    expect(rb.doneAt).toBeCloseTo(s.hour + rebuildHours(dev3(s)), 6);
    expect(dev3(s).log.at(-1)?.key).toBe("ipmi.log.resync");
    setPower(s, "dev3", true);
    expect(onDev3(s).some((w) => lostDisk(s, w))).toBe(false);
    s.hour = Math.ceil(rb.doneAt);
    tick(s);
    expect(dev3(s).rebuild).toBeNull();
  });

  it("slows the node by the rebuild rate while the array resyncs", () => {
    const s = mirrored(1000);
    const full = nodeUsage(s, "dev3").perf;
    for (const rate of ["low", "medium", "high"] as const) {
      dev3(s).rebuild = { componentId: "", doneAt: s.hour + 10 };
      dev3(s).rebuildRate = rate;
      expect(nodeUsage(s, "dev3").perf).toBeCloseTo(full * REBUILD_PERF[rate], 9);
    }
    expect(REBUILD_PERF).toEqual({ low: 0.95, medium: 0.8, high: 0.6 });
    dev3(s).rebuild = null;
    expect(nodeUsage(s, "dev3").perf).toBe(full);
  });
});

describe("recovering corrupted workloads", () => {
  const corruptedGame = (): GameState => {
    const hit = seeds(300).find((r) => { const t = at(r); setPower(t, "dev3", false); return corrupted(t).length > 0; })!;
    const s = at(hit);
    setPower(s, "dev3", false);
    setPower(s, "dev3", true);
    s.hour += 2;
    tick(s);
    return s;
  };

  it("takes half an hour and refuses what is not corrupted or already under way", () => {
    const s = corruptedGame();
    const vm = corrupted(s)[0];
    const clean = at(1000);
    expect(recover(clean, onDev3(clean)[0].id)).toEqual({ ok: false, error: "error.notCorrupted" });
    expect(recover(s, vm.id).ok).toBe(true);
    expect(s.workloads.find((w) => w.id === vm.id)!.recoverDoneAt).toBeCloseTo(s.hour + 0.5, 9);
    expect(recover(s, vm.id)).toEqual({ ok: false, error: "error.recovering" });
  });

  it("brings about 70% back fine and sends the rest to a restore", () => {
    let fine = 0, restore = 0;
    const base2 = corruptedGame();
    for (const r of seeds(200)) {
      const s = structuredClone(base2);
      s.rng = { s: r };
      for (const w of corrupted(s)) expect(recover(s, w.id).ok).toBe(true);
      const events = tick(s);
      if (corrupted(s).length === 0) fine++;
      else {
        restore++;
        expect(events.some((e) => e.key === "event.dataLoss")).toBe(true);
        expect(s.lossReports.length).toBe(1);
      }
    }
    expect(fine / 200).toBeGreaterThan(0.6);
    expect(fine / 200).toBeLessThan(0.8);
    expect(fine + restore).toBe(200);
  });

  it("restores a workload whose recovery failed", () => {
    const base2 = corruptedGame();
    const s = seeds(200).map((r) => {
      const t = structuredClone(base2);
      t.rng = { s: r };
      for (const w of corrupted(t)) recover(t, w.id);
      tick(t);
      return t;
    }).find((t) => corrupted(t).length > 0)!;
    const vm = corrupted(s)[0];
    expect(recover(s, vm.id)).toEqual({ ok: false, error: "error.needsRestore" });
    expect(restoreWorkload(s, vm.id).ok).toBe(true);
    expect(corrupted(s)).toHaveLength(0);
  });
});

describe("old saves", () => {
  it("load with the hang and log defaults", () => {
    const raw = JSON.parse(serialize(readyGame(3)));
    for (const d of raw.devices) { delete d.hung; delete d.bmcHung; delete d.log; }
    const s = deserialize(JSON.stringify(raw))!;
    expect(s.devices.every((d) => d.hung === false && d.bmcHung === false && d.log.length === 0)).toBe(true);
  });
});
