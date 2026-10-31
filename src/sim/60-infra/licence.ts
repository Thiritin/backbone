import { tiersOf, topTier, type LicenceTier } from "../10-catalog/licence-tiers";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";

export const accountsOn = (s: GameState, c: Cluster): number => s.workloads.filter((w) => w.clusterId === c.id).length;

export function tierOf(c: Cluster): LicenceTier | undefined {
  const tiers = tiersOf(c.panel);
  return tiers.find((x) => x.id === c.licence?.tier) ?? topTier(c.panel);
}

// A trial that ran out or a licence that lapsed blocks new accounts.
export const licenceExpired = (s: GameState, c: Cluster): boolean =>
  !!c.licence && (c.licence.lapsedAt !== null || (c.licence.trialUntil !== null && s.hour >= c.licence.trialUntil));

// The error that refuses one more account on a panel host, or null.
export function licenceBlock(s: GameState, c: Cluster): string | null {
  if (!tierOf(c)) return null;
  if (licenceExpired(s, c)) return "error.licenceExpired";
  const cap = tierOf(c)!.cap;
  return cap !== null && accountsOn(s, c) + 1 > cap ? "error.licenceCap" : null;
}
