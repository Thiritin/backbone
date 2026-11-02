import { describe, expect, it } from "vitest";
import { md5 } from "../src/sim/00-core/md5";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { ADMIN_TABLE, parseSql, rowOf, rowsOf, tablesOf } from "../src/sim/60-infra/webdb";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { mysqlVcpu, workloadUse } from "../src/sim/60-infra/usage";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { serverOf } from "../src/sim/60-infra/cluster";
import { coreSpeed } from "../src/sim/60-infra/status";
import * as db from "../src/sim/90-actions/webdb";
import * as web from "../src/sim/90-actions/webspace";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

// A WordPass account on a cPanic server, sold in 2010 and read two months later.
function account(seed = 1) {
  const s = withServer(newGame(seed));
  skipTo(s, 2010);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2010), mailboxes: 3, app: "wordpass" }, clusterId: host }));
  s.hour += 60 * 24;
  const w = s.workloads.find((x) => x.serviceId === svc)!;
  const ws = webspaceOf(s, w.id)!;
  return { s, id: w.id, w, ws, wp: ws.app!.db };
}

describe("phpMyAdmon tables", () => {
  it("derives the app's tables from the seed, growing with the site's age", () => {
    const a = account(), b = account();
    const tables = tablesOf(a.s, a.ws, a.wp);
    expect(tables).toEqual(tablesOf(b.s, b.ws, b.wp));
    expect(tables.map((x) => x.name)).toContain("wp_posts");
    expect(tables.every((x) => x.name.startsWith("wp_"))).toBe(true);
    expect(tables.find((x) => x.name === "wp_users")!.rows).toBeGreaterThanOrEqual(1);
    expect(tables.reduce((s, x) => s + x.mb, 0)).toBeCloseTo(a.ws.databases[a.wp].mb, 2);
    expect(rowsOf(a.s, a.ws, a.wp, "wp_users", 0, 1)[0].values.user_login).toBe("admin");
    const posts = tables.find((x) => x.name === "wp_posts")!.rows;
    a.s.hour += 2 * 365 * 24;
    const later = webspaceOf(a.s, a.id)!;
    expect(tablesOf(a.s, later, a.wp).find((x) => x.name === "wp_posts")!.rows).toBeGreaterThan(posts);
  });

  it("an empty database the player created has no tables", () => {
    const { s, id, ws } = account();
    const name = ok(web.createDatabase(s, id, "shop"));
    expect(tablesOf(s, webspaceOf(s, id)!, name)).toEqual([]);
    expect(ws.databases[name]).toBeUndefined();
  });
});

describe("editing rows", () => {
  it("stores only the changed column, through the MD5 function, and survives a save", () => {
    const { s, id, wp } = account();
    const before = rowOf(s, webspaceOf(s, id)!, wp, "wp_users", 1)!;
    ok(db.editRow(s, id, wp, "wp_users", 1, { user_login: "admin", user_pass: "geheim123" }, { user_pass: "MD5" }));
    expect(s.webspaces[id].rows).toEqual({ [`${wp}.wp_users.1`]: { db: wp, table: "wp_users", pk: 1, values: { user_pass: md5("geheim123") } } });
    const loaded = deserialize(serialize(s));
    const after = rowOf(loaded, webspaceOf(loaded, id)!, wp, "wp_users", 1)!;
    expect(after.values).toEqual({ ...before.values, user_pass: md5("geheim123") });
    expect(md5("password")).toBe("5f4dcc3b5aa765d61d8327deb882cf99");
  });

  it("refuses unknown tables, columns and rows", () => {
    const { s, id, wp } = account();
    expect(err(db.editRow(s, id, wp, "wp_nope", 1, {}))).toBe("webspace.error.noTable");
    expect(err(db.editRow(s, id, wp, "wp_users", 1, { nope: "x" }))).toBe("webspace.error.noColumn");
    expect(err(db.editRow(s, id, wp, "wp_users", 99999, { user_login: "x" }))).toBe("webspace.error.noRow");
  });

  it("parses the SQL box's SELECT and UPDATE with MD5", () => {
    expect(parseSql("UPDATE `tbladmins` SET `password` = MD5('neu'), firstname='Max' WHERE `id` = 1;")).toEqual({
      kind: "update", table: "tbladmins", set: { password: "neu", firstname: "Max" }, fns: { password: "MD5" }, where: ["id", "1"],
    });
    expect(parseSql("SELECT * FROM wp_posts LIMIT 10, 5")).toEqual({ kind: "select", table: "wp_posts", offset: 10, limit: 5 });
    expect(parseSql("DROP TABLE wp_posts").kind).toBe("error");
  });

  it("deleting the database drops its edited rows", () => {
    const { s, id, wp } = account();
    ok(db.editRow(s, id, wp, "wp_users", 1, { user_login: "boss" }));
    ok(web.deleteDatabase(s, id, wp));
    expect(s.webspaces[id].rows).toBeUndefined();
  });
});

