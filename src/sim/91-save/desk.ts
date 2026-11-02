import { deskById, type DeskId } from "../10-catalog/desks";
import { openDesk } from "../40-support/desk";
import type { GameState } from "../50-state";

// Saves from before desk websites: tickets get the desk fields, and a Pear Store desk becomes a legacy desk that s.desk
// bills from then on, so its id leaves the installed list.
export function fillDesk(s: GameState, saved: boolean): void {
  const bought = s.installed.find((id) => deskById(id));
  s.installed = s.installed.filter((id) => !deskById(id));
  if (saved) return;
  for (const t of s.tickets) Object.assign(t, { channelId: t.channelId ?? null, via: t.via ?? "email", ref: t.ref ?? "", deptId: t.deptId ?? null, notes: t.notes ?? [] });
  s.desk = null;
  if (bought) openDesk(s, bought as DeskId);
}
