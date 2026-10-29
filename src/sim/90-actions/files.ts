import type { GameState } from "../50-state";
import { applyOps, changesFrom, kept, MAX_FILE, MAX_PATHS, treeOf, type FileOp } from "../60-infra/fs";
import type { ActionResult } from "./hardware";

// Applies a change the Terminal made to a machine's files; a machine holds MAX_PATHS changed paths and files of MAX_FILE.
export function editFiles(s: GameState, host: string, ops: FileOp[]): ActionResult {
  const tree = treeOf(s, host);
  applyOps(tree, ops);
  const paths = changesFrom(s, host, tree);
  if (Object.keys(paths).length > MAX_PATHS || Object.values(paths).some((v) => typeof v === "string" && v.length > MAX_FILE)) {
    return { ok: false, error: "term.fs.full" };
  }
  s.files = { ...s.files, [host]: { since: kept(s, host) ? s.files[host].since : s.hour, paths } };
  return { ok: true };
}
