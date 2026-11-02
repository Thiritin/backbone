// docs/design/web-hosting.md, The web space: the player's changes to a web space, stored in its overlay.
import { yearOf } from "../00-core/time";
import { PHP } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import {
  ALL_PRIVILEGES, deriveWebspace, dbUserMax, MULTI_PHP_YEAR, webspaceOf,
  type DomainKind, type PartName, type WebLimits, type WebParts, type Webspace,
} from "../60-infra/webspace";
import type { ActionResult } from "./hardware";

const fail = (error: string, params?: Record<string, string>): ActionResult => ({ ok: false, error, ...(params && { params }) });
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/;
const DB_PART = /^[a-z0-9_]+$/;
const FILE_NAME = /^[^/\0]{1,255}$/;

// Writes one entry to the overlay; removing an entry the derivation lacks just drops the stored one.
function put<K extends PartName>(s: GameState, id: string, part: K, key: string, value: WebParts[K][string] | false): void {
  const o = (s.webspaces[id] ??= {}), m = (o[part] ??= {}) as Record<string, WebParts[K][string] | false>;
  if (value === false && !(key in (deriveWebspace(s, id)?.[part] ?? {}))) delete m[key];
  else m[key] = value;
  if (!Object.keys(m).length) delete o[part];
  if (!Object.keys(o).length) delete s.webspaces[id];
}

// The web space, or the error for an unknown one or a host that is offline.
function open(s: GameState, id: string): Webspace | ActionResult {
  const ws = webspaceOf(s, id);
  if (!ws) return fail("error.unknownWorkload");
  const w = s.workloads.find((x) => x.id === id)!;
  return s.security.offline.includes(w.clusterId ?? "") ? fail("webspace.error.offline") : ws;
}
const isFail = (x: Webspace | ActionResult): x is ActionResult => "ok" in x;
const full = (ws: Webspace, k: keyof WebLimits, used: number): ActionResult | null =>
  used >= ws.limits[k] ? fail(`webspace.error.limit.${k}`, { max: String(ws.limits[k]) }) : null;
const password = (p: string): boolean => p.length >= 5 && p.length <= 64;
const folderOk = (ws: Webspace, folder: string): boolean => !!ws.files[folder]?.dir;

export function createDatabase(s: GameState, workloadId: string, name: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const db = ws.prefix + name;
  if (!DB_PART.test(name) || db.length > 64) return fail("webspace.error.dbName");
  if (ws.databases[db]) return fail("webspace.error.dbTaken");
  const over = full(ws, "databases", ws.usage.databases);
  if (over) return over;
  put(s, workloadId, "databases", db, { name: db, mb: 0 });
  return { ok: true, id: db };
}

// Drops the database and every grant on it.
export function deleteDatabase(s: GameState, workloadId: string, db: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.databases[db]) return fail("webspace.error.noDatabase");
  put(s, workloadId, "databases", db, false);
  for (const u of Object.values(ws.dbUsers)) if (u.grants[db]) {
    const { [db]: _, ...grants } = u.grants;
    put(s, workloadId, "dbUsers", u.name, { ...u, grants });
  }
  return { ok: true, id: db };
}

export function createDbUser(s: GameState, workloadId: string, name: string, pass: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const user = ws.prefix + name;
  if (!DB_PART.test(name) || user.length > dbUserMax(yearOf(s.hour))) return fail("webspace.error.dbUserName", { max: String(dbUserMax(yearOf(s.hour))) });
  if (ws.dbUsers[user]) return fail("webspace.error.dbUserTaken");
  if (!password(pass)) return fail("webspace.error.password");
  put(s, workloadId, "dbUsers", user, { name: user, password: pass, grants: {} });
  return { ok: true, id: user };
}

export function deleteDbUser(s: GameState, workloadId: string, user: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.dbUsers[user]) return fail("webspace.error.noDbUser");
  put(s, workloadId, "dbUsers", user, false);
  return { ok: true, id: user };
}

// Sets the user's privileges on the database; an empty list revokes them.
export function grantDb(s: GameState, workloadId: string, user: string, db: string, privileges: string[] = ALL_PRIVILEGES): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const u = ws.dbUsers[user];
  if (!u) return fail("webspace.error.noDbUser");
  if (!ws.databases[db]) return fail("webspace.error.noDatabase");
  const { [db]: _, ...rest } = u.grants;
  put(s, workloadId, "dbUsers", user, { ...u, grants: privileges.length ? { ...rest, [db]: [...privileges] } : rest });
  return { ok: true, id: user };
}

