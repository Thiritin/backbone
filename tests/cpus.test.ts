import { describe, expect, it } from "vitest";
import { cpuModel, cpuWatts, socketGens, x86Share } from "../src/sim/10-catalog/cpus";
import { boardSpec, componentParts, fits, modelById, partOffers, presetSku, vendorsOf } from "../src/sim/10-catalog/hardware";
import { presetPrice } from "../src/sim/10-catalog/parts";
import { specFor } from "../src/sim/30-market/spec";
import { device, deviceDefaults, type GameState } from "../src/sim/50-state";
import { nodeCapacity, nodeTakes } from "../src/sim/60-infra/cluster";
import { deviceWatts, installedVcpu, perCoreOf } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { setCompatMode } from "../src/sim/90-actions/cpus";
import { installPart, replaceComponent, setPower } from "../src/sim/90-actions/hardware";
import { createVm } from "../src/sim/90-actions/clusters";
import { migrationDowntime } from "../src/sim/90-actions/vms";
import { runAction } from "../src/sim/90-actions";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyBare, buyDevice, hypervisor, join, skipTo, withServer, newGame } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000 });
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const cpus = (s: GameState, id: string) => dev(s, id).components.filter((c) => c.kind === "cpu");
const spare = (s: GameState, size: number, vendor: "indel" | "amb" = "indel", gen = 1) =>
  ok(buyDevice(s, "part-cpu", "Generic", 1, "loc1", { part: { kind: "cpu", size, vendor, gen } }));
// A server of the vendor next to the basement one, cabled like it.
const second = (s: GameState, id: string, vendor: "indel" | "amb") => {
  s.devices.push({ ...device(id, "g1-compute", "Dwell", "rack2", 3, null, id, 2500), ...deviceDefaults("g1-compute", 0, componentParts(modelById("g1-compute"), vendor)) });
  s.cables.push({ id: `cab-${id}`, a: { device: id, port: 0 }, b: { device: "dev4", port: 1 }, kind: "copper", color: null });
  return id;
};

describe("CPU vendors", () => {
  it("lists two x86 makers from 2005 and Ampear from 2020, with the lead changing hands", () => {
    expect(cpuModel("amb", 1)!.perCore).toBeGreaterThan(cpuModel("indel", 1)!.perCore);
    expect(cpuModel("indel", 3)!.perCore).toBeGreaterThan(cpuModel("amb", 3)!.perCore);
    expect(cpuModel("amb", 5)!.cores).toBe(Math.round(cpuModel("indel", 5)!.cores * 1.6));
    expect(cpuModel("ampear", 5)).toBeUndefined();
    expect(cpuModel("ampear", 6)).toMatchObject({ from: 2020, perCore: 0.8, price: 0.7 });
  });

  it("sells a server model as Indel or AMB, the ARM line as Ampear only", () => {
    const s = rich();
    skipTo(s, 2017);
    const amb = ok(buyDevice(s, "g5-compute", "Dwell", 1, "loc1", { vendor: "amb" }));
    expect(cpus(s, amb).map((c) => [c.vendor, c.gen, c.size])).toEqual([["amb", 5, 32], ["amb", 5, 32]]);
    expect(dev(s, amb).components.find((c) => c.kind === "board")!.vendor).toBe("amb");
    const m = modelById("g5-compute");
    expect(presetPrice(m, 2017, "Dwell", "amb")).toBeLessThan(presetPrice(m, 2017, "Dwell", "indel"));
    expect(err(buyDevice(s, "g5-compute", "Dwell", 1, "loc1", { vendor: "ampear" }))).toBe("error.wrongVendor");
  });
});

describe("clock speeds", () => {
  it("gives every CPU a clock, with Indel giving clock back for cores and AMB holding steadier", () => {
    for (const c of [cpuModel("indel", 1)!, cpuModel("amb", 4)!, cpuModel("ampear", 7)!]) expect(c.ghz).toBeGreaterThan(2);
    expect(cpuModel("indel", 1)!.ghz).toBeGreaterThan(cpuModel("indel", 7)!.ghz);
    expect(cpuModel("amb", 7)!.ghz).toBeGreaterThan(cpuModel("indel", 7)!.ghz);
    expect(cpuModel("ampear", 5)).toBeUndefined();
  });
});

