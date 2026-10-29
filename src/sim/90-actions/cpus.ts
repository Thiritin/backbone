import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// Compatibility mode on a hypervisor cluster: VMs move live to nodes of another CPU vendor, at COMPAT_VCPU of every node's vCPU.
export function setCompatMode(s: GameState, clusterId: string, on: boolean): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return { ok: false, error: "error.unknownCluster" };
  if (c.kind !== "cloud") return { ok: false, error: "error.needsPlatform" };
  s.clusters = s.clusters.map((x) => (x.id === clusterId ? { ...x, compat: on } : x));
  return { ok: true };
}
