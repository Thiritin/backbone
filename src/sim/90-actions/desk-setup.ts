// docs/design/web-hosting.md 5.1: the self-hosted desk's web installer, its staff login with the password reset, the
// one-step install through Softaculus, and the fill for saves from before.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { deskArchive, sampleConfig, type SelfDeskId } from "../10-catalog/archives";
import { deskById } from "../10-catalog/desks";
import { versionAt } from "../10-catalog/software-versions";
import { companyDomain } from "../30-customers/domains";
import { dropDesk, openDesk } from "../40-support/desk";
import { deliverMail } from "../42-mail/sources";
import type { GameState } from "../50-state";
import { deskAdminRow, deskBroken, deskConfigPath, deskFilesIn, deskSpace, deskUrl, setupDirIn, SETUP_DIR, worldWritable } from "../60-infra/desk-files";
import { dbAccessError, hashFor, isMd5, passMatches, requirementsOf, usesBcrypt, type ShopAdmin } from "../60-infra/shop-files";
import { ADMIN_TABLE, tablesOf } from "../60-infra/webdb";
import { accountFor, webspaceOf } from "../60-infra/webspace";
import { deskPath } from "../80-business/deskroutes";
import type { ActionResult } from "./hardware";
import { adminError, newDatabase, PASS_MIN, randomText } from "./shop-setup";
import { createSubdomain } from "./webspace";
import { fail, isFail, join, open, put } from "./webspace-base";
import { createTables, editRow, insertRow } from "./webdb";

// helpdesk and deskEmail are OsTickit's System Settings; FreeScoot logs in with the admin's e-mail address.
export interface DeskInstallForm extends ShopAdmin { helpdesk: string; deskEmail: string; dbHost: string; dbName: string; dbUser: string; dbPass: string }
export type DeskInstallStep = "requirements" | "config" | "db" | "admin";

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const RESET_HOURS = 24;

const ownSpace = (s: GameState, wsId: string) => {
  const own = s.ownWebspaces.find((x) => x.id === wsId), ws = open(s, wsId);
  if (isFail(ws)) return ws;
  return own ? { ws, clusterId: own.clusterId } : fail("shop-setup.error.noFiles");
};

// What each installer step checks before it moves on, in the desk's own words.
export function deskStepError(s: GameState, wsId: string, folder: string, step: DeskInstallStep, f: Partial<DeskInstallForm>): ActionResult | null {
  const at = ownSpace(s, wsId);
  if ("ok" in at) return at;
  const files = deskFilesIn(at.ws, folder);
  if (!files) return fail("shop-setup.error.noFiles");
  if (step === "requirements") {
    const r = requirementsOf(s, at.ws, folder, files.id, files.version).find((x) => !x.ok);
    return r ? fail(`shop-setup.req.${r.key}.fail`, { ...r.params, name: deskById(files.id)!.name }) : null;
  }
  if (step === "config") {
    if (files.id !== "ostickit") return null;
    const path = deskConfigPath(files.id, folder);
    if (!at.ws.files[path]) return fail("desk-setup.ost.configMissing", { sample: `include/${sampleConfig(files.version)}` });
    return worldWritable(path, at.ws) ? null : fail("desk-setup.ost.configLocked", { file: "include/ost-config.php" });
  }
  if (step === "admin") {
    if (files.id === "ostickit" && !f.helpdesk?.trim()) return fail("desk-setup.error.helpdesk");
    if (files.id === "ostickit" && !EMAIL.test(f.deskEmail ?? "")) return fail("shop-setup.error.email");
    return adminError(files.id, { first: f.first ?? "", last: f.last ?? "", email: f.email ?? "", user: files.id === "freescoot" ? f.email ?? "" : f.user ?? "", pass: f.pass ?? "" });
  }
  const db = dbAccessError(at.ws, f.dbHost ?? "", f.dbName ?? "", f.dbUser ?? "", f.dbPass ?? "");
  if (db) return fail(db.error, db.params);
  return tablesOf(s, at.ws, f.dbName!).length ? fail("shop-setup.error.tablesExist", { db: f.dbName! }) : null;
}

// The desk in use from now on runs from this web space; the same desk keeps its configuration, another one replaces it.
function placeDesk(s: GameState, clusterId: string, id: SelfDeskId, version: string, ws: string, folder: string, db: string): void {
  const hosting = { kind: "self" as const, clusterId, version, ws, folder, db };
  if (s.desk?.id === id) s.desk = { ...s.desk, hosting, reset: null };
  else { dropDesk(s); openDesk(s, id, hosting); }
}

