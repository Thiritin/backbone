import { tiersOf } from "../10-catalog/licence-tiers";
import type { GameState } from "../50-state";
import { accountsOn, assignKey, issueKey, licenceExpired, panelKey, panelMachine, updateKey } from "../60-infra/licence";
import { payLicence, tierFee } from "../85-products/products";
import type { ActionResult } from "./hardware";

// Picks the edition of a panel host. A tier below the account count is refused; ending a trial or a lapse pays the first month at once.
export function setLicenceTier(s: GameState, clusterId: string, tierId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return { ok: false, error: "error.unknownCluster" };
  const tier = tiersOf(c.panel).find((x) => x.id === tierId), machine = panelMachine(c);
  if (!tier || !machine) return { ok: false, error: "error.noSoftware" };
  if (tier.cap !== null && accountsOn(s, c) > tier.cap) return { ok: false, error: "error.licenceCap" };
  const due = licenceExpired(s, c) ? tierFee(s, c, tier) : 0;
  if (s.cash < due) return { ok: false, error: "error.noCash" };
  const k = panelKey(s, c);
  if (k) updateKey(s, k.id, { edition: tier.id, kind: tier.kind, lapsedAt: null });
  else assignKey(s, issueKey(s, c.panel!, tier.id).id, machine);
  payLicence(s, c, due);
  return { ok: true, id: clusterId };
}
