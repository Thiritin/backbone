import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterDefaults } from "../src/sim/60-infra/cluster";
import { maintenanceBlockers } from "../src/sim/60-infra/vmwhere";
import { runsHot } from "../src/sim/60-infra/ha";
import { tick } from "../src/sim/88-tick/tick";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { addCustomer } from "../src/sim/90-actions/customers";
import { createVm, provisionService, setBalancer, setHa } from "../src/sim/90-actions/clusters";
import { connect } from "../src/sim/90-actions/hardware";
import { applyRec, enterMaintenance, exitMaintenance, setDrs, upgradeEdition } from "../src/sim/90-actions/vmwhere";
import { buyDevice, hypervisor, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);
const cl = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const SMALL = { vcpu: 1, ramGb: 1, diskGb: 20 };

// A two-node VMwhere cluster with live migration and the balancer, on the given edition.
function setup(edition = "enterprise") {
  const s = { ...withServer(newGame(3)), cash: 1e6 };
  skipTo(s, 2010);
  s.unlocks = [...s.unlocks, "virtualization"];
  const r = buyDevice(s, "g1-compute", "Dwell", 1, "loc1");
  if (!r.ok) throw new Error(r.error);
  mountDevice(s, r.id!, "rack2", 2);
  connect(s, { device: r.id!, port: 0 }, { device: "dev4", port: 2 });
  skipTo(s, 2013);
  const id = hypervisor(s, ["dev3", r.id!], "Cloud 1", "vmwhere");
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, licence: { tier: "essentials", trialUntil: null, lapsedAt: null } } : c));
  if (edition !== "essentials") upgradeEdition(s, id, edition);
  setHa(s, id, "live", true);
  setBalancer(s, id, true);
  return { s, id, second: r.id! };
}
// Books customer VPSs on the first node until it runs hot.
function heat(s: GameState) {
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  for (let i = 0; i < 30 && !runsHot(s, "dev3"); i++) {
    const r = provisionService(s, cus, "vps", { label: `V${i}`, spec: sizeSpec("vps", 0, yearOf(s.hour)) });
    if (!r.ok) throw new Error(`${i} ${r.error}`);
  }
  expect(runsHot(s, "dev3")).toBe(true);
}
const onFirst = (s: GameState, id: string) => s.workloads.filter((w) => w.clusterId === id && w.deviceId === "dev3").length;

describe("DRS", () => {
  it("gates Partial and Full on Enterprise and Manual on Standard", () => {
    const e = setup("essentials");
    expect(err(setDrs(e.s, e.id, "manual"))).toBe("error.needsEdition");
    const std = setup("standard");
    expect(setDrs(std.s, std.id, "manual").ok).toBe(true);
    expect(err(setDrs(std.s, std.id, "full"))).toBe("error.needsEdition");
  });

  it("Manual only recommends and the player applies one", () => {
    const { s, id, second } = setup();
    heat(s);
    expect(setDrs(s, id, "manual").ok).toBe(true);
    const before = onFirst(s, id);
    tick(s);
    expect(cl(s, id).recs.length).toBeGreaterThan(0);
    expect(onFirst(s, id)).toBe(before);
    const rec = cl(s, id).recs[0];
    expect(rec.to).toBe(second);
    expect(applyRec(s, id, rec.workloadId).ok).toBe(true);
    expect(s.workloads.find((w) => w.id === rec.workloadId)!.deviceId).toBe(second);
  });

  it("Full applies the move itself", () => {
    const { s, id } = setup();
    heat(s);
    const before = onFirst(s, id);
    expect(setDrs(s, id, "full").ok).toBe(true);
    tick(s);
    expect(onFirst(s, id)).toBeLessThan(before);
    expect(cl(s, id).recs).toEqual([]);
  });

  it("an old cluster with ha.balance true loads as Full and false as Off", () => {
    const ha = { live: true, balance: true, failover: false };
    expect(clusterDefaults({ nodes: [], ha }).drs).toBe("full");
    expect(clusterDefaults({ nodes: [], ha: { ...ha, balance: false } }).drs).toBe("off");
  });
});

describe("maintenance mode", () => {
  it("refuses while a running VM cannot move live, then empties the host", () => {
    const { s, id } = setup();
    const vm = (createVm(s, id, SMALL) as { id: string }).id;
    expect(s.workloads.find((w) => w.id === vm)!.deviceId).toBe("dev3");
    setHa(s, id, "live", false);
    expect(err(enterMaintenance(s, id, "dev3"))).toBe("error.maintenanceBlocked");
    expect(maintenanceBlockers(s, cl(s, id), "dev3")).toEqual([vm]);
    setHa(s, id, "live", true);
    expect(enterMaintenance(s, id, "dev3")).toEqual({ ok: true });
    expect(cl(s, id).nodes.find((n) => n.deviceId === "dev3")!.state).toBe("maintenance");
    expect(exitMaintenance(s, id, "dev3").ok).toBe(true);
    expect(cl(s, id).nodes.find((n) => n.deviceId === "dev3")!.state).toBe("active");
  });
});
