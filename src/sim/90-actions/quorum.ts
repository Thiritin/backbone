// economy.md, Proxmocks cluster quorum: a QDevice is a free server that casts one extra vote.
import type { GameState } from "../50-state";
import { qdeviceBlock } from "../60-infra/quorum";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Sets the cluster's QDevice to a free server of its zone, or removes it with null.
export function setQdevice(s: GameState, clusterId: string, deviceId: string | null): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || c.platform !== "proxmocks" || c.nodes.length < 2) return fail("error.noQdevice");
  const bad = deviceId === null ? null : qdeviceBlock(s, c, deviceId);
  if (bad) return fail(bad);
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, qdevice: deviceId } : x));
  return { ok: true };
}
