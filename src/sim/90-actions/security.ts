import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { clusterOf } from "../60-infra/cluster";
import { REBUILD_HOURS, REBUILT, RESTORE_HOURS, webOn } from "../60-infra/security";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Takes the web sites on a cluster node offline for maintenance, or brings them back.
export function setSitesOffline(s: GameState, deviceId: string, off: boolean): ActionResult {
  if (!clusterOf(s, deviceId)) return fail("error.notNode");
  const offline = s.security.offline.filter((id) => id !== deviceId);
  if (off === s.security.offline.includes(deviceId)) return fail(off ? "error.sitesOffline" : "error.sitesOnline");
  s.security = { ...s.security, offline: off ? [...offline, deviceId] : offline };
  return { ok: true };
}

// Cleans a compromised node: sites with a backup come back from it, the others are rebuilt empty and take longer.
export function cleanUp(s: GameState, deviceId: string): ActionResult {
  if (!s.security.hacked.includes(deviceId)) return fail("error.notHacked");
  const web = webOn(s, deviceId);
  const bare = new Set(web.filter((w) => w.backupAt === null).map((w) => w.serviceId));
  s.workloads = s.workloads.map((w) => (web.includes(w) ? { ...w, busyUntil: s.hour + (bare.has(w.serviceId) ? REBUILD_HOURS : RESTORE_HOURS) } : w));
  const owners = new Set(s.services.filter((v) => bare.has(v.id)).map((v) => v.customerId));
  s.customers = s.customers.map((c) => (owners.has(c.id) ? { ...c } : c));
  for (const c of s.customers) if (owners.has(c.id)) bump(c, REBUILT);
  s.security = { ...s.security, hacked: s.security.hacked.filter((id) => id !== deviceId) };
  return { ok: true };
}