// Tables, the first admin and the config file, as the installer writes them.
function finish(s: GameState, wsId: string, clusterId: string, folder: string, id: SelfDeskId, version: string, db: string, f: ShopAdmin & { helpdesk?: string }): ActionResult {
  const t = createTables(s, wsId, db, id);
  if (!t.ok) return t;
  const pass = hashFor(s, id, version, f.pass);
  if (id === "ostickit") {
    insertRow(s, wsId, db, "ost_staff", { dept_id: "1", username: f.user, firstname: f.first, lastname: f.last, passwd: pass, email: f.email, isadmin: "1" });
    insertRow(s, wsId, db, "ost_config", { namespace: "core", key: "helpdesk_title", value: f.helpdesk ?? "" });
  } else insertRow(s, wsId, db, "users", { first_name: f.first, last_name: f.last, email: f.email, password: pass, role: "2" });
  const conf = deskConfigPath(id, folder), ws = webspaceOf(s, wsId)!;
  put(s, wsId, "files", conf, { ...ws.files[conf], mb: 0.003, at: s.hour, from: deskArchive(id, version).name });
  placeDesk(s, clusterId, id, version, wsId, folder, db);
  return { ok: true, id: version };
}

// The installer's last step: everything the earlier steps checked, then the install itself.
export function runDeskInstaller(s: GameState, wsId: string, folder: string, f: DeskInstallForm): ActionResult {
  const at = ownSpace(s, wsId);
  if ("ok" in at) return at;
  const files = deskFilesIn(at.ws, folder);
  if (!files || (files.id === "ostickit" && !setupDirIn(at.ws, folder))) return fail("shop-setup.error.noFiles");
  const h = s.desk?.hosting;
  if (h?.kind === "self" && h.ws === wsId && h.folder === folder && !deskBroken(s)) return fail("desk-setup.error.installed");
  for (const step of ["requirements", "config", "db", "admin"] as const) {
    const e = deskStepError(s, wsId, folder, step, f);
    if (e) return e;
  }
  return finish(s, wsId, at.clusterId, folder, files.id, files.version, f.dbName, { ...f, user: files.id === "freescoot" ? f.email : f.user });
}

// The staff login: the typed password against the stored hash. OsTickit takes a plain MD5 from phpMyAdmon once and stores
// it again in its current format; FreeScoot only knows bcrypt. A desk from before web spaces has no accounts to check.
export function deskLogin(s: GameState, user: string, pass: string): ActionResult {
  const at = deskSpace(s);
  if (!at) return { ok: true };
  const row = deskAdminRow(s, "login", user.trim()) ?? (at.id === "ostickit" ? deskAdminRow(s, "email", user.trim()) : null);
  if (!row || (at.id === "freescoot" && isMd5(row.pass)) || !passMatches(row.pass, pass)) return fail(`desk-setup.login.${at.id}`);
  const a = ADMIN_TABLE[at.id];
  if (isMd5(row.pass) && usesBcrypt(at.id, at.version)) editRow(s, at.ws.workloadId, at.db, a.table, row.pk, { [a.pass]: hashFor(s, at.id, at.version, pass) });
  return { ok: true };
}

// Forgot password: mails a reset link to the staff member with that username or address. The page says the same either way.
export function requestDeskReset(s: GameState, value: string): ActionResult {
  const at = deskSpace(s), v = value.trim(), row = at && (deskAdminRow(s, "email", v) ?? deskAdminRow(s, "login", v)), host = deskUrl(s);
  if (!at || !row || !host) return { ok: true };
  const r = hashRng(s.seed, s.hour, s.nextId, 79), token = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(rand(r) * 16)]).join("");
  s.desk = { ...s.desk!, reset: { token, pk: row.pk, until: s.hour + RESET_HOURS } };
  const url = host + (at.id === "ostickit" ? deskPath("ostickit", "pwresetToken", { id: token }) : deskPath("freescoot", "passwordReset", { id: token }));
  deliverMail(s, deskById(at.id)!.name, "deskReset", { name: deskById(at.id)!.name, email: row.email, url });
  return { ok: true };
}

// Following the reset link: a new password for the staff member it was sent for.
export function resetDeskPassword(s: GameState, token: string, pass: string): ActionResult {
  const at = deskSpace(s), r = s.desk?.reset;
  if (!at || !r || r.token !== token || s.hour > r.until) return fail("desk-setup.reset.expired");
  if (pass.length < PASS_MIN) return fail("shop-setup.error.passShort", { min: String(PASS_MIN) });
  const a = ADMIN_TABLE[at.id];
  editRow(s, at.ws.workloadId, at.db, a.table, r.pk, { [a.pass]: hashFor(s, at.id, at.version, pass) });
  s.desk = { ...s.desk!, reset: null };
  return { ok: true };
}

