import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { GameState } from "../src/sim/50-state";
import { appState, deriveWebspace, webspaceOf, WEB_LIMITS } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addPackage } from "../src/sim/90-actions/packages";
import * as web from "../src/sim/90-actions/webspace";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

// A WordPass account on a cPanic server, sold in 2010 and read two months later.
function account(seed = 1, app: "wordpass" | "static" = "wordpass") {
  const s = withServer(newGame(seed));
  skipTo(s, 2010);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2010), mailboxes: 3, app }, clusterId: host }));
  s.hour += 60 * 24;
  const w = s.workloads.find((x) => x.serviceId === svc)!;
  return { s, host, id: w.id };
}
const ws = (s: GameState, id: string) => webspaceOf(s, id)!;

describe("web space derivation", () => {
  it("derives the same contents from the same game and stores nothing", () => {
    const a = account(), b = account();
    expect(ws(a.s, a.id)).toEqual(ws(b.s, b.id));
    expect(a.s.webspaces).toEqual({});
    const x = ws(a.s, a.id);
    expect(x.panel).toBe("cpanic");
    expect(x.files["public_html/wp-config.php"]).toBeDefined();
    expect(Object.keys(x.mailboxes)).toHaveLength(3);
    expect(x.app?.db).toBe(`${x.prefix}wp`);
    expect(x.dbUsers[x.app!.db].grants[x.app!.db]).toEqual(["ALL PRIVILEGES"]);
    expect(Object.values(x.domains)).toEqual([expect.objectContaining({ kind: "main", folder: "public_html" })]);
    expect(Object.keys(x.cron)).toHaveLength(1);
    expect(appState(x)).toBe("installed");
    expect(x.usage.diskMb).toBeGreaterThan(0);
    expect(x.limits).toEqual({ ...WEB_LIMITS, mailboxes: 3 });
  });

  it("gives a static site no database and only the main folders on a non-panel workload", () => {
    const { s, id } = account(1, "static");
    expect(ws(s, id).databases).toEqual({});
    expect(appState(ws(s, id))).toBe("none");
    expect(webspaceOf(s, "nope")).toBeNull();
  });

  it("takes the counts from the account's package", () => {
    const { s, host, id } = account();
    ok(addPackage(s, host, { name: "Tiny", product: "webHosting", spec: sizeSpec("webHosting", 0, 2010), databases: 1, subdomains: 0 }));
    s.services.find((v) => v.id === s.workloads.find((w) => w.id === id)!.serviceId)!.pkg = "Tiny";
    expect(ws(s, id).limits).toMatchObject({ databases: 1, subdomains: 0, ftpAccounts: WEB_LIMITS.ftpAccounts });
    expect(err(addPackage(s, host, { name: "Bad", product: "webHosting", spec: sizeSpec("webHosting", 0, 2010), databases: -1 }))).toBe("error.packageSpec");
  });
});

describe("web space overlay", () => {
  it("merges the player's changes over the derived contents", () => {
    const { s, id } = account();
    ok(web.createFolder(s, id, "public_html", "blog"));
    ok(web.deleteFile(s, id, "public_html/wp-config.php"));
    const x = ws(s, id);
    expect(x.files["public_html/blog"]?.dir).toBe(true);
    expect(x.files["public_html/wp-config.php"]).toBeUndefined();
    expect(s.webspaces[id].files).toEqual({ "public_html/blog": expect.anything(), "public_html/wp-config.php": false });
    expect(deriveWebspace(s, id)!.files["public_html/wp-config.php"]).toBeDefined();
  });

  it("breaks the app without its config file or database", () => {
    const { s, id } = account();
    ok(web.renameFile(s, id, "public_html/wp-config.php", "wp-config.bak"));
    expect(appState(ws(s, id))).toBe("broken");
    ok(web.renameFile(s, id, "public_html/wp-config.bak", "wp-config.php"));
    expect(appState(ws(s, id))).toBe("installed");
    ok(web.deleteDatabase(s, id, ws(s, id).app!.db));
    expect(appState(ws(s, id))).toBe("broken");
  });

  it("drops a stored entry when the player removes what they created", () => {
    const { s, id } = account();
    ok(web.createFolder(s, id, "public_html", "tmp2"));
    ok(web.deleteFile(s, id, "public_html/tmp2"));
    expect(s.webspaces).toEqual({});
  });

  it("loads an old save without web spaces", () => {
    const { s, id } = account();
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw.webspaces;
    const back = deserialize(JSON.stringify(raw));
    expect(back.webspaces).toEqual({});
    ok(web.createFolder(back, id, "public_html", "shop"));
    expect(deserialize(serialize(back)).webspaces[id].files?.["public_html/shop"]).toBeDefined();
  });
});

