// docs/design/web-hosting.md 4.1, File Manager: uploads from Downloads, archives, copies, moves and permissions.
// Folders, deletes and renames live with the other web space actions in ./webspace.
import { ARCHIVE_EXT, archiveNamed, PACKED } from "../10-catalog/archives";
import type { GameState } from "../50-state";
import type { WebFile, Webspace } from "../60-infra/webspace";
import type { ActionResult } from "./hardware";
import { downloadedFiles } from "./media";
import { fail, FILE_NAME, fixed, folderOk, isFail, join, open, put, under } from "./webspace-base";

export type CompressKind = keyof typeof PACKED;
const EXT: Record<CompressKind, string> = { zip: ".zip", tar: ".tar", gz: ".tar.gz", bz2: ".tar.bz2" };
const nameOk = (name: string) => FILE_NAME.test(name) && name !== "." && name !== "..";
const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));
const sizeOf = (ws: Webspace, paths: string[]) => paths.reduce((a, p) => a + (ws.files[p]?.mb ?? 0), 0);
// web-hosting.md 2.2: anything written past the account's disk quota fails, with the kernel's own message.
const room = (ws: Webspace, mb: number): ActionResult | null => (ws.usage.diskMb + mb > ws.usage.quotaMb ? fail("webspace.error.diskQuota") : null);

// Whether the file from Downloads fits into the folder; the File Manager asks before the transfer starts.
export function checkUpload(s: GameState, workloadId: string, folder: string, file: string, overwrite = false): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const d = downloadedFiles(s).find((x) => x.id === file);
  if (!d) return fail("webspace.error.noDownload");
  if (!folderOk(ws, folder)) return fail("webspace.error.noFolder");
  const path = join(folder, d.name), old = ws.files[path];
  if (old && (old.dir || !overwrite)) return fail("webspace.error.uploadExists", { name: d.name });
  return room(ws, d.mb - (old?.mb ?? 0)) ?? { ok: true, id: path };
}

// Lands a finished upload; the transfer time is the UI's, from transferHours over uploadMbps.
export function uploadFile(s: GameState, workloadId: string, folder: string, file: string, overwrite = false): ActionResult {
  const r = checkUpload(s, workloadId, folder, file, overwrite);
  if (!r.ok) return r;
  const d = downloadedFiles(s).find((x) => x.id === file)!;
  put(s, workloadId, "files", r.id!, { mb: d.mb, at: s.hour, ...(archiveNamed(d.id) && { archive: d.id }) });
  return r;
}

export function createFile(s: GameState, workloadId: string, folder: string, name: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!nameOk(name)) return fail("webspace.error.fileName");
  if (!folderOk(ws, folder)) return fail("webspace.error.noFolder");
  const path = join(folder, name);
  if (ws.files[path]) return fail("webspace.error.fileTaken");
  const over = room(ws, 0);
  if (over) return over;
  put(s, workloadId, "files", path, { mb: 0, at: s.hour });
  return { ok: true, id: path };
}

// What the archive unpacks to, by path relative to the folder it is extracted into.
function contents(f: WebFile): Record<string, WebFile> | null {
  if (f.pack) return f.pack;
  const a = f.archive ? archiveNamed(f.archive) : null;
  return a && Object.fromEntries(a.entries.map(([p, mb]) => [p.replace(/\/$/, ""), { ...(p.endsWith("/") && { dir: true as const }), mb, at: 0 }]));
}

