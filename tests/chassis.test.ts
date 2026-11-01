import { describe, expect, it } from "vitest";
import { bayCount, bayTakes, componentParts, MODELS, modelById, presetCores, type FormFactor } from "../src/sim/10-catalog/hardware";
import { OVERCOMMIT } from "../src/sim/10-catalog/products";
import { device, deviceDefaults, type GameState } from "../src/sim/50-state";
import { installedCores, installedRamGb, installedThreads, perCoreOf, raidUsable } from "../src/sim/60-infra/status";
import { SMT_SHARE } from "../src/sim/10-catalog/cpus";
import { nodeCapacity } from "../src/sim/60-infra/cluster";
import { freezeTick, nodeUsage } from "../src/sim/60-infra/usage";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame, withServer, newGame } from "./fixtures";

const SERVERS = MODELS.filter((m) => m.server);
const withDevice = (model: string): { s: GameState; id: string } => {
  const s = withServer(newGame(1));
  s.devices.push(device("chassis1", model, "Dwell", null, 0, null, "t", 0));
  return { s, id: "chassis1" };
};

describe("chassis slots", () => {
  // 70 single-node models and a Twin node in each generation from 2008.
  it("has the 100 server models", () => expect(SERVERS).toHaveLength(100));

  it("gives every preset parts that fit its chassis", () => {
    for (const m of SERVERS) {
      const v = m.server!, parts = componentParts(m);
      const count = (k: string) => parts.filter((p) => p.kind === k).length;
      expect(count("ram"), m.id).toBeLessThanOrEqual(v.dimmSlots);
      expect(count("cpu"), m.id).toBe(v.sockets);
      expect(count("psu"), m.id).toBeLessThanOrEqual(v.psuBays);
      expect(v.gpus * 2, m.id).toBeLessThanOrEqual(v.pcie);
      const drives = parts.filter((p) => p.ff);
      expect(drives.length, m.id).toBeLessThanOrEqual(bayCount(v));
      for (const f of new Set(drives.map((p) => p.ff!))) {
        const fitting = v.bays.filter((b) => bayTakes(b.ff, f)).reduce((n, b) => n + b.count, 0);
        expect(drives.filter((p) => p.ff === f).length, `${m.id} ${f}`).toBeLessThanOrEqual(fitting);
      }
    }
  });

  it("follows the slot table per line and generation", () => {
    const bays = (id: string) => modelById(id).server!.bays;
    expect(modelById("g1-compute").server).toMatchObject({ dimmSlots: 8, pcie: 2, psuBays: 2 });
    expect(bays("g1-compute")).toEqual([{ ff: "3.5", count: 4 }]);
    expect(bays("g2-dense")).toEqual([{ ff: "3.5", count: 4 }]);
    expect(bays("g3-compute")).toEqual([{ ff: "2.5", count: 8 }]);
    expect(bays("g4-compute")).toEqual([{ ff: "nvme", count: 10 }]);
    expect(bays("g7-arm")).toEqual([{ ff: "nvme", count: 10 }]);
    expect(modelById("g2-compute").server!.dimmSlots).toBe(8);
    expect(modelById("g4-compute").server!.dimmSlots).toBe(12);
    expect(modelById("g7-compute").server!.dimmSlots).toBe(32);
    expect(modelById("g7-memory").server).toMatchObject({ dimmSlots: 48, pcie: 4 });
    expect(bays("g3-memory")).toEqual([{ ff: "2.5", count: 8 }]);
    expect(bays("g4-memory")).toEqual([{ ff: "nvme", count: 8 }]);
    expect(bays("g1-storage")).toEqual([{ ff: "3.5", count: 8 }]);
    expect(bays("g1-backup")).toEqual([{ ff: "3.5", count: 12 }]);
    expect(bays("g1-archive")).toEqual([{ ff: "3.5", count: 24 }]);
    expect(bays("g4-backup")).toEqual([{ ff: "3.5", count: 36 }]);
    expect(modelById("g6-archive").server).toMatchObject({ dimmSlots: 16, pcie: 2 });
    expect(modelById("g3-archive").server!.dimmSlots).toBe(8);
    expect(modelById("g5-gpu").server).toMatchObject({ dimmSlots: 32, pcie: 8, gpus: 4 });
  });
});