describe("web space actions", () => {
  it("creates databases and users with the account prefix and grants privileges", () => {
    const { s, id } = account();
    const p = ws(s, id).prefix;
    expect(ok(web.createDatabase(s, id, "shop"))).toBe(`${p}shop`);
    expect(err(web.createDatabase(s, id, "shop"))).toBe("webspace.error.dbTaken");
    expect(err(web.createDatabase(s, id, "Bad-Name"))).toBe("webspace.error.dbName");
    expect(ok(web.createDbUser(s, id, "shop", "s3cret!"))).toBe(`${p}shop`);
    expect(err(web.createDbUser(s, id, "averyveryverylongname", "s3cret!"))).toBe("webspace.error.dbUserName");
    expect(err(web.createDbUser(s, id, "x", "abc"))).toBe("webspace.error.password");
    ok(web.grantDb(s, id, `${p}shop`, `${p}shop`));
    expect(ws(s, id).dbUsers[`${p}shop`].grants).toEqual({ [`${p}shop`]: ["ALL PRIVILEGES"] });
    ok(web.grantDb(s, id, `${p}shop`, `${p}shop`, []));
    expect(ws(s, id).dbUsers[`${p}shop`].grants).toEqual({});
    ok(web.grantDb(s, id, `${p}shop`, `${p}shop`));
    ok(web.deleteDatabase(s, id, `${p}shop`));
    expect(ws(s, id).dbUsers[`${p}shop`].grants).toEqual({});
    ok(web.deleteDbUser(s, id, `${p}shop`));
    expect(err(web.deleteDbUser(s, id, `${p}shop`))).toBe("webspace.error.noDbUser");
  });

  it("refuses a database past the package limit", () => {
    const { s, id } = account();
    for (let i = 1; i < WEB_LIMITS.databases; i++) ok(web.createDatabase(s, id, `db${i}`));
    expect(web.createDatabase(s, id, "onemore")).toEqual({ ok: false, error: "webspace.error.limit.databases", params: { max: String(WEB_LIMITS.databases) } });
  });

  it("creates mailboxes and forwarders and refuses past the mailbox count", () => {
    const { s, id } = account();
    expect(err(web.createMailbox(s, id, "sales", "sockenshop.de", "s3cret!", 250))).toBe("webspace.error.limit.mailboxes");
    ok(web.deleteMailbox(s, id, "user2@sockenshop.de"));
    expect(ok(web.createMailbox(s, id, "sales", "sockenshop.de", "s3cret!", 250))).toBe("sales@sockenshop.de");
    expect(err(web.createMailbox(s, id, "x", "other.de", "s3cret!", 250))).toBe("webspace.error.address");
    ok(web.createForwarder(s, id, "shop", "sockenshop.de", "owner@example.com"));
    expect(ws(s, id).forwarders["shop@sockenshop.de"].to).toBe("owner@example.com");
    ok(web.deleteForwarder(s, id, "shop@sockenshop.de"));
    expect(ws(s, id).usage.forwarders).toBe(0);
  });

  it("creates FTP accounts in an existing folder up to the limit", () => {
    const { s, id } = account();
    expect(err(web.createFtpAccount(s, id, "dev", "sockenshop.de", "s3cret!", "public_html/none", 0))).toBe("webspace.error.noFolder");
    for (let i = 0; i < WEB_LIMITS.ftpAccounts; i++) ok(web.createFtpAccount(s, id, `dev${i}`, "sockenshop.de", "s3cret!", "public_html", 0));
    expect(err(web.createFtpAccount(s, id, "dev9", "sockenshop.de", "s3cret!", "public_html", 0))).toBe("webspace.error.limit.ftpAccounts");
    ok(web.deleteFtpAccount(s, id, "dev0@sockenshop.de"));
    expect(ws(s, id).usage.ftpAccounts).toBe(WEB_LIMITS.ftpAccounts - 1);
  });

  it("adds addon domains and subdomains with their folders and refuses past the limits", () => {
    const { s, id } = account();
    ok(web.createAddonDomain(s, id, "socken-outlet.de"));
    expect(ws(s, id).files["public_html/socken-outlet.de"]?.dir).toBe(true);
    expect(err(web.createAddonDomain(s, id, "third.de"))).toBe("webspace.error.limit.addonDomains");
    expect(ok(web.createSubdomain(s, id, "portal", "sockenshop.de"))).toBe("portal.sockenshop.de");
    expect(ws(s, id).domains["portal.sockenshop.de"]).toMatchObject({ kind: "sub", folder: "public_html/portal" });
    expect(err(web.createSubdomain(s, id, "portal", "sockenshop.de"))).toBe("webspace.error.domainTaken");
    expect(err(web.deleteDomain(s, id, "sockenshop.de"))).toBe("webspace.error.mainDomain");
    ok(web.deleteDomain(s, id, "portal.sockenshop.de"));
    expect(ws(s, id).files["public_html/portal"]).toBeDefined();
    expect(ws(s, id).usage).toMatchObject({ addonDomains: 1, subdomains: 0 });
  });

  it("refuses a subdomain when the package allows none", () => {
    const { s, host, id } = account();
    ok(addPackage(s, host, { name: "Tiny", product: "webHosting", spec: sizeSpec("webHosting", 0, 2010), subdomains: 0 }));
    s.services.find((v) => v.id === s.workloads.find((w) => w.id === id)!.serviceId)!.pkg = "Tiny";
    expect(err(web.createSubdomain(s, id, "portal", "sockenshop.de"))).toBe("webspace.error.limit.subdomains");
  });

  it("sets a domain's PHP version once MultiPHP exists", () => {
    const { s, id } = account();
    expect(err(web.setDomainPhp(s, id, "sockenshop.de", "5.2"))).toBe("webspace.error.phpPerDomain");
    s.hour = hourOf(new Date(Date.UTC(2016, 0, 1)));
    expect(err(web.setDomainPhp(s, id, "sockenshop.de", "8.0"))).toBe("webspace.error.phpVersion");
    ok(web.setDomainPhp(s, id, "sockenshop.de", "5.6"));
    expect(ws(s, id).domains["sockenshop.de"].php).toBe("5.6");
  });

  it("adds and removes cron jobs", () => {
    const { s, id } = account();
    expect(err(web.createCron(s, id, "php run.php", 0))).toBe("webspace.error.cronInterval");
    expect(ok(web.createCron(s, id, "php run.php", 6))).toBe("cron2");
    ok(web.deleteCron(s, id, "cron1"));
    expect(Object.keys(ws(s, id).cron)).toEqual(["cron2"]);
    expect(s.webspaces[id].cron).toEqual({ cron1: false, cron2: expect.anything() });
  });

  it("renames and deletes folders with their contents and keeps the account folders", () => {
    const { s, id } = account();
    ok(web.createFolder(s, id, "public_html", "old"));
    ok(web.createFolder(s, id, "public_html/old", "img"));
    expect(ok(web.renameFile(s, id, "public_html/old", "new"))).toBe("public_html/new");
    expect(Object.keys(ws(s, id).files).filter((k) => k.startsWith("public_html/new"))).toEqual(["public_html/new", "public_html/new/img"]);
    expect(err(web.renameFile(s, id, "public_html/new", "wp-admin"))).toBe("webspace.error.fileTaken");
    expect(err(web.deleteFile(s, id, "public_html"))).toBe("webspace.error.fixedFolder");
    ok(web.deleteFile(s, id, "public_html/new"));
    expect(ws(s, id).files["public_html/new/img"]).toBeUndefined();
    expect(err(web.createFolder(s, id, "public_html/missing", "x"))).toBe("webspace.error.noFolder");
  });
});
