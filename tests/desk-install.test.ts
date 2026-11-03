import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DESKS, deskHas, deskOf, seats } from "../src/sim/10-catalog/desks";
import { deskItem, monthlyCharge, storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { createTicket } from "../src/sim/40-support/tickets";
import type { Employee } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { accountsOn } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { removeDesk, subscribeDesk } from "../src/sim/90-actions/desk-install";
import { deskArchive, type SelfDeskId } from "../src/sim/10-catalog/archives";
import { versionAt } from "../src/sim/10-catalog/software-versions";
import { companyDomain } from "../src/sim/30-customers/domains";
import { deskStatus, newDeskAi } from "../src/sim/40-support/desk";
import { deskBroken, deskSpace, deskWarnings } from "../src/sim/60-infra/desk-files";
import { phpNeeded } from "../src/sim/60-infra/shop-files";
import { findRows } from "../src/sim/60-infra/webdb";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { appInstallerDesks, deskLogin, installDeskApp, requestDeskReset, resetDeskPassword, runDeskInstaller, type DeskInstallForm } from "../src/sim/90-actions/desk-setup";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { downloadArchive } from "../src/sim/90-actions/media";
import { createDatabase, createDbUser, createFolder, createOwnWebspace, createSubdomain, deleteFile, grantDb, renameFile } from "../src/sim/90-actions/webspace";
import { chmodFile, extractFile, uploadFile } from "../src/sim/90-actions/webspace-files";
import { editRow } from "../src/sim/90-actions/webdb";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { DESK_ADMIN, handDesk, readyGame, registered, newGame, mailsAbout } from "./fixtures";

const at = (y: number, m = 1) => hourOf(new Date(Date.UTC(y, m - 1, 1)));
// Skips to the last hour before a month start and ticks through it, where the monthly bills go out.
const runTo = (s: GameState, hour: number) => { s.hour = hour - 1; tick(s); };
const year = (y: number): GameState => registered({ ...newGame(1), hour: at(y), cash: 1_000_000 });
const hosted = (y: number): GameState => { const s = readyGame(5); s.hour = at(y); s.cash = 1_000_000; return s; };
const panelOf = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!;
const agent = (n: number, role: Employee["role"] = "support"): Employee => ({
  id: `emp${n}`, name: `Agent ${n}`, role, skill: 1, talent: 1, salary: 0, hiredAt: 0, assignment: "queue", location: null,
  trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, team: "office", worked: 0, desk: null,
});
const deskBills = (s: GameState) => s.ledger.filter((e) => e.key === "ledger.subscriptionSeats");

describe("desk install and subscribe", () => {
  it("sells desks on their own sites, not in the Pear Store", () => {
    expect(DESKS.map((d) => [d.id, d.from, d.monthly])).toEqual([["ostickit", 2005, 0], ["zendusk", 2007, 49], ["freshdusk", 2011, 15], ["freescoot", 2018, 0]]);
    for (const d of DESKS) expect(storeItem(d.id)).toBeUndefined();
    const s = year(2011);
    expect(resolve(s, "www.zendusk.com").page).toEqual({ kind: "deskVendor", id: "zendusk" });
    expect(resolve(s, "freshdusk.com").page).toEqual({ kind: "deskVendor", id: "freshdusk" });
    expect(resolve(s, "ostickit.com").page).toEqual({ kind: "deskVendor", id: "ostickit" });
    expect(resolve(s, "freescoot.net").page).toEqual({ kind: "notfound" });
  });

  it("bills the owner and every support employee, the first month at once", () => {
    const s = year(2007);
    s.staff = [agent(1), agent(2), agent(3, "bookkeeper")];
    expect(seats(s)).toBe(3);
    const cash = s.cash, item = deskItem(DESKS[1]), price = subscriptionPrice(item, 2007);
    expect(price).toBeCloseTo(49 * 1.08 ** 2, 2);
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: true });
    expect(s.cash).toBeCloseTo(cash - price * 3, 2);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.subscriptionSeats", params: { name: "Zendusk", seats: 3 }, amount: -monthlyCharge(s, item) });
    expect(s.desk).toMatchObject({ id: "zendusk", hosting: { kind: "hosted" }, tenant: "pxl" });

    s.staff = [agent(1), agent(2)];
    runTo(s, at(2007, 2));
    expect(deskBills(s)).toHaveLength(2);
    expect(deskBills(s)[1]).toMatchObject({ params: { seats: 3 }, amount: -price * 3 });
    removeDesk(s);
    runTo(s, at(2007, 3));
    expect(deskBills(s)).toHaveLength(2);
  });

  it("mails the agent address on sign-up", () => {
    const s = year(2011);
    subscribeDesk(s, "pxl", "freshdusk");
    expect(mailsAbout(s, "deskWelcome").at(-1)).toMatchObject({ from: "n:Freshdusk", p: { url: "pxl.freshdusk.com/helpdesk", address: "support@pxl.freshdusk.com" } });
  });

  it("refuses a desk before its year, without cash, with a bad tenant or twice", () => {
    const s = year(2008);
    expect(subscribeDesk(s, "pxl", "freshdusk")).toEqual({ ok: false, error: "error.deskNotYet" });
    expect(subscribeDesk(s, "pxl", "ostickit")).toEqual({ ok: false, error: "error.unknownDesk" });
    expect(subscribeDesk(s, "-pxl", "zendusk")).toEqual({ ok: false, error: "error.deskTenant" });
    expect(subscribeDesk(s, "p x l", "zendusk")).toEqual({ ok: false, error: "error.deskTenant" });
    s.cash = 10;
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.desk).toBeNull();
    s.cash = 1000;
    expect(subscribeDesk(s, " PXL ", "zendusk")).toEqual({ ok: true });
    expect(s.desk?.tenant).toBe("pxl");
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: false, error: "error.deskInUse" });
    expect(removeDesk(s)).toEqual({ ok: true });
    expect(removeDesk(s)).toEqual({ ok: false, error: "error.noDesk" });
  });

  it("installs a self-hosted desk by hand into an own web space, free and counted against the panel licence", () => {
    const s = hosted(2014), c = panelOf(s), cash = s.cash, before = accountsOn(s, c);
    const { ws, folder, db } = handDesk(s, c.id, "ostickit");
    expect(s.desk?.hosting).toEqual({ kind: "self", clusterId: c.id, version: "1.7", ws, folder, db });
    expect(accountsOn(s, c)).toBe(before + 1);
    expect(s.cash).toBe(cash);
    runTo(s, at(2014, 2));
    expect(deskBills(s)).toHaveLength(0);
  });

  it("has the features of the installed release", () => {
    const s = hosted(2014), c = panelOf(s);
    handDesk(s, c.id, "ostickit");
    expect([deskHas(s, "slaTimers"), deskHas(s, "customerSidebar")]).toEqual([true, false]);
    s.hour = at(2020);
    expect([deskHas(s, "customerSidebar"), deskHas(s, "merge")]).toEqual([false, false]);
    removeDesk(s);
    s.desk = null;
    const t = hosted(2020);
    handDesk(t, panelOf(t).id, "ostickit");
    expect([deskHas(t, "customerSidebar"), deskHas(t, "merge")]).toEqual([true, true]);
  });

  it("keeps one desk at a time; switching drops the configuration and keeps the tickets", () => {
    const s = hosted(2019), c = panelOf(s);
    const id = addCustomer(s, "Customer", "private");
    createTicket(s, s.customers.find((x) => x.id === id)!, "howTo");
    const tickets = s.tickets.length;
    subscribeDesk(s, "pxl", "zendusk");
    s.desk!.rules = [{ when: "howTo", set: { priority: "low" } }];
    handDesk(s, c.id, "freescoot");
    expect(deskOf(s)?.id).toBe("freescoot");
    expect(s.desk!.rules).toEqual([]);
    expect(s.mail.channels.map((x) => x.desk)).toEqual(["freescoot"]);
    expect(s.tickets).toHaveLength(tickets);
    expect(s.tickets.filter((t) => t.kind === "howTo").every((t) => t.channelId === s.mail.channels[0].id)).toBe(true);
    runTo(s, at(2019, 2));
    expect(deskBills(s)).toHaveLength(1);
  });
});

