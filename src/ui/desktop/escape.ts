import type { GameState } from "../../sim/50-state";
import type { Win } from "../store";

const FIELD = "input, textarea, select, [contenteditable]";
const OWN = "[role=alertdialog], [role=dialog], [role=menu], [role=application]";

export interface EscapeState { game: Pick<GameState, "hour" | "player">; windows: Win[]; close: (id: string) => void; setSurface: (s: "world") => void }

// Escape on the desktop: a focused field only loses focus, anything that handles its own Escape (dialogs, menus, screens,
// an open dialog elsewhere) is left alone, then the front window closes and with none left the player returns to the room.
export function escapeStep(e: Pick<KeyboardEvent, "key" | "target" | "defaultPrevented">, st: EscapeState): "blur" | "close" | "room" | null {
  if (e.key !== "Escape" || e.defaultPrevented || st.game.player.until > st.game.hour) return null;
  const el = e.target instanceof Element ? e.target : null;
  if (el?.closest(OWN) || document.querySelector(OWN)) return null;
  if (el?.closest(FIELD)) { (el as HTMLElement).blur(); return "blur"; }
  const front = st.windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
  if (front) { st.close(front.id); return "close"; }
  st.setSurface("world");
  return "room";
}
