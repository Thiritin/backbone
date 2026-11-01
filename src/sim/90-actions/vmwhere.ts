// VMwhere editions, DRS and maintenance mode (docs/design/plans/hypervisors-backups.md, section 3.6).
import type { GameState } from "../50-state";
import { EDITION_COST, editionOf, isVmwhere, upgradeCost } from "../60-infra/vmwhere";
import { payLicence } from "../85-products/products";
import type { ActionResult } from "./hardware";

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