describe("sockets", () => {
  it("shares a socket across generations, AMB longer than Indel", () => {
    expect(socketGens("indel", 1)).toEqual([1, 2]);
    expect(socketGens("indel", 7)).toEqual([7]);
    expect(socketGens("amb", 1)).toEqual([1, 2, 3]);
    expect(socketGens("ampear", 6)).toEqual([6, 7]);
  });

  it("takes a newer CPU of the same socket in an older board, and no CPU of another socket", () => {
    const m = modelById("g1-compute"), board = { kind: "board" as const, vendor: "indel" as const };
    expect(fits(m, [board, { kind: "cpu", size: 8, vendor: "indel", gen: 2 }])).toBeNull();
    expect(fits(m, [board, { kind: "cpu", size: 12, vendor: "indel", gen: 3 }])).toBe("error.wrongSocket");
    expect(fits(modelById("g3-compute"), [{ kind: "board", vendor: "amb" }, { kind: "cpu", size: 1, vendor: "amb", gen: 1 }])).toBeNull();
    expect(fits(modelById("g4-compute"), [{ kind: "board", vendor: "amb" }, { kind: "cpu", size: 1, vendor: "amb", gen: 1 }])).toBe("error.wrongSocket");
  });
});

describe("mainboards", () => {
  it("name their socket and the biggest CPU they take, and refuse a bigger one", () => {
    const m = modelById("g5-compute"), a = boardSpec(m, "indel")!;
    expect(a).toMatchObject({ socket: "I3", sockets: 2, maxCores: 40 });
    expect(a.name).toBe("Indel I3-40, dual socket");
    expect(boardSpec(modelById("g5-archive"), "amb")).toMatchObject({ socket: "A2", sockets: 1 });
    expect(boardSpec(modelById("g5-compute"), "ampear")).toBeUndefined();
    const board = { kind: "board" as const, vendor: "indel" as const };
    expect(fits(m, [board, { kind: "cpu", size: 40, vendor: "indel", gen: 5 }])).toBeNull();
    expect(fits(m, [board, { kind: "cpu", size: 41, vendor: "indel", gen: 5 }])).toBe("error.cpuTooBig");
    expect(fits(modelById("g5-archive"), [board, { kind: "cpu", size: 20, vendor: "indel", gen: 5 }])).toBeNull();
    expect(fits(modelById("g5-archive"), [board, { kind: "cpu", size: 40, vendor: "indel", gen: 5 }])).toBe("error.cpuTooBig");
  });
});

describe("mainboard parts", () => {
  it("are sold per socket and top CPU, and named by them", () => {
    const boards = partOffers(2017).filter((p) => p.kind === "board");
    expect(boards.every((p) => p.vendor && p.gen && p.size)).toBe(true);
    expect(boards.some((p) => p.vendor === "indel" && p.gen === 5 && p.size === 40)).toBe(true);
    expect(boards.some((p) => p.vendor === "amb" && p.gen === 5 && p.size === 64)).toBe(true);
    expect(componentParts(modelById("g5-compute")).find((p) => p.kind === "board")).toEqual({ kind: "board", vendor: "indel", gen: 5, size: 40 });
  });
});

describe("storage lines", () => {
  it("start small in 2005 and differ by drives, bays and size", () => {
    const disk = (id: string) => modelById(id).server!;
    expect(disk("g1-backup")).toMatchObject({ drives: 6, diskGb: 960 });
    expect(disk("g1-storage")).toMatchObject({ drives: 4, diskGb: 640 });
    expect(disk("g1-archive")).toMatchObject({ drives: 12, diskGb: 6000 });
    expect(disk("g1-value")).toMatchObject({ drives: 1, diskGb: 160 });
    expect(disk("g1-compute")).toMatchObject({ drives: 1, diskGb: 500 });
    expect(disk("g1-backup").bays[0].count).toBeGreaterThan(disk("g1-backup").drives);
  });
});

describe("lines and CPU makers", () => {
  it("sells some lines with one maker only", () => {
    expect(vendorsOf(modelById("g5-compute"))).toEqual(["indel", "amb"]);
    expect(vendorsOf(modelById("g5-dense"))).toEqual(["amb", "indel"]);
    expect(vendorsOf(modelById("g5-memory"))).toEqual(["indel", "amb"]);
    expect(vendorsOf(modelById("g5-quad"))).toEqual(["indel"]);
    expect(vendorsOf(modelById("g6-arm"))).toEqual(["ampear"]);
    expect(componentParts(modelById("g5-dense")).find((p) => p.kind === "board")!.vendor).toBe("amb");
    const s = rich();
    skipTo(s, 2018);
    expect(err(buyDevice(s, "g5-quad", "Dwell", 1, "loc1", { vendor: "amb" }))).toBe("error.wrongVendor");
    expect(err(buyDevice(s, "g5-memory", "Dwell", 1, "loc1", { vendor: "ampear" }))).toBe("error.wrongVendor");
    expect(cpus(s, ok(buyDevice(s, "g5-dense", "SuperMacro", 1, "loc1"))).map((c) => c.vendor)).toEqual(["amb", "amb"]);
    expect(partOffers(2017).some((p) => p.kind === "cpu" && p.vendor === "amb")).toBe(true);
  });
});

