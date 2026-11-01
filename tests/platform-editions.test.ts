import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { licenseCost } from "../src/sim/85-products/products";
import { setBackup, setBalancer, setHa } from "../src/sim/90-actions/clusters";
import { installBlock } from "../src/sim/90-actions/software";
import { backupTargets } from "../src/sim/60-infra/cluster";
import { connect } from "../src/sim/90-actions/hardware";
import { buyDevice, hypervisor, panelServer, skipTo, withServer, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);
function server(s: GameState, slot: number) {
  const r = buyDevice(s, "g1-compute", "Dwell", 1, "loc1");
  if (!r.ok) throw new Error(r.error);
  mountDevice(s, r.id!, "rack2", slot);
  connect(s, { device: r.id!, port: 0 }, { device: "dev4", port: slot });
  return r.id!;
}
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

function setup(platform: string, year: number) {
  const s = { ...withServer(newGame(3)), cash: 1e6 };
  skipTo(s, year);
  s.unlocks = [...s.unlocks, "virtualization"];
  const second = server(s, 2), third = server(s, 3);
  return { s, id: hypervisor(s, ["dev3", second], "Cloud 1", platform), third };
}

describe("hypervisor editions", () => {
  it("never balances on Proxmocks", () => {
    const { s, id } = setup("proxmocks", 2010);
    expect(setHa(s, id, "live", true).ok).toBe(true);
    expect(err(setHa(s, id, "balance", true))).toBe("error.needsBalancer");
    expect(err(setBalancer(s, id, true))).toBe("error.noBalancer");
  });

  it("balances on VMwhere with Enterprise Plus, billed per node, and stops when it is cancelled", () => {
    const { s, id } = setup("vmwhere", 2010);
    setHa(s, id, "live", true);
    expect(err(setHa(s, id, "balance", true))).toBe("error.needsBalancer");
    const before = licenseCost(s, cluster(s, id)).platform;
    expect(setBalancer(s, id, true).ok).toBe(true);
    expect(setHa(s, id, "balance", true).ok).toBe(true);
    expect(licenseCost(s, cluster(s, id)).platform - before).toBe(90);
    expect(setBalancer(s, id, false).ok).toBe(true);
    expect(cluster(s, id).ha.balance).toBe(false);
  });

  it("installs OpenStash only after cloud orchestration", () => {
    const s = withServer(newGame(3));
    skipTo(s, 2012);
    expect(installBlock(s, "dev3", "openstash")).toBe("error.missingSkill");
    s.unlocks = [...s.unlocks, "cloudOrchestration"];
    expect(installBlock(s, "dev3", "openstash")).not.toBe("error.missingSkill");
  });
});

describe("backup software", () => {
  it("backs up only the software it reads", () => {
    const { s, id, third } = setup("vmwhere", 2010);
    const backula = panelServer(s, third, "backula");
    expect(backupTargets(s, cluster(s, id))).toEqual([]);
    expect(err(setBackup(s, id, backula, "daily"))).toBe("error.backupIncompatible");
    const veeham = panelServer(s, server(s, 4), "veeham");
    expect(backupTargets(s, cluster(s, id)).map((c) => c.id)).toEqual([veeham]);
    expect(setBackup(s, id, veeham, "daily").ok).toBe(true);
    expect(err(setBackup(s, backula, id, "daily"))).toBe("error.backupTarget");
  });
});