describe("capacity from parts", () => {
  it("equals the model's cores, RAM and RAID capacity for every server", () => {
    for (const m of SERVERS) {
      const v = m.server!, { s, id } = withDevice(m.id), d = s.devices.find((x) => x.id === id)!;
      const n = d.components.filter((c) => c.ff).length, factor = { none: n, "1": n / 2, "5": n - 1, "6": n - 2, "10": n / 2 }[d.raid];
      expect(installedCores(d), m.id).toBe(presetCores(m));
      expect(installedRamGb(d), m.id).toBe(v.ramGb);
      expect(raidUsable(d), m.id).toBe(factor * (v.diskGb / v.drives));
      const vcpu = Math.round((presetCores(m) + (installedThreads(d) - presetCores(m)) * SMT_SHARE) * perCoreOf(d) * 100) / 100;
      expect(nodeCapacity(d), m.id).toEqual({ vcpu, ramGb: v.ramGb, diskGb: raidUsable(d) * OVERCOMMIT.disk });
      expect(nodeUsage(s, id).physical, m.id).toEqual({ vcpu, ramGb: v.ramGb, diskGb: raidUsable(d) });
    }
  });

  it("loses the RAM of a failed stick", () => {
    const { s, id } = withDevice("g3-compute"), d = s.devices.find((x) => x.id === id)!;
    const before = installedRamGb(d), stick = d.components.find((c) => c.kind === "ram")!;
    stick.failedAt = 10;
    expect(installedRamGb(d)).toBe(before - stick.size!);
    expect(nodeUsage(s, id).physical.ramGb).toBe(before - stick.size!);
    expect(nodeCapacity(d).ramGb).toBe(before - stick.size!);
    expect(freezeTick(s)).toEqual([]);
  });

  it("loses the cores of a failed CPU", () => {
    const { s, id } = withDevice("g4-compute"), d = s.devices.find((x) => x.id === id)!;
    const cpu = d.components.find((c) => c.kind === "cpu")!;
    cpu.failedAt = 10;
    expect(installedCores(d)).toBe(modelById("g4-compute").server!.cores - cpu.size!);
  });

  it("sizes an array by its smallest drive", () => {
    const { s, id } = withDevice("g1-storage"), d = s.devices.find((x) => x.id === id)!;
    const drives = d.components.filter((c) => c.ff);
    expect(raidUsable(d)).toBe(4 / 2 * 160);
    drives[3].size = 80;
    expect(raidUsable(d)).toBe(4 / 2 * 80);
    d.raid = "6";
    expect(raidUsable(d)).toBe(2 * 80);
    expect(nodeUsage(s, id).physical.diskGb).toBe(160);
  });

  it("keeps a failed drive in the array", () => {
    const { s, id } = withDevice("g1-storage"), d = s.devices.find((x) => x.id === id)!;
    const before = raidUsable(d);
    d.components.find((c) => c.ff)!.failedAt = 5;
    expect(raidUsable(d)).toBe(before);
  });
});

describe("old saves", () => {
  it("get part sizes from their model's preset", () => {
    const s = readyGame(3);
    s.devices.push(device("chassis1", "g4-storage", "Dwell", null, 0, null, "t", 0));
    const data = JSON.parse(serialize(s));
    for (const d of data.devices) for (const c of d.components) { delete c.size; delete c.ff; }
    const loaded = deserialize(JSON.stringify(data));
    for (const d of loaded.devices) {
      const preset = deviceDefaults(d.model, d.boughtAt).components;
      expect(d.components.map((c) => [c.kind, c.size, c.ff]), d.id).toEqual(preset.map((c) => [c.kind, c.size, c.ff]));
    }
    expect(loaded.devices.find((d) => d.id === "chassis1")!.components.some((c) => c.size === 2000 && c.ff === "3.5")).toBe(true);
  });

  it("keeps sizes a save already has", () => {
    const s = readyGame(3);
    s.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "ram")!.size = 99;
    const loaded = deserialize(serialize(s));
    expect(loaded.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "ram")!.size).toBe(99);
  });
});

describe("bay rules", () => {
  it("lets NVMe drives into NVMe bays only and 3.5 inch drives into 3.5 inch bays only", () => {
    const takes = (bay: FormFactor, drive: FormFactor) => bayTakes(bay, drive);
    expect([takes("3.5", "3.5"), takes("2.5", "3.5"), takes("nvme", "3.5")]).toEqual([true, false, false]);
    expect([takes("3.5", "2.5"), takes("2.5", "2.5"), takes("nvme", "2.5")]).toEqual([false, true, true]);
    expect([takes("3.5", "nvme"), takes("2.5", "nvme"), takes("nvme", "nvme")]).toEqual([false, false, true]);
  });
});
