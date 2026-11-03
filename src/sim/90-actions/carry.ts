// The player's hands (docs/design/gdd/the-world.md): a parcel from the door or a unit from the shelf, carried to the shelf or into a rack.
import type { GameState } from "../50-state";
import { present } from "../60-infra/handwork";
import { carry, mountDevice, type ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function pickUp(s: GameState, unitId: string): ActionResult {
  const d = s.devices.find((x) => x.id === unitId);
  if (!d) return fail("error.unknownDevice");
  if (s.player.carrying) return fail("error.handsFull");
  if (d.chassisId) return fail("error.inChassis");
  const at = d.door?.at ?? d.store;
  if (!at) return fail("error.notInStorage");
  if (!present(s, at)) return fail("error.notThere");
  if (d.maintenance) return fail("error.handWork");
  Object.assign(d, { door: null, store: null });
  carry(s, d);
  s.player.carrying = d.id;
  return { ok: true, id: d.id };
}

export function putDown(s: GameState): ActionResult {
  const d = s.devices.find((x) => x.id === s.player.carrying);
  if (!d) return fail("error.handsEmpty");
  d.store = s.player.at;
  carry(s, d);
  s.player.carrying = null;
  return { ok: true, id: d.id };
}

// The unit goes on the shelf for the mount checks and stays in the hands when one fails.
export function installCarried(s: GameState, rackId: string, slot: number): ActionResult {
  const d = s.devices.find((x) => x.id === s.player.carrying);
  if (!d) return fail("error.handsEmpty");
  d.store = s.player.at;
  const r = mountDevice(s, d.id, rackId, slot, "self");
  if (!r.ok) d.store = null;
  else s.player.carrying = null;
  return r;
}

// A parcel at the door of the room the player stands in goes straight into a rack there; it stays at the door when a mount check fails.
export function installFromDoor(s: GameState, unitId: string, rackId: string, slot: number): ActionResult {
  const d = s.devices.find((x) => x.id === unitId);
  if (!d) return fail("error.unknownDevice");
  if (d.chassisId) return fail("error.inChassis");
  const door = d.door;
  if (!door) return fail("error.notInStorage");
  if (!present(s, door.at)) return fail("error.notThere");
  Object.assign(d, { door: null, store: door.at });
  carry(s, d);
  const r = mountDevice(s, d.id, rackId, slot, "self");
  if (!r.ok) { Object.assign(d, { door, store: null }); carry(s, d); }
  return r;
}
