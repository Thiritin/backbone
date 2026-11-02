// docs/design/web-hosting.md 5.1: a self-hosted desk as files, a database and an admin account in one of the player's own
// web spaces. The folder is the desk's web root: OsTickit's upload/, FreeScoot's public/.
import { deskOfArchive, type SelfDeskId } from "../10-catalog/archives";
import type { GameState } from "../50-state";
import { urlOf } from "./shop-files";
import { ADMIN_TABLE, findRows, tablesOf } from "./webdb";
import { modeOf, webspaceOf, type Webspace } from "./webspace";

// OsTickit's installer folder; FreeScoot's installer is a route of the app and has none.
export const SETUP_DIR = "setup";
// The file the installer writes the database credentials into, relative to the web root.
export const DESK_CONFIG: Record<SelfDeskId, string> = { ostickit: "include/ost-config.php", freescoot: "../.env" };

const resolvePath = (folder: string, rel: string): string => {
  const out: string[] = [];
  for (const p of `${folder}/${rel}`.split("/")) if (p === "..") out.pop(); else out.push(p);
  return out.join("/");
};
export const deskConfigPath = (id: SelfDeskId, folder: string): string => resolvePath(folder, DESK_CONFIG[id]);

// The desk and release whose web root is the folder, read from the index.php its archive unpacked.
export function deskFilesIn(ws: Webspace, folder: string): { id: SelfDeskId; version: string } | null {
  const f = ws.files[`${folder}/index.php`];
  return f?.from ? deskOfArchive(f.from) : null;
}
export const setupDirIn = (ws: Webspace, folder: string): boolean => !!ws.files[`${folder}/${SETUP_DIR}`]?.dir;
// PHP running as the web server's user can write a file only while others may.
export const worldWritable = (path: string, ws: Webspace): boolean => !!ws.files[path] && (Number(modeOf(path, ws.files[path]).slice(-1)) & 2) !== 0;

// The installed desk's web space, folder and database, once its installer has finished in one.
export function deskSpace(s: GameState): { ws: Webspace; folder: string; db: string; id: SelfDeskId; version: string } | null {
  const h = s.desk?.hosting;
  if (h?.kind !== "self" || !h.ws || !h.folder || !h.db) return null;
  const ws = webspaceOf(s, h.ws);
  return ws ? { ws, folder: h.folder, db: h.db, id: s.desk!.id as SelfDeskId, version: h.version } : null;
}

// A desk installed into a web space stops when its files, config, tables or address are gone.
export function deskBroken(s: GameState): boolean {
  const h = s.desk?.hosting;
  if (h?.kind !== "self" || !h.ws) return false;
  const at = deskSpace(s);
  if (!at) return true;
  const files = deskFilesIn(at.ws, at.folder);
  return files?.id !== at.id || !at.ws.files[deskConfigPath(at.id, at.folder)] || !urlOf(at.ws, at.folder) || !tablesOf(s, at.ws, at.db).length;
}

// The address the installed desk answers at, such as support.example.com or example.com/upload.
export function deskUrl(s: GameState): string | null {
  const at = deskSpace(s);
  return at && urlOf(at.ws, at.folder);
}

// What OsTickit's Staff Control Panel warns about after the install: the setup folder left and a config file still writable.
export function deskWarnings(s: GameState): ("setupDir" | "configWritable")[] {
  const at = deskSpace(s);
  if (at?.id !== "ostickit") return [];
  return [
    ...(setupDirIn(at.ws, at.folder) ? ["setupDir" as const] : []),
    ...(worldWritable(deskConfigPath(at.id, at.folder), at.ws) ? ["configWritable" as const] : []),
  ];
}

// The staff row a login or reset finds, by the login column or by the e-mail address.
export function deskAdminRow(s: GameState, by: "login" | "email", value: string): { pk: number; pass: string; email: string } | null {
  const at = deskSpace(s), a = at && ADMIN_TABLE[at.id];
  if (!at || !a || !value) return null;
  const r = findRows(s, at.ws, at.db, a.table, by === "login" ? a.user : "email", value)[0];
  return r ? { pk: r.pk, pass: r.values[a.pass], email: r.values.email } : null;
}
