import { isOfficeRouter, modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Puts a small-office router from the basement's storage on the carrier panel in place of the router there. The cables
// stay on their ports and the replaced router goes into storage, unless it came with the location.
export function installRouter(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.store) return fail("error.alreadyMounted");
  if (d.transitTo) return fail("error.inTransit");
  if (!isOfficeRouter(modelById(d.model))) return fail("error.notOfficeRouter");
  const loc = s.locations.find((l) => l.id === d.store);
  if (!loc || loc.dc) return fail("error.basementOnly");
  const old = s.devices.find((x) => x.panel === loc.id && modelById(x.model).kind === "gateway");
  const name = old?.name ?? d.name;
  if (old) {
    const move = (e: { device: string; port: number }) => (e.device === old.id ? { ...e, device: d.id } : e);
    s.cables = s.cables.map((c) => ({ ...c, a: move(c.a), b: move(c.b) }));
    if (old.price > 0) Object.assign(old, { panel: null, store: loc.id, name: d.name });
    else s.devices = s.devices.filter((x) => x.id !== old.id);
  }
  Object.assign(d, { panel: loc.id, store: null, name, on: true });
  return { ok: true, id: d.id };
}
