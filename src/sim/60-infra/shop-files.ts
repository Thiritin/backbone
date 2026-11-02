// docs/design/web-hosting.md 5: the shop system as files, a database and an admin account in the company's web space.
// The shop runs while its files of the installed release sit in a folder a domain points at, its config file and tables
// exist, and its installer has finished (s.shop.install names the web space, folder and database).
import { md5 } from "../00-core/md5";
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { shopOfArchive } from "../10-catalog/archives";
import { PHP, phpAt } from "../10-catalog/platforms";
import type { ShopId } from "../10-catalog/shops";
import { versionInfo, versionsOf } from "../10-catalog/software-versions";
import type { GameState } from "../50-state";
import { ADMIN_TABLE, findRows, rowsOf, tablesOf } from "./webdb";
import { MULTI_PHP_YEAR, webspaceOf, type Webspace } from "./webspace";

export const INSTALL_DIR = "install";
// The file each installer writes the database credentials into.
export const CONFIG_FILE: Partial<Record<ShopId, string>> = {
  whmCache: "configuration.php", modemBill: "config.php", clientExit: "config.php", blessta: "config/blesta.php",
  hostBull: "includes/config.php", ubersmyth: "config.ini.php", boxBillin: "bb-config.php",
};
// Shop systems shipped ionCube-encoded: their requirements check fails until the host's PHP loads the ionCube Loader.
export const IONCUBE: ShopId[] = ["whmCache", "clientExit", "hostBull"];
// Variants whose admin area refuses to load while the install folder exists; the others show a warning.
export const INSTALL_DIR_BLOCKS: ShopId[] = ["whmCache", "hostBull", "boxBillin"];
// The release year each shop moved its admin passwords from MD5 to bcrypt; ModemBill never did.
const BCRYPT_FROM: Partial<Record<ShopId, number>> = { whmCache: 2015, clientExit: 2015, blessta: 2012, hostBull: 2016, ubersmyth: 2014, boxBillin: 2011 };
// Variants that log their admins in with the e-mail address instead of a username.
export const EMAIL_LOGIN: ShopId[] = ["clientExit", "boxBillin"];
// Where each shop keeps its admin's e-mail address, for the password reset mail.
const EMAIL_AT: Partial<Record<ShopId, [table: string, col: string]>> = {
  whmCache: ["tbladmins", "email"], modemBill: ["admin", "admin_email"], clientExit: ["users", "email"], blessta: ["staff", "email"],
  hostBull: ["hb_admin_access", "email"], ubersmyth: ["admins", "email"], boxBillin: ["admin", "email"],
};

export interface ShopAdmin { first: string; last: string; email: string; user: string; pass: string }

// The shop and release whose files sit in the folder, read from the index.php its archive unpacked.
export function filesIn(ws: Webspace, folder: string): { id: ShopId; version: string } | null {
  const f = ws.files[`${folder}/index.php`];
  return f?.from ? shopOfArchive(f.from) : null;
}
export const installDirIn = (ws: Webspace, folder: string): boolean => !!ws.files[`${folder}/${INSTALL_DIR}`]?.dir;

const phpIndex = (v: string) => PHP.findIndex((p) => p.version === v);
// A release needs the PHP that was current three years before it came out.
export const phpNeeded = (id: ShopId, version: string): string => phpAt(yearOf(versionInfo(id, version)?.release ?? 0) - 3);
// The release that comes later in the shop's version line.
export const newerRelease = (id: ShopId, a: string, b: string): boolean => {
  const vs = versionsOf(id);
  return vs.findIndex((x) => x.version === a) > vs.findIndex((x) => x.version === b);
};

