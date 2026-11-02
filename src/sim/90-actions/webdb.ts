// docs/design/web-hosting.md 4.2: phpMyAdmon's changes to a web space's databases, stored in its overlay.
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { applyFunction, DUMP_SHARE, dumpOf, GZIP_SHARE, freshTables, importMaxMb, rowKey, rowOf, SCHEMAS, tablesOf, type SqlFunction } from "../60-infra/webdb";
import type { Webspace } from "../60-infra/webspace";
import type { ActionResult } from "./hardware";
import { archiveNamed } from "../10-catalog/archives";
import { isFail, open, put } from "./webspace-base";

const fail = (error: string, params?: Record<string, string>): ActionResult => ({ ok: false, error, ...(params && { params }) });

function tableIn(s: GameState, ws: Webspace, db: string, table: string) {
  return ws.databases[db] ? tablesOf(s, ws, db).find((x) => x.name === table) ?? null : null;
}

// Writes the typed values into a row, each through its function (MD5 and the like); only the changed columns are stored.
function write(s: GameState, ws: Webspace, db: string, table: string, pk: number, values: Record<string, string>, fns: Record<string, SqlFunction | ""> = {}): ActionResult {
  const t = tableIn(s, ws, db, table);
  if (!t) return fail("webspace.error.noTable", { table });
  const bad = Object.keys(values).find((c) => !t.cols.some((x) => x.name === c));
  if (bad) return fail("webspace.error.noColumn", { column: bad });
  const before = rowOf(s, ws, db, table, pk)?.values ?? {}, key = rowKey(db, table, pk), stored = ws.rows[key]?.values ?? {};
  const next = { ...stored };
  for (const [c, v] of Object.entries(values)) {
    const after = applyFunction(fns[c], v, s.hour);
    if (after !== before[c] || c in stored) next[c] = after;
  }
  put(s, ws.workloadId, "rows", key, { db, table, pk, values: next });
  return { ok: true, id: String(pk) };
}

export function editRow(s: GameState, workloadId: string, db: string, table: string, pk: number, values: Record<string, string>, fns: Record<string, SqlFunction | ""> = {}): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const t = tableIn(s, ws, db, table);
  if (t && (!Number.isInteger(pk) || pk < 1 || pk > t.rows)) return fail("webspace.error.noRow");
  return write(s, ws, db, table, pk, values, fns);
}

// Adds a row after the last one; columns left out get generated values.
export function insertRow(s: GameState, workloadId: string, db: string, table: string, values: Record<string, string>, fns: Record<string, SqlFunction | ""> = {}): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const t = tableIn(s, ws, db, table);
  return write(s, ws, db, table, (t?.rows ?? 0) + 1, values, fns);
}

// An installer creating its tables in an empty database: the schema's fresh rows (shop schemas start with no admin row).
export function createTables(s: GameState, workloadId: string, db: string, schema: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const d = ws.databases[db];
  if (!d) return fail("webspace.error.noDatabase");
  if (!SCHEMAS[schema]) return fail("webspace.error.noTable", { table: schema });
  if (tablesOf(s, ws, db).length) return fail("webspace.error.tablesExist");
  put(s, workloadId, "databases", db, { ...d, schema, ...freshTables(schema, yearOf(s.hour)) });
  return { ok: true, id: db };
}

// phpMyAdmon's Export: a .sql file, or .sql.gz with gzip, in the player's Downloads, named as browsers name a second copy.
export function exportDatabase(s: GameState, workloadId: string, db: string, gzip = false): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const dump = dumpOf(s, ws, db);
  if (!dump) return fail("webspace.error.noDatabase");
  const ext = gzip ? ".sql.gz" : ".sql";
  let name = `${db}${ext}`;
  for (let i = 1; s.media.files.includes(name); i++) name = `${db} (${i})${ext}`;
  s.media.files = [...s.media.files, name];
  s.media.dumps[name] = { mb: +(dump.mb * DUMP_SHARE * (gzip ? GZIP_SHARE : 1)).toFixed(4), at: s.hour, dump };
  return { ok: true, id: name };
}

// phpMyAdmon's Import: replaces the database's tables and rows with the dump's.
export function importDatabase(s: GameState, workloadId: string, db: string, file: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  const f = s.media.dumps[file], d = ws.databases[db];
  if (!d) return fail("webspace.error.noDatabase");
  if (!s.media.files.includes(file)) return fail("webspace.error.noImport");
  const max = importMaxMb(yearOf(s.hour));
  if ((f?.mb ?? archiveNamed(file)?.mb ?? 0) > max) return fail("webspace.error.tooLarge", { max: String(max * 1024) });
  if (!f) return fail("webspace.error.notSql", { file });
  const { schema, tables, mb, src, rows } = f.dump;
  for (const [k, r] of Object.entries(ws.rows)) if (r.db === db) put(s, workloadId, "rows", k, false);
  put(s, workloadId, "databases", db, { name: db, mb, ...(schema && { schema, tables: { ...tables } }), src });
  for (const r of rows) put(s, workloadId, "rows", rowKey(db, r.table, r.pk), { db, table: r.table, pk: r.pk, values: { ...r.values } });
  return { ok: true, id: db };
}
