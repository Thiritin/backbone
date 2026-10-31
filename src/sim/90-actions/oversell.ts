import type { GameState } from "../50-state";
import { oversold } from "../60-infra/oversell";
import type { ActionResult } from "./hardware";

// The player's cap on booked vCPU per physical vCPU for a panel host; null lifts it.
export function setOversell(s: GameState, clusterId: string, cap: number | null): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || !oversold(c)) return { ok: false, error: "error.unknownCluster" };
  if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) return { ok: false, error: "error.oversellCap" };
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, oversell: cap } : x));
  return { ok: true, id: clusterId };
}