describe("a shop's admin table", () => {
  it("an installer creates the tables and the admin row, whose password resets with MD5", () => {
    const { s, id } = account();
    const name = ok(web.createDatabase(s, id, "whmc"));
    ok(db.createTables(s, id, name, "whmCache"));
    expect(err(db.createTables(s, id, name, "whmCache"))).toBe("webspace.error.tablesExist");
    const { table, user, pass } = ADMIN_TABLE.whmCache;
    expect(table).toBe("tbladmins");
    expect(tablesOf(s, webspaceOf(s, id)!, name).find((x) => x.name === table)!.rows).toBe(0);
    const pk = ok(db.insertRow(s, id, name, table, { [user]: "chef", [pass]: "erste" }, { [pass]: "MD5" }));
    expect(pk).toBe("1");
    const sql = parseSql(`UPDATE ${table} SET ${pass} = MD5('zweite') WHERE id = 1`);
    if (sql.kind !== "update") throw new Error(sql.kind);
    ok(db.editRow(s, id, name, table, 1, sql.set, sql.fns));
    const row = rowOf(s, webspaceOf(s, id)!, name, table, 1)!;
    expect(row.values[user]).toBe("chef");
    expect(row.values[pass]).toBe(md5("zweite"));
  });
});

describe("export and import", () => {
  it("exports a .sql into Downloads and imports it into another database with the same tables and rows", () => {
    const { s, id, wp, ws: was } = account();
    ok(db.editRow(s, id, wp, "wp_users", 1, { user_email: "chef@sockenshop.de" }));
    expect(ok(db.exportDatabase(s, id, wp))).toBe(`${wp}.sql`);
    expect(ok(db.exportDatabase(s, id, wp, true))).toBe(`${wp}.sql.gz`);
    expect(ok(db.exportDatabase(s, id, wp, true))).toBe(`${wp} (1).sql.gz`);
    const copy = ok(web.createDatabase(s, id, "copy"));
    expect(err(db.importDatabase(s, id, copy, "nope.sql"))).toBe("webspace.error.noImport");
    expect(s.media.dumps[`${wp}.sql`].mb).toBeGreaterThan(50);
    expect(err(db.importDatabase(s, id, copy, `${wp}.sql`))).toBe("webspace.error.tooLarge");
    ok(db.importDatabase(s, id, copy, `${wp}.sql.gz`));
    const ws = webspaceOf(s, id)!;
    expect(tablesOf(s, ws, copy).map((x) => [x.name, x.rows])).toEqual(tablesOf(s, ws, wp).map((x) => [x.name, x.rows]));
    expect(rowsOf(s, ws, copy, "wp_users")).toEqual(rowsOf(s, ws, wp, "wp_users"));
    expect(rowOf(s, ws, copy, "wp_users", 1)!.values.user_email).toBe("chef@sockenshop.de");
    expect(ws.usage.diskMb).toBeGreaterThan(was.usage.diskMb);
    const loaded = deserialize(serialize(s));
    expect(loaded.media.files).toEqual([`${wp}.sql`, `${wp}.sql.gz`, `${wp} (1).sql.gz`]);
  });

  it("refuses a file over the upload limit and one that is not a dump", () => {
    const { s, id, wp } = account();
    s.media.files.push("big.sql", "photo.zip");
    s.media.dumps["big.sql"] = { mb: 51, at: s.hour, dump: { db: "x", schema: "", tables: {}, mb: 51, src: "x", rows: [] } };
    expect(err(db.importDatabase(s, id, wp, "big.sql"))).toBe("webspace.error.tooLarge");
    expect(err(db.importDatabase(s, id, wp, "photo.zip"))).toBe("webspace.error.notSql");
  });

  it("an imported database adds MySQL load to the host", () => {
    const { s, id, w, wp } = account();
    const before = workloadUse(s, w).vcpu;
    ok(db.exportDatabase(s, id, wp, true));
    const copy = ok(web.createDatabase(s, id, "copy"));
    ok(db.importDatabase(s, id, copy, `${wp}.sql.gz`));
    expect(mysqlVcpu(s, w)).toBeGreaterThan(0);
    // The 2005 basement server is slow by 2010, so MySQL takes more of its time than its own vCPU share.
    const node = s.devices.find((d) => d.id === serverOf(s, w))!;
    expect(workloadUse(s, w).vcpu).toBeCloseTo(Math.min(w.vcpu, before + mysqlVcpu(s, w) / coreSpeed(node, s.hour)), 6);
  });

  it("old saves without database dumps load with none", () => {
    const { s } = account();
    const data = JSON.parse(serialize(s));
    delete data.media.dumps;
    expect(deserialize(JSON.stringify(data)).media.dumps).toEqual({});
  });
});
