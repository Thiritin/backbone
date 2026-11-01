import { tiersOf } from "../10-catalog/licence-tiers";
import { softwareById } from "../10-catalog/platforms";
import type { Cluster } from "./cluster";

// VMwhere editions: the licence tier of a VMwhere cluster; a cluster without a tier is on Enterprise.
export const EDITION_COST: Record<string, number> = { essentials: 1, standard: 2, enterprise: 4 };
export type Feature = "failover" | "alarms" | "drs" | "pools";
const NEEDS: Record<Feature, string> = { failover: "standard", alarms: "standard", drs: "enterprise", pools: "enterprise" };

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

