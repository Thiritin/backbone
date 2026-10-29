// The player drives to a location to do hand work there; the computer stays locked until they arrive.
import { datacenterById } from "../20-world/datacenters";
import type { GameState } from "../50-state";
import { BOOKED_HOURS, playerAt, trip } from "../60-infra/handwork";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The hours and fee of the drive to a location, a booked visit included; null when it is overseas.
export function drive(s: GameState, locationId: string): { hours: number; fee: number } | null {
  const loc = s.locations.find((l) => l.id === locationId), t = loc && trip(playerAt(s).city, loc.city);
  if (!t) return null;
  return { hours: t.hours + (loc.dc && datacenterById(loc.dc).visitBooking ? BOOKED_HOURS : 0), fee: t.fee };
}

export function travelTo(s: GameState, locationId: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.noLocation");
  if (s.player.until > s.hour) return fail("error.away");
  if (playerAt(s).id === loc.id) return fail("error.alreadyThere");
  const d = drive(s, loc.id);
  if (!d) return fail("error.tooFar");
  if (s.cash < d.fee) return fail("error.noCash");
  s.cash = Math.round((s.cash - d.fee) * 100) / 100;
  s.ledger.push({ hour: s.hour, category: "maintenance", key: "ledger.drive", params: { place: loc.name }, amount: -d.fee });
  s.player = { at: loc.id, until: s.hour + d.hours, doing: "travel" };
  return { ok: true };
}