const domainOf = (ws: Webspace, domain: string) => ws.domains[domain] && ws.domains[domain].kind !== "sub" ? domain : null;

export function createMailbox(s: GameState, workloadId: string, local: string, domain: string, pass: string, quotaMb: number): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const address = `${local}@${domain}`;
  if (!LOCAL.test(local) || !ws.domains[domain]) return fail("webspace.error.address");
  if (ws.mailboxes[address]) return fail("webspace.error.mailboxTaken");
  if (!password(pass)) return fail("webspace.error.password");
  if (!Number.isInteger(quotaMb) || quotaMb <= 0) return fail("webspace.error.quota");
  const over = full(ws, "mailboxes", ws.usage.mailboxes);
  if (over) return over;
  put(s, workloadId, "mailboxes", address, { address, password: pass, quotaMb, usedMb: 0 });
  return { ok: true, id: address };
}

export function deleteMailbox(s: GameState, workloadId: string, address: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.mailboxes[address]) return fail("webspace.error.noMailbox");
  put(s, workloadId, "mailboxes", address, false);
  return { ok: true, id: address };
}

export function createForwarder(s: GameState, workloadId: string, local: string, domain: string, to: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const from = `${local}@${domain}`, [toLocal, toDomain] = to.split("@");
  if (!LOCAL.test(local) || !ws.domains[domain] || !LOCAL.test(toLocal ?? "") || !DOMAIN.test(toDomain ?? "")) return fail("webspace.error.address");
  if (ws.forwarders[from]) return fail("webspace.error.forwarderTaken");
  put(s, workloadId, "forwarders", from, { from, to });
  return { ok: true, id: from };
}

export function deleteForwarder(s: GameState, workloadId: string, from: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.forwarders[from]) return fail("webspace.error.noForwarder");
  put(s, workloadId, "forwarders", from, false);
  return { ok: true, id: from };
}

// FTP users are user@domain, as cPanel names them.
export function createFtpAccount(s: GameState, workloadId: string, login: string, domain: string, pass: string, folder: string, quotaMb: number): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const user = `${login}@${domain}`;
  if (!LOCAL.test(login) || !domainOf(ws, domain)) return fail("webspace.error.ftpName");
  if (ws.ftp[user]) return fail("webspace.error.ftpTaken");
  if (!password(pass)) return fail("webspace.error.password");
  if (!folderOk(ws, folder)) return fail("webspace.error.noFolder");
  if (!Number.isInteger(quotaMb) || quotaMb < 0) return fail("webspace.error.quota");
  const over = full(ws, "ftpAccounts", ws.usage.ftpAccounts);
  if (over) return over;
  put(s, workloadId, "ftp", user, { user, password: pass, folder, quotaMb });
  return { ok: true, id: user };
}

export function deleteFtpAccount(s: GameState, workloadId: string, user: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.ftp[user]) return fail("webspace.error.noFtp");
  put(s, workloadId, "ftp", user, false);
  return { ok: true, id: user };
}

// Adds the domain and creates its folder when missing, as real panels do.
function addDomain(s: GameState, ws: Webspace, name: string, kind: DomainKind, folder: string): ActionResult {
  if (ws.domains[name] || s.services.some((v) => !v.endedAt && v.domain === name)) return fail("webspace.error.domainTaken");
  if (!FILE_NAME.test(folder.split("/").pop() ?? "") || !folder.startsWith(`${ws.webroot}/`) || folder.includes("..")) return fail("webspace.error.fileName");
  const parent = folder.slice(0, folder.lastIndexOf("/"));
  if (!folderOk(ws, parent)) return fail("webspace.error.noFolder");
  if (ws.files[folder] && !ws.files[folder].dir) return fail("webspace.error.fileTaken");
  if (!ws.files[folder]) put(s, ws.workloadId, "files", folder, { dir: true, mb: 0, at: s.hour });
  put(s, ws.workloadId, "domains", name, { name, kind, folder, php: ws.domains[ws.domain].php });
  return { ok: true, id: name };
}

