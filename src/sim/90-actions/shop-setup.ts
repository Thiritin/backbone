// docs/design/web-hosting.md 4.6 and 5: the shop's web installer, its upgrade script, the admin login with its password
// reset, and the one-step install through the panel's app installer.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { shopArchive } from "../10-catalog/archives";
import { shopById, type ShopId } from "../10-catalog/shops";
import { versionAt } from "../10-catalog/software-versions";
import { deliverMail } from "../42-mail/sources";
import type { GameState } from "../50-state";
import { SHOP_MACHINE, upgradeKey, upgradeKeyBlock } from "../60-infra/licence";
import {
  adminRow, adminRows, CONFIG_FILE, dbAccessError, EMAIL_LOGIN, filesIn, hashFor, installDirIn, INSTALL_DIR, isMd5, newerRelease, passMatches,
  requirementsOf, shopBroken, shopSpace, shopUrl, usesBcrypt, type ShopAdmin,
} from "../60-infra/shop-files";
import { ADMIN_TABLE, tablesOf } from "../60-infra/webdb";
import { webspaceOf, type Webspace } from "../60-infra/webspace";
import { portalPath } from "../80-business/portal";
import type { ActionResult } from "./hardware";
import { installShop, shopClaimBlock } from "./shop";
import { createDatabase, createDbUser, createSubdomain, grantDb } from "./webspace";
import { fail, isFail, join, open, put } from "./webspace-base";
import { createTables, editRow, insertRow } from "./webdb";

export interface InstallForm extends ShopAdmin { key?: string; dbHost: string; dbName: string; dbUser: string; dbPass: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
export const PASS_MIN = 6;
// Hours a reset link stays valid.
const RESET_HOURS = 24;

const ownSpace = (s: GameState, wsId: string): { ws: Webspace; clusterId: string } | ActionResult => {
  const own = s.ownWebspaces.find((x) => x.id === wsId), ws = open(s, wsId);
  if (isFail(ws)) return ws;
  return own ? { ws, clusterId: own.clusterId } : fail("shop-setup.error.noFiles");
};

// What the admin step refuses: a variant that logs in by e-mail takes the address as its username.
export function adminError(id: ShopId, a: ShopAdmin): ActionResult | null {
  if (!EMAIL.test(a.email)) return fail("shop-setup.error.email");
  if (!EMAIL_LOGIN.includes(id) && !/^[A-Za-z0-9._@-]{3,32}$/.test(a.user)) return fail("shop-setup.error.username");
  if (a.pass.length < PASS_MIN) return fail("shop-setup.error.passShort", { min: String(PASS_MIN) });
  return null;
}

// The licence and database steps of the installer, checked before the wizard moves on.
export function installerStepError(s: GameState, wsId: string, folder: string, step: "requirements" | "licence" | "db", f: Partial<InstallForm>): ActionResult | null {
  const at = ownSpace(s, wsId);
  if ("ok" in at) return at;
  const files = filesIn(at.ws, folder);
  if (!files) return fail("shop-setup.error.noFiles");
  if (step === "requirements") {
    const r = requirementsOf(s, at.ws, folder, files.id, files.version).find((x) => !x.ok);
    return r ? fail(`shop-setup.req.${r.key}.fail`, { ...r.params, name: shopById(files.id).name }) : null;
  }
  if (step === "licence") {
    const b = shopClaimBlock(s, at.clusterId, files.id, f.key || undefined, files.version);
    return b ? fail(b) : null;
  }
  const db = dbAccessError(at.ws, f.dbHost ?? "", f.dbName ?? "", f.dbUser ?? "", f.dbPass ?? "");
  if (db) return fail(db.error, db.params);
  return tablesOf(s, at.ws, f.dbName!).length ? fail("shop-setup.error.tablesExist", { db: f.dbName! }) : null;
}

// Creates the tables, the first admin and the config file, then hands the shop its licence and install record.
function finish(s: GameState, wsId: string, clusterId: string, folder: string, id: ShopId, version: string, db: string, a: ShopAdmin, key?: string): ActionResult {
  const t = createTables(s, wsId, db, id);
  if (!t.ok) return t;
  const admin = { ...a, user: EMAIL_LOGIN.includes(id) ? a.email : a.user, pass: hashFor(s, id, version, a.pass) };
  for (const [table, values] of adminRows(id, admin)) insertRow(s, wsId, db, table, values);
  put(s, wsId, "files", join(folder, CONFIG_FILE[id]!), { mb: 0.002, at: s.hour, from: shopArchive(id, version)!.name });
  const r = installShop(s, clusterId, id, key, version);
  if (!r.ok) return r;
  s.shop = { ...s.shop, install: { ...s.shop.install!, ws: wsId, folder, db } };
  return { ok: true, id: version };
}

// The web installer's last step: everything the earlier steps checked, then the install itself.
export function runShopInstaller(s: GameState, wsId: string, folder: string, f: InstallForm): ActionResult {
  const at = ownSpace(s, wsId);
  if ("ok" in at) return at;
  const files = filesIn(at.ws, folder);
  if (!files || !installDirIn(at.ws, folder)) return fail("shop-setup.error.noFiles");
  const i = s.shop.install;
  if (i?.ws === wsId && i.folder === folder && !shopBroken(s)) return fail("shop-setup.error.installed");
  for (const step of ["requirements", "licence", "db"] as const) {
    const e = installerStepError(s, wsId, folder, step, f);
    if (e) return e;
  }
  const bad = adminError(files.id, f);
  if (bad) return bad;
  return finish(s, wsId, at.clusterId, folder, files.id, files.version, f.dbName, f, f.key || undefined);
}

// The upgrade script: files of a newer release over the installed one move the shop to it, licensed by the key it holds
// or by the typed one.
export function runShopUpgrade(s: GameState, key?: string): ActionResult {
  const at = shopSpace(s);
  if (!at) return fail("error.shopNotInstalled");
  const files = filesIn(at.ws, at.folder);
  if (!files || files.id !== at.id || !installDirIn(at.ws, at.folder)) return fail("shop-setup.error.noFiles");
  if (!newerRelease(at.id, files.version, at.version)) return fail("shop-setup.upgrade.current", { version: at.version });
  const code = key?.trim() || undefined, b = upgradeKeyBlock(s, SHOP_MACHINE, at.id, files.version, code);
  if (b) return fail(b);
  upgradeKey(s, SHOP_MACHINE, at.id, files.version, code);
  s.shop = { ...s.shop, install: { ...s.shop.install!, version: files.version } };
  return { ok: true, id: files.version };
}

// The admin login: the typed password against the stored hash. A plain MD5, as phpMyAdmon's MD5 function writes it, is
// accepted once and stored again in the format of the running release.
export function shopLogin(s: GameState, user: string, pass: string): ActionResult {
  const at = shopSpace(s);
  if (!at) return { ok: true };
  const row = adminRow(s, "login", user.trim()), a = ADMIN_TABLE[at.id];
  if (!row || !passMatches(row.pass, pass)) return fail(`shop-setup.login.${at.id}`);
  if (isMd5(row.pass) && usesBcrypt(at.id, at.version)) editRow(s, at.ws.workloadId, at.db, a.table, row.pk, { [a.pass]: hashFor(s, at.id, at.version, pass) });
  return { ok: true };
}

// Forgot password: mails a reset link to the admin with that address. The page says the same whether one exists.
export function requestShopReset(s: GameState, email: string): ActionResult {
  const at = shopSpace(s), row = at && adminRow(s, "email", email.trim()), host = shopUrl(s);
  if (!at || !row || !host) return { ok: true };
  const r = hashRng(s.seed, s.hour, s.nextId, 77), token = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(rand(r) * 16)]).join("");
  s.shop = { ...s.shop, reset: { token, pk: row.pk, until: s.hour + RESET_HOURS } };
  deliverMail(s, shopById(at.id).name, "shopReset", { name: shopById(at.id).name, email: email.trim(), url: `${host}${portalPath(at.id, "admin", {}, { reset: token })}` });
  return { ok: true };
}

