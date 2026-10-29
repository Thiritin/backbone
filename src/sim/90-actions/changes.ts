import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// Records the changelog entries the player has been shown.
export function markChangesSeen(s: GameState, keys: string[]): ActionResult {
  s.seenChanges = [...new Set([...s.seenChanges, ...keys])];
  return { ok: true };
}