// Puts a release into dir as an app installer does: OsTickit's web root without its setup folder and with the config in
// place, FreeScoot's whole app with its .env. Returns the web root.
function placeDeskFiles(s: GameState, wsId: string, dir: string, id: SelfDeskId, version: string): string {
  const a = deskArchive(id, version), sample = `include/${sampleConfig(version)}`;
  if (!webspaceOf(s, wsId)!.files[dir]) put(s, wsId, "files", dir, { dir: true, mb: 0, at: s.hour });
  for (const [p, mb] of a.entries) {
    let rel = p.replace(/\/$/, "");
    if (id === "ostickit") {
      if (!rel.startsWith("upload/")) continue;
      rel = rel.slice(7);
      if (rel === SETUP_DIR) continue;
      if (rel === sample) rel = "include/ost-config.php";
    }
    put(s, wsId, "files", join(dir, rel), { ...(p.endsWith("/") && { dir: true as const }), mb, at: s.hour, from: a.name });
  }
  if (id === "freescoot") put(s, wsId, "files", join(dir, ".env"), { mb: 0.002, at: s.hour, from: a.name });
  return id === "freescoot" ? join(dir, "public") : dir;
}

// The years Softaculus listed each desk; it never carried FreeScoot.
export const APP_INSTALLER_DESKS: Partial<Record<SelfDeskId, number>> = { ostickit: 2009 };
export const appInstallerDesks = (year: number): SelfDeskId[] =>
  (Object.entries(APP_INSTALLER_DESKS) as [SelfDeskId, number][]).filter(([, from]) => year >= from).map(([id]) => id);

export interface DeskAppForm extends ShopAdmin { domain: string; dir: string; helpdesk: string; deskEmail: string }

// Softaculus: creates the folder, files, database and user itself and runs the install, leaving no setup folder behind.
export function installDeskApp(s: GameState, wsId: string, id: SelfDeskId, f: DeskAppForm): ActionResult {
  if (!appInstallerDesks(yearOf(s.hour)).includes(id)) return fail("shop-setup.app.notListed");
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
  if (req) return fail(`shop-setup.req.${req.key}.fail`, { ...req.params, name: deskById(id)!.name });
  if (!f.helpdesk.trim()) return fail("desk-setup.error.helpdesk");
  if (!EMAIL.test(f.deskEmail)) return fail("shop-setup.error.email");
  const bad = adminError(id, f);
  if (bad) return bad;
  const db = newDatabase(s, wsId, "osticket");
  if (!db.ok) return db;
  placeDeskFiles(s, wsId, folder, id, version);
  return finish(s, wsId, at.clusterId, folder, id, version, db.id!, f);
}

// Saves from before the web installer: the desk's host gets an own web space if it has none, with the support subdomain
// holding the installed release, a database with its tables and an admin with a random password, mailed once.
export function fillDeskWebspace(s: GameState): void {
  const h = s.desk?.hosting, id = s.desk?.id as SelfDeskId;
  if (h?.kind !== "self" || h.ws || !s.clusters.some((c) => c.id === h.clusterId && c.kind === "panel" && c.panel)) return;
  const domain = companyDomain(s);
  let own = s.ownWebspaces.find((x) => x.clusterId === h.clusterId);
  if (!own) {
    own = { id: `ws${s.nextId++}`, clusterId: h.clusterId, account: accountFor(domain), domain, at: s.hour };
    s.ownWebspaces = [...s.ownWebspaces, own];
  }
  const ws = webspaceOf(s, own.id)!, host = `support.${ws.domain}`, dir = join(ws.webroot, "support");
  const root = id === "freescoot" ? join(dir, "public") : dir;
  if (!ws.files[dir]) put(s, own.id, "files", dir, { dir: true, mb: 0, at: s.hour });
  if (!ws.domains[host] && !createSubdomain(s, own.id, "support", ws.domain, root).ok) return;
  const folder = placeDeskFiles(s, own.id, dir, id, h.version);
  const db = newDatabase(s, own.id, "desk");
  if (!db.ok) return;
  const pass = randomText(s, 10, 54), email = `info@${ws.domain}`, user = id === "freescoot" ? email : "admin";
  const r = finish(s, own.id, h.clusterId, folder, id, h.version, db.id!, { first: "Admin", last: "", email, user, pass, helpdesk: s.company.name });
  if (!r.ok) return;
  const url = `${host}${id === "ostickit" ? deskPath("ostickit", "scp") : deskPath("freescoot", "login")}`;
  deliverMail(s, deskById(id)!.name, "deskCredentials", { name: deskById(id)!.name, user, pass, url });
}