export interface Requirement { key: "php" | "ioncube"; ok: boolean; params: Record<string, string> }
// The installer's requirements check against the PHP of the folder's domain and the host's loaders.
export function requirementsOf(s: GameState, ws: Webspace, folder: string, id: ShopId, version: string): Requirement[] {
  const own = s.ownWebspaces.find((x) => x.id === ws.workloadId), c = s.clusters.find((x) => x.id === own?.clusterId);
  // Before the MultiPHP Manager every domain runs the host's PHP.
  const d = yearOf(s.hour) >= MULTI_PHP_YEAR ? Object.values(ws.domains).find((x) => x.folder === folder) : undefined;
  const php = d?.php ?? c?.php ?? phpAt(yearOf(s.hour)), need = phpNeeded(id, version);
  const out: Requirement[] = [{ key: "php", ok: phpIndex(php) >= phpIndex(need), params: { have: php, need } }];
  // The loader is there once the EasyApache build that adds it has finished.
  if (IONCUBE.includes(id)) out.push({ key: "ioncube", ok: !!c?.ioncube && c.phpUntil <= s.hour, params: { have: php } });
  return out;
}

// MySQL's answer when the installer connects with these details; null when it gets in.
export function dbAccessError(ws: Webspace, host: string, db: string, user: string, pass: string): { error: string; params: Record<string, string> } | null {
  if (!["localhost", "127.0.0.1"].includes(host.trim())) return { error: "shop-setup.db.host", params: { host: host.trim() } };
  const u = ws.dbUsers[user];
  if (!u || u.password !== pass) return { error: "shop-setup.db.denied", params: { user, yes: pass ? "YES" : "NO" } };
  if (!ws.databases[db] || !u.grants[db]?.length) return { error: "shop-setup.db.dbDenied", params: { user, db } };
  return null;
}

// Passwords as the shop stores them: MD5 before its move to bcrypt, then bcrypt. The game's bcrypt keeps the real
// "$2y$10$" layout, with an MD5 of salt and password standing in for the cost rounds.
const SALT = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const bcrypt = (pass: string, salt: string) => `$2y$10$${salt}${md5(salt + pass).slice(0, 31)}`;
export const isMd5 = (v: string): boolean => /^[0-9a-f]{32}$/.test(v);
export const usesBcrypt = (id: ShopId, version: string): boolean => yearOf(versionInfo(id, version)?.release ?? 0) >= (BCRYPT_FROM[id] ?? Infinity);
export function hashFor(s: GameState, id: ShopId, version: string, pass: string): string {
  if (!usesBcrypt(id, version)) return md5(pass);
  const r = hashRng(s.seed, s.hour, s.nextId, pass.length);
  return bcrypt(pass, Array.from({ length: 22 }, () => SALT[Math.floor(rand(r) * SALT.length)]).join(""));
}
export const passMatches = (stored: string, pass: string): boolean =>
  stored.startsWith("$2y$10$") ? stored === bcrypt(pass, stored.slice(7, 29)) : stored === md5(pass);

// The rows an installer writes for the first admin, by table; the password is already hashed.
export function adminRows(id: ShopId, a: ShopAdmin): [table: string, values: Record<string, string>][] {
  const name = `${a.first} ${a.last}`.trim();
  switch (id) {
    case "whmCache": return [["tbladmins", { username: a.user, password: a.pass, firstname: a.first, lastname: a.last, email: a.email }]];
    case "modemBill": return [["admin", { admin_username: a.user, admin_password: a.pass, admin_realname: name, admin_email: a.email }]];
    case "clientExit": return [["users", { groupid: "1", firstname: a.first, lastname: a.last, email: a.email, password: a.pass }]];
    case "blessta": return [["users", { username: a.user, password: a.pass }], ["staff", { user_id: "1", first_name: a.first, last_name: a.last, email: a.email }]];
    case "hostBull": return [["hb_admin_access", { username: a.user, password: a.pass, firstname: a.first, lastname: a.last, email: a.email }]];
    case "ubersmyth": return [["admins", { login: a.user, password: a.pass, email: a.email }]];
    case "boxBillin": return [["admin", { role: "admin", name, email: a.email, pass: a.pass }]];
    default: return [];
  }
}

