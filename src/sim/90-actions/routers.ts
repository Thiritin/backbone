import { isOfficeRouter, modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import { mountedRouter } from "../60-infra/routers";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Puts a small-office router from the basement's storage on the shelf of the mounted one. The cables stay on their ports
// and the replaced router goes into storage.
export function installRouter(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.store) return fail("error.alreadyMounted");
  if (d.transitTo) return fail("error.inTransit");
  if (!isOfficeRouter(modelById(d.model))) return fail("error.notOfficeRouter");
  const loc = s.locations.find((l) => l.id === d.store);
  if (!loc || loc.dc) return fail("error.basementOnly");
  const old = mountedRouter(s, loc.id);
  if (!old) return fail("error.noRouter");
  const move = (e: { device: string; port: number }) => (e.device === old.id ? { ...e, device: d.id } : e);
  s.cables = s.cables.map((c) => ({ ...c, a: move(c.a), b: move(c.b) }));
  const plugged = old.components.filter((c) => c.kind === "psu").map((c) => c.plugged);
  // The new router takes over the network settings and port shares; it knows none of the old one's leases or reservations.
  const lan = old.lan && { ...old.lan, leases: [], reservations: [] };
  Object.assign(d, { rackId: old.rackId, slot: old.slot, store: null, name: old.name, on: true, ...(lan && { lan }),
    components: d.components.map((c) => (c.kind === "psu" ? { ...c, plugged: plugged.shift() ?? c.plugged } : c)) });
  Object.assign(old, { rackId: null, slot: 0, store: loc.id, name: d.name });
  return { ok: true, id: d.id };
}
