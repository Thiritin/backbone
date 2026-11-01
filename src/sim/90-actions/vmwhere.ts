// VMwhere editions, DRS and maintenance mode (docs/design/plans/hypervisors-backups.md, section 3.6).
import type { GameState } from "../50-state";
import type { Drs } from "../60-infra/cluster";
import { EDITION_COST, editionAllows, editionOf, isVmwhere, maintenanceBlockers, poolRoom, upgradeCost } from "../60-infra/vmwhere";
import { payLicence } from "../85-products/products";
import { alarmKey, clusterSummary, type AlarmRules } from "../60-infra/alarms";
import { booked, balances, type Pool } from "../60-infra/cluster";
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

// Changes the thresholds the cluster raises its warnings at; Standard and above.
export function setAlarmRules(s: GameState, clusterId: string, rules: AlarmRules): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c) return fail("error.notVmwhere");
  if (!editionAllows(c, "alarms")) return fail("error.needsEdition");
  const ok = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
  if (!ok(rules.cpu, 0.5, 8) || !ok(rules.ram, 0.5, 1) || !ok(rules.disk, 0.5, 1)) return fail("error.alarmRule");
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, alarmRules: rules } : x));
  return { ok: true };
}

// Hides one triggered alarm until it clears; with no key, hides all of them.
export function acknowledgeAlarm(s: GameState, clusterId: string, key?: string): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c) return fail("error.notVmwhere");
  const add = key ? [key] : clusterSummary(s, clusterId).alarms.map(alarmKey);
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, acks: [...new Set([...x.acks, ...add])] } : x));
  return { ok: true };
}

// Reset to green: shows every acknowledged alarm again.
export function resetAlarms(s: GameState, clusterId: string): ActionResult {
  if (!vmwhereCluster(s, clusterId)) return fail("error.notVmwhere");
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, acks: [] } : x));
  return { ok: true };
}

// Creates a pool (no id) or edits one; Enterprise only.
export function savePool(s: GameState, clusterId: string, pool: Omit<Pool, "id"> & { id?: string }): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c) return fail("error.notVmwhere");
  if (!editionAllows(c, "pools")) return fail("error.needsEdition");
  const name = pool.name.trim();
  if (!name) return fail("error.poolName");
  const limit = (x: number | null) => x === null || (Number.isFinite(x) && x > 0);
  if (!limit(pool.vcpuLimit) || !limit(pool.ramLimitGb)) return fail("error.poolLimit");
  const id = pool.id ?? `pool${s.nextId++}`;
  if (pool.id && !c.pools.some((p) => p.id === id)) return fail("error.unknownPool");
  const next = { ...pool, name, id };
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, pools: pool.id ? x.pools.map((p) => (p.id === id ? next : p)) : [...x.pools, next] } : x));
  return { ok: true, id };
}

export function deletePool(s: GameState, clusterId: string, poolId: string): ActionResult {
  const c = vmwhereCluster(s, clusterId);
  if (!c?.pools.some((p) => p.id === poolId)) return fail("error.unknownPool");
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, pools: x.pools.filter((p) => p.id !== poolId) } : x));
  s.workloads = s.workloads.map((w) => (w.clusterId === clusterId && w.poolId === poolId ? { ...w, poolId: null } : w));
  return { ok: true };
}

// Puts a workload into a pool, or takes it out with null; a pool whose limit the booking would pass refuses it.
export function setPool(s: GameState, workloadId: string, poolId: string | null): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId);
  const c = w && vmwhereCluster(s, w.clusterId ?? "");
  if (!w || !c) return fail("error.notVmwhere");
  if (poolId !== null && !poolRoom(s, c, poolId, booked(s, w), w.id)) return fail(c.pools.some((p) => p.id === poolId) ? "error.poolFull" : "error.unknownPool");
  s.workloads = s.workloads.map((x) => (x.id === workloadId ? { ...x, poolId } : x));
  return { ok: true };
}