// docs/design/web-hosting.md 5.1: the desk's archive, its web installer, the staff login and its reset.
describe("installing a self-hosted desk by hand", () => {
  const err = (r: ActionResult): string | null => (r.ok ? null : r.error);
  const ok = (r: ActionResult) => expect(err(r)).toBeNull();
  const idOf = (r: ActionResult): string => (r.ok ? r.id! : "");
  // The archive extracted under support.<domain>, whose folder is the archive's web root, and a database with a user.
  const prepared = (y: number, id: SelfDeskId) => {
    const s = hosted(y), c = panelOf(s), domain = companyDomain(s), version = versionAt(id, s.hour).version, zip = deskArchive(id, version).name;
    c.php = phpNeeded(id, version);
    const ws = idOf(createOwnWebspace(s, c.id)), dir = "public_html/support", root = `${dir}/${id === "ostickit" ? "upload" : "public"}`;
    ok(downloadArchive(s, zip));
    ok(createFolder(s, ws, "public_html", "support"));
    ok(uploadFile(s, ws, dir, zip));
    ok(extractFile(s, ws, `${dir}/${zip}`));
    ok(createSubdomain(s, ws, "support", domain, root));
    const db = idOf(createDatabase(s, ws, "desk")), user = idOf(createDbUser(s, ws, "desk", "dbpass1"));
    ok(grantDb(s, ws, user, db));
    const form: DeskInstallForm = { ...DESK_ADMIN, helpdesk: "Pixel Support", deskEmail: `support@${domain}`, dbHost: "localhost", dbName: db, dbUser: user, dbPass: "dbpass1" };
    return { s, c, ws, root, form, domain, zip, version };
  };

  it("ships OsTickit as the real archive with upload/, setup/ and the sample config", () => {
    expect(deskArchive("ostickit", "1.7").entries.map(([p]) => p)).toEqual(expect.arrayContaining(["upload/setup/", "upload/scp/", "upload/include/ost-sampleconfig.php", "scripts/"]));
    expect(deskArchive("ostickit", "1.6").entries.map(([p]) => p)).toContain("upload/include/ost-config.sample.php");
    expect(deskArchive("freescoot", "1.8").entries.map(([p]) => p)).toEqual(expect.arrayContaining(["public/index.php", ".env.example", "vendor/"]));
    expect(deskArchive("ostickit", "1.7").name).toBe("osTickit-v1.7.zip");
  });

  it("runs OsTickit's installer with its config, database and admin checks, then warns until setup/ is gone and the config is read-only", () => {
    const { s, ws, root, form, domain } = prepared(2014, "ostickit");
    expect(resolve(s, `support.${domain}/setup/`).page).toMatchObject({ kind: "deskSetup", screen: "installer", id: "ostickit", version: "1.7" });
    expect(resolve(s, `support.${domain}/scp/`).page).toMatchObject({ kind: "deskSetup", screen: "installer" });
    expect(runDeskInstaller(s, ws, root, form)).toEqual({ ok: false, error: "desk-setup.ost.configMissing", params: { sample: "include/ost-sampleconfig.php" } });
    ok(renameFile(s, ws, `${root}/include/ost-sampleconfig.php`, "ost-config.php"));
    expect(err(runDeskInstaller(s, ws, root, form))).toBe("desk-setup.ost.configLocked");
    ok(chmodFile(s, ws, `${root}/include/ost-config.php`, "0666"));
    expect(runDeskInstaller(s, ws, root, { ...form, dbPass: "wrong" })).toEqual({ ok: false, error: "shop-setup.db.denied", params: { user: form.dbUser, yes: "YES" } });
    expect(err(runDeskInstaller(s, ws, root, { ...form, dbHost: "db.example.com" }))).toBe("shop-setup.db.host");
    expect(err(runDeskInstaller(s, ws, root, { ...form, helpdesk: " " }))).toBe("desk-setup.error.helpdesk");
    expect(err(runDeskInstaller(s, ws, root, { ...form, pass: "abc" }))).toBe("shop-setup.error.passShort");
    expect(s.desk).toBeNull();
    ok(runDeskInstaller(s, ws, root, form));
    expect(s.desk?.id).toBe("ostickit");
    expect(err(runDeskInstaller(s, ws, root, form))).toBe("desk-setup.error.installed");
    expect(deskWarnings(s)).toEqual(["setupDir", "configWritable"]);
    expect(resolve(s, `support.${domain}/scp/`).page).toEqual({ kind: "desk", id: "ostickit" });
    ok(deleteFile(s, ws, `${root}/setup`));
    ok(chmodFile(s, ws, `${root}/include/ost-config.php`, "0644"));
    expect(deskWarnings(s)).toEqual([]);
    expect(deskStatus(s)).not.toBe("down");
    ok(deleteFile(s, ws, `${root}/include/ost-config.php`));
    expect(deskStatus(s)).toBe("down");
    expect(resolve(s, `support.${domain}/scp/`).page).toMatchObject({ kind: "deskSetup", screen: "dbError" });
  });

  it("logs staff in with the chosen account, resets by mail and takes an MD5 from phpMyAdmon once", () => {
    const s = hosted(2014), { ws, db } = handDesk(s, panelOf(s).id, "ostickit");
    ok(deskLogin(s, "ada", DESK_ADMIN.pass));
    ok(deskLogin(s, DESK_ADMIN.email, DESK_ADMIN.pass));
    expect(err(deskLogin(s, "ada", "wrong"))).toBe("desk-setup.login.ostickit");
    ok(requestDeskReset(s, "nobody@example.com"));
    expect(mailsAbout(s, "deskReset")).toEqual([]);
    ok(requestDeskReset(s, "ada"));
    const url = String(mailsAbout(s, "deskReset")[0].p!.url), token = new URLSearchParams(url.split("?")[1]).get("token")!;
    expect(url.startsWith(`support.${companyDomain(s)}/scp/pwreset.php?token=`)).toBe(true);
    expect(err(resetDeskPassword(s, "nope", "newpass1"))).toBe("desk-setup.reset.expired");
    ok(resetDeskPassword(s, token, "newpass1"));
    ok(deskLogin(s, "ada", "newpass1"));
    expect(err(resetDeskPassword(s, token, "again123"))).toBe("desk-setup.reset.expired");
    const pk = findRows(s, webspaceOf(s, ws)!, db, "ost_staff", "username", "ada")[0].pk;
    ok(editRow(s, ws, db, "ost_staff", pk, { passwd: "fromsql" }, { passwd: "MD5" }));
    ok(deskLogin(s, "ada", "fromsql"));
    expect(findRows(s, webspaceOf(s, ws)!, db, "ost_staff", "username", "ada")[0].values.passwd.startsWith("$2y$10$")).toBe(true);
    ok(deskLogin(s, "ada", "fromsql"));
  });

  it("runs FreeScoot's installer at /install and logs in with the e-mail address; an MD5 does not let anyone in", () => {
    const { s, ws, root, form, domain } = prepared(2019, "freescoot");
    expect(resolve(s, `support.${domain}/install`).page).toMatchObject({ kind: "deskSetup", screen: "installer", id: "freescoot" });
    expect(resolve(s, `support.${domain}/`).page).toMatchObject({ kind: "deskSetup", screen: "notInstalled" });
    ok(runDeskInstaller(s, ws, root, form));
    expect(webspaceOf(s, ws)!.files["public_html/support/.env"]).toBeTruthy();
    expect(resolve(s, `support.${domain}/login`).page).toEqual({ kind: "desk", id: "freescoot" });
    ok(deskLogin(s, DESK_ADMIN.email, DESK_ADMIN.pass));
    expect(err(deskLogin(s, "ada", DESK_ADMIN.pass))).toBe("desk-setup.login.freescoot");
    const at = deskSpace(s)!, pk = findRows(s, at.ws, at.db, "users", "email", DESK_ADMIN.email)[0].pk;
    ok(editRow(s, ws, at.db, "users", pk, { password: "fromsql" }, { password: "MD5" }));
    expect(err(deskLogin(s, DESK_ADMIN.email, "fromsql"))).toBe("desk-setup.login.freescoot");
  });

  it("answers in a folder below the domain, such as /upload/ of the support subdomain", () => {
    const s = hosted(2014), c = panelOf(s), domain = companyDomain(s), zip = deskArchive("ostickit", "1.7").name;
    c.php = phpNeeded("ostickit", "1.7");
    const ws = idOf(createOwnWebspace(s, c.id));
    ok(downloadArchive(s, zip));
    ok(createSubdomain(s, ws, "support", domain));
    ok(uploadFile(s, ws, "public_html/support", zip));
    ok(extractFile(s, ws, `public_html/support/${zip}`));
    expect(resolve(s, `support.${domain}/upload/setup/`).page).toMatchObject({ kind: "deskSetup", screen: "installer", base: "/upload", folder: "public_html/support/upload" });
  });

  it("lists OsTickit in Softaculus from 2009 and installs it without a setup folder", () => {
    expect(appInstallerDesks(2008)).toEqual([]);
    expect(appInstallerDesks(2009)).toEqual(["ostickit"]);
    const s = hosted(2014), c = panelOf(s), domain = companyDomain(s);
    c.php = phpNeeded("ostickit", "1.7");
    const ws = idOf(createOwnWebspace(s, c.id));
    ok(createSubdomain(s, ws, "support", domain));
    const f = { ...DESK_ADMIN, domain: `support.${domain}`, dir: "", helpdesk: "Pixel Support", deskEmail: `support@${domain}` };
    expect(err(installDeskApp(s, ws, "freescoot", f))).toBe("shop-setup.app.notListed");
    ok(installDeskApp(s, ws, "ostickit", f));
    expect(deskWarnings(s)).toEqual([]);
    expect(webspaceOf(s, ws)!.files["public_html/support/setup"]).toBeUndefined();
    expect(resolve(s, `support.${domain}/scp/`).page).toEqual({ kind: "desk", id: "ostickit" });
    ok(deskLogin(s, "ada", DESK_ADMIN.pass));
    expect(err(installDeskApp(s, ws, "ostickit", f))).toBe("shop-setup.app.notEmpty");
  });

  it("gives a save with a self-hosted desk its files, database and a mailed staff account", () => {
    const s = hosted(2014), c = panelOf(s);
    s.desk = null;
    const t0 = deserialize(serialize(s));
    t0.desk = { id: "ostickit", hosting: { kind: "self", clusterId: c.id, version: "1.7" }, tenant: null, departments: [], rules: [], addons: {}, lastRef: 0, ai: newDeskAi() };
    const t = deserialize(serialize(t0)), at = deskSpace(t)!;
    expect(at.folder).toBe("public_html/support");
    expect(deskBroken(t)).toBe(false);
    expect(deskWarnings(t)).toEqual([]);
    const mail = mailsAbout(t, "deskCredentials")[0];
    expect(mail.p!.url).toBe(`support.${companyDomain(t)}/scp/`);
    ok(deskLogin(t, String(mail.p!.user), String(mail.p!.pass)));
    expect(mailsAbout(deserialize(serialize(t)), "deskCredentials")).toHaveLength(1);
  });
});
