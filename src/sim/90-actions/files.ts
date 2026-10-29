import type { GameState } from "../50-state";
import { applyOps, changesFrom, DESK, DESKTOP, desktopFiles, guideText, kept, MAX_FILE, MAX_PATHS, nameOf, parentOf, treeOf, type FileOp, type Tree } from "../60-infra/fs";
import { addNote, editNote, removeDoc } from "./docs";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Applies a change the Terminal made to a machine's files; a machine holds MAX_PATHS changed paths and files of MAX_FILE.
// On the desk, ~/Desktop is the desktop: its files are the documents there.
export function editFiles(s: GameState, host: string, ops: FileOp[]): ActionResult {
  const tree = treeOf(s, host);
  applyOps(tree, ops);
  if (ops.some(([op, p]) => (op === "write" || op === "append") && String(tree[p]).length > MAX_FILE)) return fail("term.fs.full");
  if (host === DESK) {
    const sync = syncDesktop(s, tree, ops);
    if (typeof sync === "string") return fail(sync);
    sync();
  }
  const paths = changesFrom(s, host, tree);
  if (Object.keys(paths).length > MAX_PATHS) return fail("term.fs.full");
  s.files = { ...s.files, [host]: { since: kept(s, host) ? s.files[host].since : s.hour, paths } };
  return { ok: true };
}

// What ~/Desktop now holds, as document changes: a moved file renames its document, a removed one removes it, a new one
// becomes a note. Getting started stays as it is, and the desktop holds no folders. Returns the changes to make, or the
// error when one of them is not allowed.
function syncDesktop(s: GameState, tree: Tree, ops: FileOp[]): (() => void) | string {
  const files = desktopFiles(s), renamed = new Map<string, string>();
  for (const [op, p, to] of ops) {
    const f = op === "move" && parentOf(p) === DESKTOP && parentOf(to!) === DESKTOP ? files.find((x) => x.path === p) : undefined;
    if (f) renamed.set(f.doc.id, to!);
  }
  const targets = new Set(renamed.values()), claimed = new Set<string>(), steps: (() => void)[] = [];
  for (const { path, doc } of files) {
    const at = renamed.get(doc.id) ?? path, v = tree[at];
    if (doc.kind === "guide") {
      if (at !== path || v !== guideText(s)) return "term.fs.perm";
      claimed.add(at);
    } else if (v === undefined || (at === path && targets.has(path))) steps.push(() => removeDoc(s, doc.id));
    else if (v === true) return "term.fs.perm";
    else {
      claimed.add(at);
      steps.push(() => editNote(s, doc.id, at === path ? { body: v } : { title: nameOf(at), body: v }));
    }
  }
  for (const p of Object.keys(tree)) {
    if (!p.startsWith(`${DESKTOP}/`) || claimed.has(p)) continue;
    const v = tree[p];
    if (v === true || parentOf(p) !== DESKTOP) return "term.fs.perm";
    steps.push(() => { const r = addNote(s); if (r.ok) editNote(s, r.id!, { title: nameOf(p), body: v }); });
  }
  return () => steps.forEach((f) => f());
}