// Unpacks into the folder, overwriting what is there, as cPanel's Extract does; missing parent folders are created.
export function extractFile(s: GameState, workloadId: string, path: string, into = parentOf(path)): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const f = ws.files[path];
  if (!f || f.dir) return fail("webspace.error.noFile");
  const tree = ARCHIVE_EXT.test(path) ? contents(f) : null;
  if (!tree) return fail("webspace.error.notArchive");
  if (!folderOk(ws, into)) return fail("webspace.error.noFolder");
  const out: Record<string, WebFile> = {};
  for (const [rel, e] of Object.entries(tree)) {
    const parts = rel.split("/");
    parts.slice(0, -1).forEach((_, i) => {
      const dir = join(into, parts.slice(0, i + 1).join("/"));
      if (!ws.files[dir]?.dir) out[dir] ??= { dir: true, mb: 0, at: s.hour };
    });
    out[join(into, rel)] = { ...e, at: s.hour };
  }
  const over = room(ws, Object.values(out).reduce((a, x) => a + x.mb, 0) - sizeOf(ws, Object.keys(out)));
  if (over) return over;
  for (const [p, e] of Object.entries(out)) put(s, workloadId, "files", p, e);
  return { ok: true, id: into };
}

// Packs files and folders of one folder into an archive next to them.
export function compressFiles(s: GameState, workloadId: string, paths: string[], name: string, kind: CompressKind = "zip"): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!paths.length || paths.some((p) => !ws.files[p])) return fail("webspace.error.noFile");
  const folder = parentOf(paths[0]), file = name.endsWith(EXT[kind]) ? name : name + EXT[kind];
  if (paths.some((p) => parentOf(p) !== folder)) return fail("webspace.error.oneFolder");
  if (!nameOk(file)) return fail("webspace.error.fileName");
  const path = join(folder, file);
  if (ws.files[path]) return fail("webspace.error.fileTaken");
  const pack: Record<string, WebFile> = {}, cut = folder ? folder.length + 1 : 0;
  for (const p of paths) for (const k of under(ws, p)) pack[k.slice(cut)] = ws.files[k];
  const mb = +(Object.values(pack).reduce((a, x) => a + x.mb, 0) * PACKED[kind]).toFixed(3);
  const over = room(ws, mb);
  if (over) return over;
  put(s, workloadId, "files", path, { mb, at: s.hour, pack });
  return { ok: true, id: path };
}

// The moves or copies, as [from, to] per entry, or the error; nothing is written until all of them pass.
function relocate(ws: Webspace, paths: string[], to: string, moving: boolean): [string, string][] | ActionResult {
  if (!folderOk(ws, to)) return fail("webspace.error.noFolder");
  const pairs: [string, string][] = [];
  for (const p of paths) {
    if (!ws.files[p]) return fail("webspace.error.noFile");
    if (moving && fixed(ws, p)) return fail("webspace.error.fixedFolder");
    if (to === p || to.startsWith(`${p}/`)) return fail("webspace.error.intoItself");
    const target = join(to, base(p));
    if (target === p) continue;
    if (ws.files[target]) return fail("webspace.error.fileTaken");
    for (const k of under(ws, p)) pairs.push([k, target + k.slice(p.length)]);
  }
  return pairs;
}

export function moveFiles(s: GameState, workloadId: string, paths: string[], to: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const pairs = relocate(ws, paths, to, true);
  if (!Array.isArray(pairs)) return pairs;
  for (const [from, dest] of pairs) {
    put(s, workloadId, "files", dest, ws.files[from]);
    put(s, workloadId, "files", from, false);
  }
  return { ok: true, id: to };
}

export function copyFiles(s: GameState, workloadId: string, paths: string[], to: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const pairs = relocate(ws, paths, to, false);
  if (!Array.isArray(pairs)) return pairs;
  const over = room(ws, sizeOf(ws, pairs.map(([from]) => from)));
  if (over) return over;
  for (const [from, dest] of pairs) put(s, workloadId, "files", dest, { ...ws.files[from], at: s.hour });
  return { ok: true, id: to };
}

// Sets the octal mode, such as "0644" or "755".
export function chmodFile(s: GameState, workloadId: string, path: string, mode: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.files[path]) return fail("webspace.error.noFile");
  if (!/^[0-7]{3,4}$/.test(mode)) return fail("webspace.error.mode");
  put(s, workloadId, "files", path, { ...ws.files[path], mode: mode.padStart(4, "0") });
  return { ok: true, id: path };
}