describe("matched sockets", () => {
  it("refuses a mixed pair, another vendor's CPU and another generation's", () => {
    const m = modelById("g2-compute"), board = { kind: "board" as const, vendor: "indel" as const };
    expect(fits(m, [board, { kind: "cpu", size: 4, vendor: "indel", gen: 2 }, { kind: "cpu", size: 8, vendor: "indel", gen: 2 }])).toBe("error.mixedCpus");
    expect(fits(m, [board, { kind: "cpu", size: 4, vendor: "amb", gen: 2 }])).toBe("error.wrongVendor");
    expect(fits(m, [board, { kind: "cpu", size: 4, vendor: "indel", gen: 3 }])).toBe("error.wrongSocket");
    const s = rich();
    const id = ok(buyBare(s, "g1-compute", "Dwell", 1, "loc1", { extras: [{ kind: "cpu", size: 1, qty: 1 }] }));
    expect(err(installPart(s, id, spare(s, 2)))).toBe("error.mixedCpus");
    expect(err(installPart(s, id, spare(s, 1, "amb")))).toBe("error.wrongVendor");
    ok(installPart(s, id, spare(s, 1)));
    expect(cpus(s, id).map((c) => c.size)).toEqual([1, 1]);
  });

  it("fills every free socket from one install", () => {
    const s = rich();
    const id = ok(buyBare(s, "g1-compute", "Dwell", 1, "loc1"));
    const first = spare(s, 2);
    spare(s, 2);
    ok(installPart(s, id, first));
    expect(cpus(s, id).map((c) => c.size)).toEqual([2, 2]);
    expect(s.devices.filter((d) => d.model === "part-cpu")).toHaveLength(0);
  });

  it("swaps every socket in one hand task with one downtime", () => {
    const s = rich();
    ok(setPower(s, "dev3", false));
    const [a, b] = cpus(s, "dev3");
    spare(s, 2);
    expect(err(replaceComponent(s, "dev3", a.id))).toBe("error.noPart");
    spare(s, 2);
    ok(replaceComponent(s, "dev3", a.id));
    expect(dev(s, "dev3").maintenance).toMatchObject({ componentId: a.id, others: [b.id] });
    expect(s.devices.filter((d) => d.model === "part-cpu")).toHaveLength(0);
    while (dev(s, "dev3").maintenance) tick(s);
    expect(cpus(s, "dev3").map((c) => [c.size, c.vendor, c.gen])).toEqual([[2, "indel", 1], [2, "indel", 1]]);
  });

  it("replaces a CPU like for like on its own", () => {
    const s = rich();
    ok(setPower(s, "dev3", false));
    const [a, b] = cpus(s, "dev3");
    spare(s, 1);
    ok(replaceComponent(s, "dev3", a.id));
    expect(dev(s, "dev3").maintenance!.others).toBeUndefined();
    while (dev(s, "dev3").maintenance) tick(s);
    expect(cpus(s, "dev3").find((c) => c.id === b.id)).toBeDefined();
    expect(cpus(s, "dev3").map((c) => c.size)).toEqual([1, 1]);
  });
});

describe("installing from the UI", () => {
  it("adds a CPU to a powered-off server with the slot left out, and reports the work done", () => {
    const s = rich(), d = dev(s, "dev3"), cpu = cpus(s, "dev3")[0], sockets = cpus(s, "dev3").length;
    d.on = false;
    ok(runAction(s, "removePart", ["dev3", cpu.id, "hands"]));
    dev(s, "dev3").maintenance = null;
    const part = ok(buyDevice(s, "part-cpu", "Generic", 1, "loc1", { part: { kind: "cpu", size: cpu.size, vendor: cpu.vendor, gen: cpu.gen } }));
    ok(runAction(s, "installPart", ["dev3", part, undefined, "hands"]));
    expect(cpus(s, "dev3")).toHaveLength(sockets);
    const events = Array.from({ length: 2 }, () => tick(s)).flat();
    expect(events.map((e) => e.key)).toContain("event.workDone");
  });
});

