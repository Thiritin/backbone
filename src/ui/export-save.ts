import { dateOf } from "../sim/00-core/time";
import { serialize } from "../sim/91-save/save";
import type { GameState } from "../sim/50-state";

export function exportSave(game: GameState) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([serialize(game)], { type: "application/json" }));
  a.download = `backbone-${dateOf(game.hour).toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
