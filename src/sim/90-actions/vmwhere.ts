// VMwhere editions, DRS and maintenance mode (docs/design/plans/hypervisors-backups.md, section 3.6).
import type { GameState } from "../50-state";
import type { Drs } from "../60-infra/cluster";
import { EDITION_COST, editionAllows, editionOf, isVmwhere, maintenanceBlockers, upgradeCost } from "../60-infra/vmwhere";
import { payLicence } from "../85-products/products";
import { balances } from "../60-infra/cluster";
import { quorumBlock } from "../60-infra/quorum";
import { drain, uncordon } from "./clusters";
import type { ActionResult } from "./hardware";
import { migrateWorkload } from "./vms";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function upgradeEdition(s: GameState, clusterId: string, tierId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (!isVmwhere(c)) return fail("error.notVmwhere");
  if (!(tierId in EDITION_COST) || EDITION_COST[tierId] <= EDITION_COST[editionOf(c)]) return fail("error.editionNotHigher");
  const due = upgradeCost(c, tierId);
  if (s.cash < due) return fail("error.noCash");
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, licence: { tier: tierId, trialUntil: null, lapsedAt: null } } : x));
  payLicence(s, c, due);
  return { ok: true, id: clusterId };
}

const vmwhereCluster = (s: GameState, id: string) => s.clusters.find((x) => x.id === id && isVmwhere(x));

// Sets how DRS balances the cluster; it needs live migration and a balancer like the old auto-balancing, and Partial and Full need Enterprise.
export function setDrs(s: GameState, clusterId: string, mode: Drs): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c) return fail("error.notVmwhere");
  if (mode !== "off") {
    if (!editionAllows(c, mode === "manual" ? "drsManual" : "drs")) return fail("error.needsEdition");
    if (!c.ha.live) return fail("error.needsLiveMigration");
    if (!balances(s, c)) return fail("error.needsBalancer");
  }
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, drs: mode, recs: [], ha: { ...x.ha, balance: mode === "full" } } : x));
  return { ok: true };
}

// Applies one recommendation as a live migration.
export function applyRec(s: GameState, clusterId: string, workloadId: string): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  const rec = c?.recs.find((r) => r.workloadId === workloadId);
  if (!c || !rec) return fail("error.unknownRec");
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, recs: x.recs.filter((r) => r !== rec) } : x));
  return migrateWorkload(s, workloadId, rec.to);
}

// Drains a host into maintenance mode; a running VM that cannot leave live refuses it.
export function enterMaintenance(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c || !c.nodes.some((n) => n.deviceId === deviceId)) return fail("error.notNode");
  { const q = quorumBlock(s, c); if (q) return fail(q); }
  if (maintenanceBlockers(s, c, deviceId).length) return fail("error.maintenanceBlocked");
  return drain(s, deviceId, clusterId);
}

export function exitMaintenance(s: GameState, clusterId: string, deviceId: string): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c || !c.nodes.some((n) => n.deviceId === deviceId)) return fail("error.notNode");
  return uncordon(s, deviceId, clusterId);
}