// Following the reset link: a new password for the admin it was sent for.
export function resetShopPassword(s: GameState, token: string, pass: string): ActionResult {
  const at = shopSpace(s), r = s.shop.reset;
  if (!at || !r || r.token !== token || s.hour > r.until) return fail("shop-setup.reset.expired");
  if (pass.length < PASS_MIN) return fail("shop-setup.error.passShort", { min: String(PASS_MIN) });
  const a = ADMIN_TABLE[at.id];
  editRow(s, at.ws.workloadId, at.db, a.table, r.pk, { [a.pass]: hashFor(s, at.id, at.version, pass) });
  s.shop = { ...s.shop, reset: null };
  return { ok: true };
}

// The years the real app installers listed each shop system; Fantastiko never carried one.
export const APP_INSTALLER_SHOPS: Partial<Record<ShopId, [from: number, until: number]>> = { boxBillin: [2012, 2018], clientExit: [2013, 9999], blessta: [2014, 9999] };
export const appInstallerShops = (year: number): ShopId[] =>
  (Object.entries(APP_INSTALLER_SHOPS) as [ShopId, [number, number]][]).filter(([, [a, b]]) => year >= a && year <= b).map(([id]) => id);

export interface AppInstallForm extends ShopAdmin { domain: string; dir: string; key?: string }

const randomText = (s: GameState, n: number, salt: number) => {
  const r = hashRng(s.seed, s.hour, s.nextId, salt);
  return Array.from({ length: n }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(rand(r) * 32)]).join("");
};

