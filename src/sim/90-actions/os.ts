import type { GameState } from "../50-state";
import { latestOs } from "../10-catalog/os";
import { t } from "../../i18n/en";
import type { ActionResult } from "./hardware";

// Installs the newest Pear OS release.
export function updateOs(s: GameState): ActionResult {
  const latest = latestOs(s.hour);
  if (latest.id === s.os) return { ok: false, error: t("os.current") };
  s.os = latest.id;
  return { ok: true };
}
