// economy.md, OpenVeeZee: burst memory and the live checkpoint and restore.
import { BURST_MAX, checkpointMinutes, openVeeZee } from "../60-infra/beancounters";
import { lostDisk } from "../60-infra/cluster";
import { servicesIn } from "../60-infra/ha";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const found = (s: GameState, id: string) => { const w = s.workloads.find((x) => x.id === id), c = s.clusters.find((x) => x.id === w?.clusterId); return w && c && openVeeZee(c) && w.deviceId ? { w, c } : null; };
const patch = (s: GameState, id: string, p: object) => { s.workloads = s.workloads.map((x) => (x.id === id ? { ...x, ...p } : x)); };

// Sets how far above its RAM a container may go while the node has room, up to twice its RAM.
export function setBurst(s: GameState, workloadId: string, gb: number): ActionResult {
  const f = found(s, workloadId);
  if (!f) return fail("error.unknownWorkload");
  if (!(gb >= 0 && gb <= BURST_MAX * f.w.ramGb)) return fail("error.badBurst");
  patch(s, f.w.id, { burstGb: Math.round(gb * 4) / 4 });
  return { ok: true };
}

// vzctl chkpnt: the container leaves the node's load and waits, frozen, for a restore.
export function freezeWorkload(s: GameState, workloadId: string): ActionResult {
  const f = found(s, workloadId);
  if (!f) return fail("error.unknownWorkload");
  if (f.w.stopped || f.w.frozen || f.w.template || lostDisk(s, f.w) || f.w.busyUntil > s.hour) return fail("error.workloadBusy");
  patch(s, f.w.id, { frozen: true });
  return { ok: true };
}

// vzctl restore: the container resumes within a minute or two, not a boot.
export function thawWorkload(s: GameState, workloadId: string): ActionResult {
  const f = found(s, workloadId);
  if (!f || !f.w.frozen) return fail("error.unknownWorkload");
  const minutes = checkpointMinutes(f.w.ramGb * 0.5);
  patch(s, f.w.id, { frozen: false });
  for (const id of servicesIn(s, f.w)) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + minutes / 60 };
  return { ok: true };
}
