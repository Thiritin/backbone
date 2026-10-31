import { tiersOf } from "../10-catalog/licence-tiers";
import type { GameState } from "../50-state";
import { accountsOn, licenceExpired } from "../60-infra/licence";
import { payLicence, softwareFee } from "../85-products/products";
import type { ActionResult } from "./hardware";

// Picks the edition of a panel host. A tier below the account count is refused; ending a trial or a lapse pays the first month at once.
export function setLicenceTier(s: GameState, clusterId: string, tierId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return { ok: false, error: "error.unknownCluster" };
  const tier = tiersOf(c.panel).find((x) => x.id === tierId);
  if (!tier) return { ok: false, error: "error.noSoftware" };
  if (tier.cap !== null && accountsOn(s, c) > tier.cap) return { ok: false, error: "error.licenceCap" };
  const next = { ...c, licence: { tier: tierId, trialUntil: null, lapsedAt: null } };
  const due = licenceExpired(s, c) ? softwareFee(s, next, c.panel) : 0;
  if (s.cash < due) return { ok: false, error: "error.noCash" };
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? next : x));
  payLicence(s, c, due);
  return { ok: true, id: clusterId };
}