// Puts the release's files into the folder as the archive unpacks them, without the install folder.
function placeFiles(s: GameState, wsId: string, folder: string, id: ShopId, version: string, keepInstall: boolean): void {
  const a = shopArchive(id, version)!;
  for (const [p, mb] of a.entries) {
    const rel = p.replace(/\/$/, "");
    if (!keepInstall && rel === INSTALL_DIR) continue;
    put(s, wsId, "files", join(folder, rel), { ...(p.endsWith("/") && { dir: true as const }), mb, at: s.hour, from: a.name });
  }
}

// A database and a user of the same random name, as app installers create them.
function newDatabase(s: GameState, wsId: string, slug: string): ActionResult & { pass?: string } {
  const pass = randomText(s, 12, 51);
  for (let i = 0; i < 20; i++) {
    const name = `${slug.slice(0, 4)}${100 + Math.floor(rand(hashRng(s.seed, s.hour, i, 52)) * 900)}`;
    const d = createDatabase(s, wsId, name);
    if (!d.ok) continue;
    const u = createDbUser(s, wsId, name, pass);
    if (!u.ok) return u;
    grantDb(s, wsId, u.id!, d.id!);
    return { ok: true, id: d.id, pass };
  }
  return fail("webspace.error.dbTaken");
}

// Softaculus: picks a domain and a folder, creates the folder, files, database and user itself and runs the install.
export function installShopApp(s: GameState, wsId: string, id: ShopId, f: AppInstallForm): ActionResult {
  if (!appInstallerShops(yearOf(s.hour)).includes(id)) return fail("shop-setup.app.notListed");
  const at = ownSpace(s, wsId);
  if ("ok" in at) return at;
  const d = at.ws.domains[f.domain];
  if (!d) return fail("webspace.error.noDomain");
  const dir = f.dir.trim().replace(/^\/+|\/+$/g, "");
  if (dir && !/^[A-Za-z0-9._-]+$/.test(dir)) return fail("webspace.error.fileName");
  const folder = dir ? join(d.folder, dir) : d.folder;
  if (Object.keys(at.ws.files).some((p) => p.startsWith(`${folder}/`) && !(dir === "" && p === `${folder}/index.html`))) return fail("shop-setup.app.notEmpty", { folder: `/${folder}` });
  const version = versionAt(id, s.hour).version;
  const req = requirementsOf(s, at.ws, folder, id, version).find((x) => !x.ok);
  if (req) return fail(`shop-setup.req.${req.key}.fail`, { ...req.params, name: shopById(id).name });
  const b = shopClaimBlock(s, at.clusterId, id, f.key || undefined, version);
  if (b) return fail(b);
  const bad = adminError(id, f);
  if (bad) return bad;
  const db = newDatabase(s, wsId, id.toLowerCase());
  if (!db.ok) return db;
  if (!at.ws.files[folder]) put(s, wsId, "files", folder, { dir: true, mb: 0, at: s.hour });
  placeFiles(s, wsId, folder, id, version, false);
  return finish(s, wsId, at.clusterId, folder, id, version, db.id!, f, f.key || undefined);
}

// Saves from before the web installer: the shop's own web space gets the portal subdomain with the installed release's
// files, a database with its tables and an admin "admin" with a random password, mailed to the player once.
export function fillShopWebspace(s: GameState): void {
  const i = s.shop.install, id = s.shop.variant, own = i && s.ownWebspaces.find((x) => x.clusterId === i.clusterId);
  if (!i || i.ws || !id || !own || !shopArchive(id, i.version)) return;
  const ws = webspaceOf(s, own.id)!, host = `portal.${ws.domain}`;
  if (!ws.domains[host] && !createSubdomain(s, own.id, "portal", ws.domain).ok) return;
  const folder = webspaceOf(s, own.id)!.domains[host].folder;
  placeFiles(s, own.id, folder, id, i.version, false);
  const db = newDatabase(s, own.id, "shop");
  if (!db.ok) return;
  const pass = randomText(s, 10, 53), email = `info@${ws.domain}`;
  const t = createTables(s, own.id, db.id!, id);
  if (!t.ok) return;
  const user = EMAIL_LOGIN.includes(id) ? email : "admin";
  for (const [table, values] of adminRows(id, { first: "Admin", last: "", email, user, pass: hashFor(s, id, i.version, pass) })) insertRow(s, own.id, db.id!, table, values);
  put(s, own.id, "files", join(folder, CONFIG_FILE[id]!), { mb: 0.002, at: s.hour, from: shopArchive(id, i.version)!.name });
  s.shop = { ...s.shop, install: { ...i, ws: own.id, folder, db: db.id! } };
  deliverMail(s, shopById(id).name, "shopCredentials", { name: shopById(id).name, user, pass, url: `${host}${portalPath(id, "admin")}` });
}
