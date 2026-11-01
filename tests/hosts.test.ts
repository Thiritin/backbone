import { describe, expect, it } from "vitest";
import { CURVES } from "../src/sim/10-catalog/usage";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { type GameState } from "../src/sim/50-state";
import { bookable, nodeUsed } from "../src/sim/60-infra/cluster";
import { nodeUsage, pegged, peggedHours } from "../src/sim/60-infra/usage";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService, setHa, setRamGuard } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice, newGame } from "./fixtures";
import { migrateWorkload, migrationTargets, stopWorkload } from "../src/sim/90-actions/vms";
import { hypervisor, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

// A big 2005 game server, so two of them fill most of an 8 GB node.
const FRAG = { ...sizeSpec("gameServer", 0, 2005), vcpu: 2, ramGb: 4, diskGb: 10 };

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

// The basement server and a second one in one cluster, a gamer with two Game S servers the player put on the basement server.
function setup() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const cluster = hypervisor(s, ["dev3", second], "Cloud 1");
  const gamer = addCustomer(s, "Kai Frag", "gamer");
  ok(provisionService(s, gamer, "gameServer", { label: "Frag 1", spec: FRAG, clusterId: cluster, deviceId: "dev3" }));
  ok(provisionService(s, gamer, "gameServer", { label: "Frag 2", spec: FRAG, clusterId: cluster, deviceId: "dev3" }));
  return { s, cluster, second, gamer };
}

// Ticks until the basement server freezes, within the first Saturday; returns the events of the hour it froze.
function freeze(s: GameState): SimEvent[] {
  for (let h = 0; h < 24; h++) {
    const events = tick(s);
    if (s.frozen.includes("dev3")) return events;
  }
  throw new Error("never froze");
}

describe("RAM over-provisioning", () => {
  it("places automatically within the installed RAM first, then books past it instead of refusing", () => {
    const { s, cluster, second, gamer } = setup();
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 3", spec: FRAG, clusterId: cluster }));
    expect(s.workloads.at(-1)!.deviceId).toBe(second);
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 4", spec: FRAG, clusterId: cluster }));
    expect(nodeUsed(s, second).ramGb).toBe(8);
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 5", spec: FRAG, clusterId: cluster }));
    expect(Math.max(nodeUsed(s, "dev3").ramGb, nodeUsed(s, second).ramGb)).toBeGreaterThan(8);
  });

  it("books more RAM than installed on a node the player picks and freezes it once RAM in use exceeds it", () => {
    const { s } = setup();
    expect(nodeUsed(s, "dev3").ramGb).toBe(8);
    expect(s.workloads.filter((w) => w.deviceId === "dev3")).toHaveLength(2);
    const events = freeze(s);
    const u = nodeUsage(s, "dev3");
    expect(u.used.ramGb).toBeGreaterThan(u.physical.ramGb);
    expect(events.map((e) => e.key)).toContain("event.nodeFrozen");
  });

  it("takes every workload on a frozen node down and counts the hours for each customer", () => {
    const { s } = setup();
    freeze(s);
    const services = s.workloads.filter((w) => w.deviceId === "dev3").map((w) => w.serviceId);
    for (const id of services) expect(serviceOnline(s, id)).toBe(false);
    // The hour it froze already counts as down for each of them.
    for (const id of services) expect(s.downHours[id]).toBe(1);
  });

  it("thaws as soon as a stop brings RAM in use under the installed RAM", () => {
    const { s } = setup();
    freeze(s);
    const w = s.workloads.find((x) => x.deviceId === "dev3")!;
    ok(stopWorkload(s, w.id));
    expect(s.frozen).not.toContain("dev3");
    const other = s.workloads.find((x) => x.deviceId === "dev3" && x.id !== w.id)!;
    expect(serviceOnline(s, other.serviceId)).toBe(true);
    expect(tick(s).some((e) => e.key === "event.nodeFrozen")).toBe(false);
  });

  it("thaws after a migration from the workload menu onto another node", () => {
    const { s, cluster, second } = setup();
    s.unlocks = [...s.unlocks, "virtualization"];
    ok(setHa(s, cluster, "live", true));
    freeze(s);
    const w = s.workloads.find((x) => x.deviceId === "dev3")!;
    const targets = migrationTargets(s, w.id);
    expect(targets.map((t) => t.to)).toEqual([second]);
    expect(targets[0].free.ramGb).toBeCloseTo(bookable(s, s.devices.find((d) => d.id === second)!).ramGb);
    expect(targets[0].down).toBe(0);
    ok(migrateWorkload(s, w.id, second));
    expect(s.workloads.find((x) => x.id === w.id)!.deviceId).toBe(second);
    expect(s.frozen).toEqual([]);
  });
});

describe("Memory reservation", () => {
  it("needs the skill before a cluster can turn it on", () => {
    const { s, cluster } = setup();
    expect(setRamGuard(s, cluster, true)).toEqual({ ok: false, error: "error.missingSkill" });
    s.unlocks = [...s.unlocks, "memoryReservation"];
    ok(setRamGuard(s, cluster, true));
    expect(s.clusters.find((c) => c.id === cluster)!.ramGuard).toBe(true);
  });

  it("refuses placements and moves that would book RAM beyond the installed RAM, only while on", () => {
    const { s, cluster, second, gamer } = setup();
    s.unlocks = [...s.unlocks, "memoryReservation", "virtualization"];
    ok(setHa(s, cluster, "live", true));
    const dev3 = s.devices.find((d) => d.id === "dev3")!;
    ok(setRamGuard(s, cluster, true));
    // 8 GB installed less the hypervisor's 0.25 GB.
    expect(bookable(s, dev3).ramGb).toBeCloseTo(8 - 0.25);
    const moved = s.workloads.find((w) => w.deviceId === "dev3")!;
    ok(migrateWorkload(s, moved.id, second));
    // 4 GB booked plus another 4 GB would pass the installed 8 GB less the control plane.
    expect(migrateWorkload(s, moved.id, "dev3")).toEqual({ ok: false, error: "error.nodeFull" });
    expect(migrationTargets(s, moved.id)).toEqual([]);
    ok(provisionService(s, gamer, "gameServer", { label: "Frag 3", spec: FRAG, clusterId: cluster }));
    expect(s.workloads.at(-1)!.deviceId).toBe(second);
    ok(setRamGuard(s, cluster, false));
    ok(migrateWorkload(s, moved.id, "dev3"));
  });
});

describe("pegged workloads", () => {
  it("flags a workload whose CPU ran at its booking for most of the last day, and no other", () => {
    const { s } = setup();
    const w = s.workloads[0];
    s.hour = 24 * 3 + 12;
    expect(pegged(s, w)).toBe(false);
    const saved = CURVES.game;
    try {
      CURVES.game = { weekday: [[0, 2]], weekend: [[0, 2]] };
      expect(peggedHours(s, w)).toBeGreaterThan(12);
      expect(pegged(s, w)).toBe(true);
    } finally {
      CURVES.game = saved;
    }
  });
});
