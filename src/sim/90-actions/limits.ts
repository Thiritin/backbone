import { ACTION_MINUTES, logActivity } from "../47-staff/activity";
import type { Resources } from "../10-catalog/products";
import { sizeOf } from "../30-market/spec";
import { datastoreFits, deltaGb, KEYS, nodeTakes, vmOf, vmRoom, workloadsOf } from "../60-infra/cluster";
import { withinOversell } from "../60-infra/oversell";
import { freezeTick, need } from "../60-infra/usage";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
// The smallest size any line sells.
export const LIMIT_MIN: Resources = { vcpu: 0.1, ramGb: 0.25, diskGb: 1 };

// Books a customer workload at another size; the service keeps its sold spec and uses what it needs up to the limit.
export function setLimits(s: GameState, serviceId: string, size: Resources): ActionResult {
  const v = s.services.find((x) => x.id === serviceId && x.endedAt === null), w = v && workloadsOf(s, v.id)[0];
  const c = w?.clusterId ? s.clusters.find((x) => x.id === w.clusterId) : undefined;
  if (!v || !w || !c) return fail("error.unknownService");
  if (KEYS.some((k) => !Number.isFinite(size[k]) || size[k] < LIMIT_MIN[k])) return fail("error.vmSize");
  const r: Resources = { vcpu: size.vcpu, ramGb: size.ramGb, diskGb: size.diskGb };
  if (r.diskGb < need(s, v, w).diskGb + deltaGb(w) - 1e-9) return fail("error.vmTooSmall");
  const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined, room = vmOf(s, w) && vmRoom(s, c);
  const grows = r.diskGb > w.diskGb;
  if ((d && !nodeTakes(s, d, { ...r, datastore: w.datastore }, w)) || (grows && w.datastore && !datastoreFits(s, w.datastore, r.diskGb - w.diskGb))
    || (grows && room && room.used.diskGb - w.diskGb + r.diskGb > room.cap.diskGb + 1e-9)) return fail("error.nodeFull");
  if (r.vcpu > w.vcpu && !withinOversell(s, c, { vcpu: r.vcpu - w.vcpu })) return fail("error.oversellCap");
  const promised = KEYS.some((k) => r[k] < v.spec[k]) ? sizeOf(v.spec) : undefined;
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...r, promised } : x));
  freezeTick(s);
  logActivity(s, { customerId: v.customerId, serviceId: v.id, by: null, key: "activity.limits", params: { vcpu: r.vcpu, ram: r.ramGb, disk: r.diskGb }, minutes: ACTION_MINUTES.limits });
  return { ok: true };
}
