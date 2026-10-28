import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// Ticks or unticks a checklist goal the game does not detect by itself.
export function toggleCheck(s: GameState, id: string): ActionResult {
  s.checklist = s.checklist.includes(id) ? s.checklist.filter((x) => x !== id) : [...s.checklist, id];
  return { ok: true };
}