describe("speed, watts and demand", () => {
  it("counts vCPU as cores times the speed of one core", () => {
    const m = modelById("g2-compute");
    const indel = device("a", "g2-compute", "Dwell", null, 0, null, "a", 0);
    const amb = { ...indel, ...deviceDefaults(m.id, 0, componentParts(m, "amb")) };
    // Two Xenon E5420 at 1.09 per core, two Opteroni 2356 at 0.97.
    expect(installedVcpu(indel)).toBe(8.72);
    expect(installedVcpu(amb)).toBe(7.76);
    expect(perCoreOf(amb)).toBe(0.97);
    expect(nodeCapacity(amb).vcpu).toBe(7.76);
  });

  it("draws watts per socket: Ampear at half Indel's per core, presets as before", () => {
    expect(cpuWatts("ampear", 6, 64) / 64).toBeCloseTo((cpuWatts("indel", 6, 64) / 64) / 2, 9);
    for (const id of ["g1-compute", "g5-dense", "g6-arm", "g7-dense"]) expect(deviceWatts(device("d", id, "Dwell", null, 0, null, "d", 0)), id).toBe(modelById(id).watts);
    const m = modelById("g5-compute"), amb = { ...device("d", m.id, "Dwell", null, 0, null, "d", 0), ...deviceDefaults(m.id, 0, componentParts(m, "amb")) };
    // Each socket draws its part's TDP: the preset's Xenon Gold 6148 against the Epyk 7551.
    const tdp = (v: "indel" | "amb") => 2 * presetSku(m, v)!.tdp;
    expect(deviceWatts(amb)).toBeCloseTo(m.watts - tdp("indel") + tdp("amb"), 9);
  });

  it("asks for x86 in 60% of VPS, game server and cloud orders in 2020, falling to 30% by 2026", () => {
    expect([2019, 2020, 2023, 2026, 2030].map(x86Share)).toEqual([0, 0.6, 0.45, 0.3, 0.3]);
    const share = (year: number) => Array.from({ length: 2000 }, (_, k) => specFor(1, k, "vps", 1, year)).filter((x) => x.arch === "x86").length / 2000;
    expect(share(2019)).toBe(0);
    expect(share(2020)).toBeCloseTo(0.6, 1);
    expect(share(2026)).toBeCloseTo(0.3, 1);
    expect(Array.from({ length: 200 }, (_, k) => specFor(1, k, "webHosting", 1, 2020)).some((x) => x.arch)).toBe(false);
    const s = rich(), arm = device("arm", "g6-arm", "Dwell", null, 0, null, "arm", 0);
    s.devices.push(arm);
    expect(nodeTakes(s, arm, { vcpu: 1, ramGb: 1, diskGb: 10, arch: "x86" })).toBe(false);
    expect(nodeTakes(s, arm, { vcpu: 1, ramGb: 1, diskGb: 10 })).toBe(true);
  });
});

describe("live migration across vendors", () => {
  it("is cold across vendors, live with compatibility mode at 10% less vCPU", () => {
    const s = rich();
    const cluster = hypervisor(s, ["dev3"]);
    second(s, "same", "indel");
    second(s, "other", "amb");
    join(s, cluster, "same");
    join(s, cluster, "other");
    s.clusters = s.clusters.map((c) => ({ ...c, ha: { ...c.ha, live: true } }));
    const vmId = ok(createVm(s, cluster, { vcpu: 1, ramGb: 1, diskGb: 10 })), vm = s.workloads.find((w) => w.id === vmId)!;
    vm.deviceId = "dev3";
    expect(migrationDowntime(s, vm, 1, false, "same")).toBe(0);
    expect(migrationDowntime(s, vm, 1, false, "other")).toBeGreaterThan(0);
    ok(setCompatMode(s, cluster, true));
    expect(migrationDowntime(s, vm, 1, false, "other")).toBe(0);
    expect(nodeCapacity(dev(s, "dev3"), s).vcpu).toBe(Math.round(installedVcpu(dev(s, "dev3")) * 0.9 * 100) / 100);
    ok(setCompatMode(s, cluster, false));
    expect(nodeCapacity(dev(s, "dev3"), s).vcpu).toBe(installedVcpu(dev(s, "dev3")));
  });
});

describe("old saves", () => {
  it("load with Indel or Ampear parts and every socket at the largest CPU", () => {
    const s = rich();
    s.devices.push(device("arm", "g6-arm", "Dwell", null, 0, null, "arm", 0));
    const raw = JSON.parse(serialize(s)) as GameState;
    for (const d of raw.devices) d.components = d.components.map(({ vendor: _v, gen: _g, ...c }) => c);
    raw.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "cpu")!.size = 2;
    const back = deserialize(JSON.stringify(raw));
    expect(cpus(back, "dev3").map((c) => [c.size, c.vendor, c.gen])).toEqual([[2, "indel", 1], [2, "indel", 1]]);
    expect(dev(back, "dev3").components.find((c) => c.kind === "board")!.vendor).toBe("indel");
    expect(cpus(back, "arm").map((c) => c.vendor)).toEqual(["ampear"]);
    expect(dev(back, "arm").components.find((c) => c.kind === "board")!.vendor).toBe("ampear");
  });
});
