import { tiersOf } from "../10-catalog/licence-tiers";
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Resources } from "../10-catalog/products";
import { booked, movesLive, pickNode, type Cluster } from "./cluster";

// VMwhere editions: the licence tier of a VMwhere cluster; a cluster without a tier is on Enterprise.
export const EDITION_COST: Record<string, number> = { essentials: 1, standard: 2, enterprise: 4 };
export type Feature = "failover" | "alarms" | "drsManual" | "drs" | "pools";
const NEEDS: Record<Feature, string> = { failover: "standard", alarms: "standard", drsManual: "standard", drs: "enterprise", pools: "enterprise" };

export const isVmwhere = (c: Cluster): boolean => c.platform === "vmwhere";
export const editionOf = (c: Cluster): string => c.licence?.tier ?? "enterprise";
// Other hypervisors have no editions and allow everything.
export const editionAllows = (c: Cluster, f: Feature): boolean =>
  !isVmwhere(c) || EDITION_COST[editionOf(c)] >= EDITION_COST[NEEDS[f]];
export const editionName = (id: string): string => tiersOf("vmwhere").find((x) => x.id === id)?.name ?? id;

// The one-off price of moving a cluster to a higher edition: the licence fee per node times the step in edition levels.
export function upgradeCost(c: Cluster, tierId: string): number {
  return softwareById("vmwhere").licensing[0].fee * c.nodes.length * (EDITION_COST[tierId] - EDITION_COST[editionOf(c)]);
}


// The running VMs that cannot leave a host live, which keep it out of maintenance mode.
export function maintenanceBlockers(s: GameState, c: Cluster, deviceId: string): string[] {
  return s.workloads.filter((w) => w.clusterId === c.id && w.deviceId === deviceId && !w.stopped).filter((w) => {
    const to = pickNode(s, c, w, deviceId);
    return !to || !movesLive(s, c, w, deviceId, to);
  }).map((w) => w.id);
}

// Whether a pool takes a workload booking add on top of its members, leaving out the workload skip (a resize of a member).
export function poolRoom(s: GameState, c: Cluster, poolId: string, add: Resources, skip?: string): boolean {
  const pool = c.pools.find((p) => p.id === poolId);
  if (!pool) return false;
  const use = s.workloads.filter((w) => w.clusterId === c.id && w.poolId === poolId && w.id !== skip).reduce((n, w) => {
    const b = booked(s, w);
    return { vcpu: n.vcpu + b.vcpu, ramGb: n.ramGb + b.ramGb };
  }, { vcpu: 0, ramGb: 0 });
  return (pool.vcpuLimit === null || use.vcpu + add.vcpu <= pool.vcpuLimit) && (pool.ramLimitGb === null || use.ramGb + add.ramGb <= pool.ramLimitGb + 1e-9);
}

// The shares of the pool a workload belongs to, normal without one.
export const sharesOf = (c: Cluster | undefined, w: { poolId?: string | null }): "low" | "normal" | "high" =>
  c?.pools.find((p) => p.id === w.poolId)?.shares ?? "normal";

// The performance a low pool keeps on a hot node.
export const POOL_LOW_PERF = 0.9;