export function createAddonDomain(s: GameState, workloadId: string, domain: string, folder?: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!DOMAIN.test(domain)) return fail("webspace.error.domainName");
  const over = full(ws, "addonDomains", ws.usage.addonDomains);
  return over ?? addDomain(s, ws, domain, "addon", folder ?? `${ws.webroot}/${domain}`);
}

export function createSubdomain(s: GameState, workloadId: string, label: string, parent: string, folder?: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!LABEL.test(label) || !domainOf(ws, parent)) return fail("webspace.error.domainName");
  const over = full(ws, "subdomains", ws.usage.subdomains);
  return over ?? addDomain(s, ws, `${label}.${parent}`, "sub", folder ?? `${ws.webroot}/${label}`);
}

// Removes an addon domain, subdomain or alias; its folder stays.
export function deleteDomain(s: GameState, workloadId: string, name: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const d = ws.domains[name];
  if (!d) return fail("webspace.error.noDomain");
  if (d.kind === "main") return fail("webspace.error.mainDomain");
  put(s, workloadId, "domains", name, false);
  return { ok: true, id: name };
}

export function setDomainPhp(s: GameState, workloadId: string, name: string, version: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const d = ws.domains[name], year = yearOf(s.hour);
  if (!d) return fail("webspace.error.noDomain");
  if (year < MULTI_PHP_YEAR) return fail("webspace.error.phpPerDomain");
  if (!PHP.some((p) => p.version === version && p.year <= year)) return fail("webspace.error.phpVersion");
  put(s, workloadId, "domains", name, { ...d, php: version });
  return { ok: true, id: name };
}

export function createCron(s: GameState, workloadId: string, command: string, everyHours: number): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!command.trim() || command.length > 1024) return fail("webspace.error.cronCommand");
  if (!Number.isInteger(everyHours) || everyHours < 1) return fail("webspace.error.cronInterval");
  let n = 1;
  while (ws.cron[`cron${n}`]) n++;
  const id = `cron${n}`;
  put(s, workloadId, "cron", id, { id, command: command.trim(), everyHours });
  return { ok: true, id };
}

export function deleteCron(s: GameState, workloadId: string, id: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.cron[id]) return fail("webspace.error.noCron");
  put(s, workloadId, "cron", id, false);
  return { ok: true, id };
}

const under = (ws: Webspace, p: string) => Object.keys(ws.files).filter((k) => k === p || k.startsWith(`${p}/`));
// The four top folders the panel keeps; the player can work inside them but not remove them.
const fixed = (ws: Webspace, p: string) => [ws.webroot, "logs", "tmp", "mail"].includes(p);

export function createFolder(s: GameState, workloadId: string, parent: string, name: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!FILE_NAME.test(name) || name === "." || name === "..") return fail("webspace.error.fileName");
  if (!folderOk(ws, parent)) return fail("webspace.error.noFolder");
  const path = `${parent}/${name}`;
  if (ws.files[path]) return fail("webspace.error.fileTaken");
  put(s, workloadId, "files", path, { dir: true, mb: 0, at: s.hour });
  return { ok: true, id: path };
}

// Deletes the file or the folder with everything in it.
export function deleteFile(s: GameState, workloadId: string, path: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.files[path]) return fail("webspace.error.noFile");
  if (fixed(ws, path)) return fail("webspace.error.fixedFolder");
  for (const k of under(ws, path)) put(s, workloadId, "files", k, false);
  return { ok: true, id: path };
}

// Renames in place; the new name stays in the same folder.
export function renameFile(s: GameState, workloadId: string, path: string, name: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!ws.files[path]) return fail("webspace.error.noFile");
  if (fixed(ws, path)) return fail("webspace.error.fixedFolder");
  if (!FILE_NAME.test(name) || name === "." || name === "..") return fail("webspace.error.fileName");
  const to = `${path.slice(0, path.lastIndexOf("/"))}/${name}`;
  if (ws.files[to]) return fail("webspace.error.fileTaken");
  for (const k of under(ws, path)) {
    put(s, workloadId, "files", to + k.slice(path.length), { ...ws.files[k], at: s.hour });
    put(s, workloadId, "files", k, false);
  }
  return { ok: true, id: to };
}
