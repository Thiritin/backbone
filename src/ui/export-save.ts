import { dateOf } from "../sim/00-core/time";
import { serialize } from "../sim/91-save/save";
import type { GameState } from "../sim/50-state";
import { isDesktopApp, saveFile } from "./desktop-app";

export function exportSave(game: GameState) {
  const name = `raid0-${dateOf(game.hour).toISOString().slice(0, 10)}.json`;
  if (isDesktopApp()) { void saveFile(name, serialize(game)); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([serialize(game)], { type: "application/json" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
