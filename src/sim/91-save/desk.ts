import { deskOf } from "../10-catalog/desks";
import { legacyDesk } from "../40-support/desk";
import type { GameState } from "../50-state";

// Saves from before desk websites: tickets get the desk fields, and a Pear Store desk becomes a legacy desk.
export function fillDesk(s: GameState, saved: boolean): void {
  if (saved) return;
  for (const t of s.tickets) Object.assign(t, { channelId: t.channelId ?? null, via: t.via ?? "email", ref: t.ref ?? "", deptId: t.deptId ?? null, notes: t.notes ?? [] });
  s.desk = null;
  const d = deskOf(s);
  if (d) legacyDesk(s, d.id);
}