// The installed shop's web space, folder and database, while the installer has finished in one.
export function shopSpace(s: GameState): { ws: Webspace; folder: string; db: string; id: ShopId; version: string } | null {
  const at = s.shop.install, id = s.shop.variant;
  if (!at?.ws || !at.folder || !at.db || !id) return null;
  const ws = webspaceOf(s, at.ws);
  return ws ? { ws, folder: at.folder, db: at.db, id, version: at.version } : null;
}

// A shop installed into a web space stops when its files, config, tables or domain are gone, or while the files are of
// another release than the one installed (an upgrade waiting for its script). A hosted shop has no web space.
export function shopBroken(s: GameState): boolean {
  if (!s.shop.install?.ws) return false;
  const at = shopSpace(s);
  if (!at) return true;
  const { ws, folder, db, id, version } = at, files = filesIn(ws, folder), config = CONFIG_FILE[id];
  return !files || files.id !== id || files.version !== version || !config || !ws.files[`${folder}/${config}`]
    || !urlOf(ws, folder) || !tablesOf(s, ws, db).length;
}

// The installed shop still has its install folder: a security finding on its host.
export function installDirLeft(s: GameState, clusterId?: string): boolean {
  const at = shopSpace(s);
  return !!at && (clusterId === undefined || s.shop.install!.clusterId === clusterId) && installDirIn(at.ws, at.folder);
}

// The admin row a login or reset finds, by the login column or by the e-mail address.
export function adminRow(s: GameState, by: "login" | "email", value: string): { pk: number; pass: string } | null {
  const at = shopSpace(s), a = at && ADMIN_TABLE[at.id], mail = at && EMAIL_AT[at.id];
  if (!at || !a || !mail || !value) return null;
  if (by === "login") {
    const r = findRows(s, at.ws, at.db, a.table, a.user, value)[0];
    return r ? { pk: r.pk, pass: r.values[a.pass] } : null;
  }
  const r = findRows(s, at.ws, at.db, mail[0], mail[1], value)[0];
  // Blessta keeps the e-mail on the staff row, which points at its user.
  const pk = r ? (mail[0] === a.table ? r.pk : Number(r.values.user_id)) : 0;
  const row = pk ? findRows(s, at.ws, at.db, a.table, "id", String(pk))[0] : undefined;
  return row ? { pk: row.pk, pass: row.values[a.pass] } : null;
}

// The address a folder answers at: a domain pointing at it, or one level below a domain's folder.
function urlOf(ws: Webspace, folder: string): string | null {
  const ds = Object.values(ws.domains), d = ds.find((x) => x.folder === folder);
  if (d) return d.name;
  const up = ds.find((x) => folder.startsWith(`${x.folder}/`) && !folder.slice(x.folder.length + 1).includes("/"));
  return up ? `${up.name}${folder.slice(up.folder.length)}` : null;
}

// The address the shop answers at, such as portal.example.com or example.com/billing.
export function shopUrl(s: GameState): string | null {
  const at = shopSpace(s);
  return at && urlOf(at.ws, at.folder);
}

// The shop files a request reaches in the player's own web spaces: in the folder the host points at, or in the folder
// below it named by the path's first segment. base is that segment, rest the path inside the shop.
export function shopFolderAt(s: GameState, host: string, path: string): { ws: Webspace; folder: string; base: string; rest: string } | null {
  const name = host.startsWith("www.") ? host.slice(4) : host;
  for (const o of s.ownWebspaces) {
    const ws = webspaceOf(s, o.id), d = ws?.domains[name];
    if (!ws || !d) continue;
    if (filesIn(ws, d.folder)) return { ws, folder: d.folder, base: "", rest: path };
    const seg = path.split(/[/?#]/)[1];
    if (seg && filesIn(ws, `${d.folder}/${seg}`)) return { ws, folder: `${d.folder}/${seg}`, base: `/${seg}`, rest: path.slice(seg.length + 1) || "/" };
    return null;
  }
  return null;
}

// The first name WHMCache greets its first admin with.
export function adminFirstName(s: GameState): string | null {
  const at = shopSpace(s);
  return (at?.id === "whmCache" && rowsOf(s, at.ws, at.db, "tbladmins", 0, 1)[0]?.values.firstname) || null;
}
