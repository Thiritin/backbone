import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { REBUILD_HOURS, REBUILT, RESTORE_HOURS, webOn } from "../60-infra/security";
import type { ActionResult } from "./hardware";
// Player actions on hacked sites and app advisories, kept with the app model.
export { cleanSite, notifyCustomers } from "../60-infra/apps";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Takes the web sites on a panel host offline for maintenance, or brings them back.
export function setSitesOffline(s: GameState, hostId: string, off: boolean): ActionResult {
  if (!s.clusters.some((c) => c.id === hostId && c.kind === "panel")) return fail("error.notPanelHost");
  const offline = s.security.offline.filter((id) => id !== hostId);
  if (off === s.security.offline.includes(hostId)) return fail(off ? "error.sitesOffline" : "error.sitesOnline");
  s.security = { ...s.security, offline: off ? [...offline, hostId] : offline };
  return { ok: true };
}

// Cleans a compromised panel host: sites with a backup come back from it, the others are rebuilt empty and take longer.
export function cleanUp(s: GameState, hostId: string): ActionResult {
  if (!s.security.hacked.includes(hostId)) return fail("error.notHacked");
  const web = webOn(s, hostId);
  const bare = new Set(web.filter((w) => w.backupAt === null).map((w) => w.serviceId));
  s.workloads = s.workloads.map((w) => (web.includes(w) ? { ...w, busyUntil: s.hour + (bare.has(w.serviceId) ? REBUILD_HOURS : RESTORE_HOURS) } : w));
  const owners = new Set(s.services.filter((v) => bare.has(v.id)).map((v) => v.customerId));
  s.customers = s.customers.map((c) => (owners.has(c.id) ? { ...c } : c));
  for (const c of s.customers) if (owners.has(c.id)) bump(c, REBUILT);
  s.security = { ...s.security, hacked: s.security.hacked.filter((id) => id !== hostId) };
  return { ok: true };
}
