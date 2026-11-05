import { shopArchive } from "../src/sim/10-catalog/archives";
import { configWritable, CRON_GRACE, defaultAdmin, installDirLeft, shopCronOk, shopSpace, adminFirstName } from "../src/sim/60-infra/shop-files";
import { syncShopGuide } from "../src/sim/60-infra/install-guide";
import { billingTick } from "../src/sim/45-billing/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { shopActive } from "../src/sim/80-business/shop";
import { upgradePhp } from "../src/sim/90-actions/clusters";
import { downloadArchive } from "../src/sim/90-actions/media";
import { changeShopPassword, installShopApp, requestShopReset, resetShopPassword, runShopInstaller, runShopUpgrade, shopLogin, type InstallForm } from "../src/sim/90-actions/shop-setup";
import { createCron, createDatabase, createDbUser, createOwnWebspace, createSubdomain, deleteCron, deleteFile, grantDb, renameFile } from "../src/sim/90-actions/webspace";
import { shopSetup } from "../src/sim/10-catalog/shop-setup";
import { chmodFile, extractFile, uploadFile } from "../src/sim/90-actions/webspace-files";
import { editRow } from "../src/sim/90-actions/webdb";
import { setIonCube } from "../src/sim/90-actions/webpanel";
import { PHP_UPGRADE_HOURS } from "../src/sim/60-infra/php";
import type { ShopId } from "../src/sim/10-catalog/shops";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { shopEditionFor } from "../src/sim/10-catalog/shop-licences";
import { nextMajor, versionAt, versionInfo } from "../src/sim/10-catalog/software-versions";
import type { GameState } from "../src/sim/50-state";
import { accountsOn, assignedKey, assignKey, issueKey, licenceStatus, SHOP_MACHINE, yearAfter } from "../src/sim/60-infra/licence";
import { clusterFactor } from "../src/sim/60-infra/lifecycle";
import { companyDomain } from "../src/sim/30-customers/domains";
import { resolve } from "../src/sim/80-business/browser";
import { shopUpdate } from "../src/sim/80-business/shop";
import { shopBlock } from "../src/sim/80-business/website";
import { renewKeys } from "../src/sim/85-products/products";
import { activateLicence } from "../src/sim/90-actions/licence";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { installShop, renewShopUpdates, updateShop, upgradeFee, upgradeShop } from "../src/sim/90-actions/shop";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { readyGame, installWithKey, mailsAbout, newGame, withCard, withServer } from "./fixtures";

// readyGame's FreePanel VM is the first panel host.
const panelHost = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!;
const game = (ym: string, seed = 5): GameState => {
  const s = readyGame(seed);
  s.hour = hourOfMonth(ym);
  s.cash = 1e6;
  s.marketing.launched = true;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  return s;
};
const idOf = (r: ActionResult): string => (r.ok ? r.id! : "");
const err = (r: ActionResult): string | null => (r.ok ? null : r.error);
const ok = (r: ActionResult) => expect(err(r)).toBeNull();
const chosen = (ym: string, id: ShopId, own = false) => {
  const s = game(ym);
  installWithKey(s, id, own);
  return s;
};
const key = (s: GameState) => assignedKey(s, SHOP_MACHINE, s.shop.variant!)!;

describe("installing a shop system", () => {
  it("puts the chosen shop with its key into a web space of the first panel host", () => {
    const s = game("2009-05"), c = panelHost(s), before = accountsOn(s, c);
    installWithKey(s, "clientExit", true);
    expect(s.shop.install).toEqual({ clusterId: c.id, version: versionAt("clientExit", s.hour).version, at: s.hour });
    expect(accountsOn(s, c)).toBe(before + 1);
    expect(key(s)).toMatchObject({ kind: "once", covers: { kind: "version", major: versionAt("clientExit", s.hour).major } });
    expect(licenceStatus(s, SHOP_MACHINE, "clientExit")).toBe("active");
  });

  it("needs a panel host, and a key for a shop without a trial", () => {
    const s = game("2009-05");
    expect(err(installShop(s, s.clusters.find((c) => c.kind !== "panel")!.id, "whmCache"))).toBe("error.shopHostPanel");
    expect(err(installShop(s, panelHost(s).id, "whmCache"))).toBe("error.licenceKey");
    const k = issueKey(s, "whmCache", null);
    ok(installShop(s, panelHost(s).id, "whmCache", k.key.toLowerCase()));
    expect(key(s).id).toBe(k.id);
    expect(err(installShop(s, panelHost(s).id, "whmCache"))).toBe("error.shopInUse");
  });

  it("takes orders only while installed, its host up and its licence valid", () => {
    const s = game("2009-05"), portal = `portal.${companyDomain(s)}/`;
    s.clusters = s.clusters.filter((c) => c.kind !== "panel");
    installWithKey(s, "clientExit", true);
    expect(shopBlock(s)).toBe("error.shopNotInstalled");
    expect(resolve(s, portal).page.kind).toBe("notfound");
    const t = chosen("2009-05", "clientExit", true);
    expect(shopBlock(t)).toBeNull();
    expect(resolve(t, `portal.${companyDomain(t)}/`)).toMatchObject({ page: { kind: "shop" }, load: "fast" });
    t.security = { ...t.security, offline: [...t.security.offline, panelHost(t).id] };
    expect(shopBlock(t)).toBe("error.shopDown");
    expect(resolve(t, `portal.${companyDomain(t)}/`).load).toBe("down");
  });
});

describe("shop licences", () => {
  it("run a trial, then block orders until a key is entered", () => {
    const s = chosen("2009-05", "clientExit", true);
    const bought = key(s);
    s.licenses = s.licenses.map((k) => ({ ...k, machineId: null }));
    s.shop.install = null;
    ok(installShop(s, panelHost(s).id, "clientExit"));
    expect(licenceStatus(s, SHOP_MACHINE, "clientExit")).toBe("trial");
    s.hour += 15 * 24;
    expect(shopBlock(s)).toBe("error.licenceExpired");
    ok(activateLicence(s, SHOP_MACHINE, "clientExit", bought.key));
    expect(shopBlock(s)).toBeNull();
  });

  it("block new orders once the edition's client cap is full", () => {
    const s = chosen("2006-03", "modemBill", true);
    assignKey(s, issueKey(s, "modemBill", "lite").id, SHOP_MACHINE);
    const live = s.customers.find((c) => c.churnedAt === null)!;
    const n = s.customers.filter((c) => c.churnedAt === null).length;
    s.customers = [...s.customers, ...Array.from({ length: 49 - n }, (_, i) => ({ ...live, id: `cap${i}` }))];
    expect(shopBlock(s)).toBeNull();
    s.customers = [...s.customers, { ...live, id: "cap-last" }];
    expect(shopBlock(s)).toBe("error.licenceCap");
  });

  it("let a lease lapse after the grace days and block orders", () => {
    const s = chosen("2021-03", "whmCache");
    const k = key(s), active = s.customers.filter((c) => c.churnedAt === null).length;
    expect(k).toMatchObject({ edition: shopEditionFor("whmCache", s.hour, active)!.id, covers: { kind: "term" } });
    s.cash = 0;
    s.bank = null;
    s.hour = k.renewsAt! + 8 * 24;
    renewKeys(s);
    expect(licenceStatus(s, SHOP_MACHINE, "whmCache")).toBe("lapsed");
    expect(shopBlock(s)).toBe("error.licenceExpired");
  });
});

describe("shop updates", () => {
  it("install minor updates only inside the key's updates window, which a renewal extends", () => {
    const s = chosen("2008-04", "whmCache", true), k = key(s);
    expect(s.shop.install!.version).toBe("3.0");
    expect(k.updatesUntil).toBe(yearAfter(k.boughtAt));
    s.hour = hourOfMonth("2010-01");
    expect(shopUpdate(s)).toBeNull();
    expect(err(updateShop(s))).toBe("error.noUpdate");
    const cash = s.cash;
    ok(renewShopUpdates(s));
    expect(s.cash).toBe(cash - 45);
    expect(key(s).updatesUntil).toBe(yearAfter(s.hour));
    // Version 4.0 is a new major the key does not cover.
    expect(shopUpdate(s)).toBeNull();
  });

  it("pays the upgrade and the updates renewal by the method the player chose", () => {
    const s = chosen("2008-04", "whmCache", true);
    s.hour = hourOfMonth("2009-08");
    withCard(s);
    expect(upgradeFee(s)).toBeGreaterThan(0);
    ok(upgradeShop(s, "onAccount"));
    ok(renewShopUpdates(s, "card"));
    expect(s.payables.slice(-2).map((p) => p.method)).toEqual(["onAccount", "card"]);
  });

  it("upgrade to the next major at the vendor's price for a key of the new major", () => {
    const s = chosen("2008-04", "whmCache", true), old = key(s);
    s.hour = hourOfMonth("2009-08");
    const next = nextMajor("whmCache", s.shop.install!.version, s.hour)!, cash = s.cash;
    ok(upgradeShop(s));
    expect(s.shop.install!.version).toBe(next.version);
    expect(s.cash).toBe(cash - 325);
    expect(key(s)).toMatchObject({ covers: { kind: "version", major: next.major } });
    expect(s.licenses.find((k) => k.id === old.id)!.machineId).toBeNull();
    expect(licenceStatus(s, SHOP_MACHINE, "whmCache")).toBe("active");
  });

  it("raise the host's exposure once the installed version is past its security updates", () => {
    const s = chosen("2008-04", "whmCache", true), c = panelHost(s);
    const base = clusterFactor(s, c);
    s.hour = versionInfo("whmCache", "3.0")!.securityUntil! + 365 * 24;
    expect(clusterFactor(s, c)).toBeGreaterThan(base);
  });
});

describe("old saves", () => {
  it("install a saved shop on the first panel host with a year of updates from the save", () => {
    const s = game("2012-06");
    installWithKey(s, "blessta", true);
    const data = JSON.parse(serialize(s));
    delete data.shop.install;
    data.licenses = data.licenses.filter((k: { product: string }) => k.product !== "blessta");
    const back = deserialize(JSON.stringify(data));
    expect(back.shop.install).toEqual({ clusterId: panelHost(s).id, version: versionAt("blessta", s.hour).version, at: s.hour });
    expect(key(back)).toMatchObject({ kind: "once", covers: { kind: "version", major: versionAt("blessta", s.hour).major }, updatesUntil: yearAfter(s.hour) });
  });

  it("keep a saved shop uninstalled without a panel host", () => {
    const s = game("2012-06");
    s.clusters = s.clusters.filter((c) => c.kind !== "panel");
    installWithKey(s, "blessta", true);
    const data = JSON.parse(serialize(s));
    delete data.shop.install;
    const back = deserialize(JSON.stringify(data));
    expect(back.shop).toMatchObject({ variant: "blessta", install: null });
    expect(shopBlock(back)).toBe("error.shopNotInstalled");
  });
});

// web-hosting.md 5: the shop installed by hand into the company's web space.
describe("installing the shop by hand", () => {
  const admin = { first: "Ada", last: "Admin", email: "ada@example.com", user: "ada", pass: "s3cret!" };
  // A cPanic-style own web space with the archive extracted under portal.<domain> and a database with a user.
  const prepared = (ym: string, id: ShopId, version = versionAt(id, hourOfMonth(ym)).version, ready = true) => {
    const s = game(ym), c = panelHost(s), domain = companyDomain(s);
    upgradePhp(s, c.id);
    // WHMCache's tests turn the loader on themselves; Blessta ships encoded as well.
    if (id === "blessta") { ok(setIonCube(s, c.id, true)); s.hour += PHP_UPGRADE_HOURS; }
    const ws = idOf(createOwnWebspace(s, c.id)), folder = "public_html/portal", zip = shopArchive(id, version)!.name;
    ok(downloadArchive(s, zip));
    ok(createSubdomain(s, ws, "portal", domain));
    ok(uploadFile(s, ws, folder, zip));
    ok(extractFile(s, ws, `${folder}/${zip}`));
    // The vendor's guide: the config file under its real name, and the folders the installer writes to.
    const setup = shopSetup(id, version);
    if (ready && setup.rename) ok(renameFile(s, ws, `${folder}/${setup.config}.new`, setup.config.split("/").pop()!));
    for (const [path] of ready ? setup.writable : []) ok(chmodFile(s, ws, `${folder}/${path}`, "0777"));
    const db = idOf(createDatabase(s, ws, "shop")), user = idOf(createDbUser(s, ws, "shop", "dbpass1"));
    ok(grantDb(s, ws, user, db));
    const form: InstallForm = { ...admin, dbHost: "localhost", dbName: db, dbUser: user, dbPass: "dbpass1" };
    return { s, c, ws, folder, form, domain, zip };
  };

  it("runs the installer, keeps the admin out while the install folder exists and logs in with the chosen account", () => {
    const { s, c, ws, folder, form, domain } = prepared("2016-05", "whmCache");
    const k = issueKey(s, "whmCache", null);
    expect(resolve(s, `portal.${domain}/install/`).page).toMatchObject({ kind: "shopSetup", screen: "installer", id: "whmCache" });
    expect(resolve(s, `portal.${domain}/`).page).toMatchObject({ kind: "shopSetup", screen: "notInstalled" });
    expect(err(runShopInstaller(s, ws, folder, { ...form, key: k.key }))).toBe("shop-setup.req.ioncube.fail");
    ok(setIonCube(s, c.id, true));
    expect(err(runShopInstaller(s, ws, folder, { ...form, key: k.key }))).toBe("shop-setup.req.ioncube.fail");
    s.hour += PHP_UPGRADE_HOURS;
    expect(err(runShopInstaller(s, ws, folder, form))).toBe("error.licenceKey");
    expect(runShopInstaller(s, ws, folder, { ...form, key: k.key, dbPass: "wrong" })).toEqual({ ok: false, error: "shop-setup.db.denied", params: { user: form.dbUser, yes: "YES" } });
    expect(err(runShopInstaller(s, ws, folder, { ...form, key: k.key, pass: "abc" }))).toBe("shop-setup.error.passShort");
    ok(runShopInstaller(s, ws, folder, { ...form, key: k.key }));
    expect(adminFirstName(s)).toBe(form.first);
    expect(s.shop.install).toMatchObject({ clusterId: c.id, ws, folder, db: form.dbName, version: "6.0" });
    expect(shopActive(s)).toBe(true);
    expect(installDirLeft(s, c.id)).toBe(true);
    expect(resolve(s, `portal.${domain}/`).page).toEqual({ kind: "shop" });
    expect(err(runShopInstaller(s, ws, folder, { ...form, key: k.key }))).toBe("shop-setup.error.installed");
    ok(deleteFile(s, ws, `${folder}/install`));
    expect(installDirLeft(s)).toBe(false);
    expect(err(shopLogin(s, "ada", "wrong"))).toBe("shop-setup.login.whmCache");
    expect(err(shopLogin(s, "admin", "password"))).toBe("shop-setup.login.whmCache");
    ok(shopLogin(s, "ada", "s3cret!"));
  });

  it("refuses an old PHP and a missing database, and goes down when its files go", () => {
    const { s, ws, folder, form } = prepared("2013-08", "blessta"), c = panelHost(s);
    const php = c.php;
    c.php = "5.1";
    expect(runShopInstaller(s, ws, folder, form)).toMatchObject({ ok: false, error: "shop-setup.req.php.fail", params: { have: "5.1" } });
    c.php = php;
    expect(err(runShopInstaller(s, ws, folder, { ...form, dbName: "nope" }))).toBe("shop-setup.db.dbDenied");
    expect(err(runShopInstaller(s, ws, folder, { ...form, dbHost: "db.example.com" }))).toBe("shop-setup.db.host");
    ok(runShopInstaller(s, ws, folder, form));
    expect(shopActive(s)).toBe(true);
    ok(deleteFile(s, ws, `${folder}/index.php`));
    expect(shopActive(s)).toBe(false);
  });

  it("mails a reset link and takes the new password from it", () => {
    const { s, ws, folder, form } = prepared("2016-05", "blessta");
    ok(runShopInstaller(s, ws, folder, form));
    ok(requestShopReset(s, "nobody@example.com"));
    expect(mailsAbout(s, "shopReset")).toEqual([]);
    ok(requestShopReset(s, admin.email));
    const mail = mailsAbout(s, "shopReset")[0];
    const token = new URLSearchParams(String(mail.p!.url).split("?")[1]).get("reset")!;
    expect(err(resetShopPassword(s, "bad", "newpass1"))).toBe("shop-setup.reset.expired");
    ok(resetShopPassword(s, token, "newpass1"));
    expect(err(shopLogin(s, "ada", admin.pass))).toBe("shop-setup.login.blessta");
    ok(shopLogin(s, "ada", "newpass1"));
    expect(err(resetShopPassword(s, token, "again123"))).toBe("shop-setup.reset.expired");
    ok(requestShopReset(s, admin.email));
    const late = new URLSearchParams(String(mailsAbout(s, "shopReset").pop()!.p!.url).split("?")[1]).get("reset")!;
    s.hour += 25;
    expect(err(resetShopPassword(s, late, "again123"))).toBe("shop-setup.reset.expired");
  });

  it("upgrades through the upload and the upgrade script, then accepts an MD5 password and stores it as bcrypt", () => {
    const { s, c, ws, folder, form, domain } = prepared("2016-11", "whmCache", "6.0");
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    const k6 = issueKey(s, "whmCache", null, undefined, "6");
    ok(runShopInstaller(s, ws, folder, { ...form, key: k6.key }));
    const zip = shopArchive("whmCache", "7.0")!.name;
    ok(downloadArchive(s, zip));
    ok(uploadFile(s, ws, folder, zip));
    ok(extractFile(s, ws, `${folder}/${zip}`));
    expect(resolve(s, `portal.${domain}/`).page).toMatchObject({ kind: "shopSetup", screen: "maintenance" });
    expect(shopActive(s)).toBe(false);
    expect(err(runShopUpgrade(s))).toBe("error.licenceKey");
    const k7 = issueKey(s, "whmCache", null, undefined, "7");
    ok(runShopUpgrade(s, k7.key));
    expect(s.shop.install!.version).toBe("7.0");
    expect(shopActive(s)).toBe(true);
    const at = shopSpace(s)!;
    ok(editRow(s, ws, at.db, "tbladmins", 1, { password: "fromphpmyadmon" }, { password: "MD5" }));
    ok(shopLogin(s, "ada", "fromphpmyadmon"));
    const stored = () => webspaceOf(s, ws)!.rows[`${at.db}.tbladmins.1`].values.password;
    expect(stored()).toMatch(/^\$2y\$10\$/);
    ok(shopLogin(s, "ada", "fromphpmyadmon"));
  });

  it("installs in one step through Softaculus in the years it lists the shop", () => {
    const s = game("2014-05"), c = panelHost(s), domain = companyDomain(s);
    upgradePhp(s, c.id);
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    const ws = idOf(createOwnWebspace(s, c.id)), f = { ...admin, domain, dir: "billing" };
    expect(err(installShopApp(s, ws, "whmCache", f))).toBe("shop-setup.app.notListed");
    ok(installShopApp(s, ws, "blessta", f));
    const at = shopSpace(s)!;
    expect(at.folder).toBe("public_html/billing");
    expect(installDirLeft(s)).toBe(false);
    expect(Object.keys(at.ws.dbUsers)).toContain(at.db);
    expect(shopActive(s)).toBe(true);
    expect(resolve(s, `${domain}/billing/admin/`).page).toEqual({ kind: "shop", base: "/billing" });
    ok(shopLogin(s, "ada", admin.pass));
    expect(err(installShopApp(s, ws, "blessta", f))).toBe("shop-setup.app.notEmpty");
  });

  it("refuses until the config file is renamed and the folders are writable", () => {
    const { s, c, ws, folder, form } = prepared("2016-05", "whmCache", "6.0", false);
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    const k = issueKey(s, "whmCache", null), go = () => err(runShopInstaller(s, ws, folder, { ...form, key: k.key }));
    expect(go()).toBe("shop-setup.req.config.fail");
    ok(renameFile(s, ws, `${folder}/configuration.php.new`, "configuration.php"));
    expect(runShopInstaller(s, ws, folder, { ...form, key: k.key })).toMatchObject({ ok: false, error: "shop-setup.req.writable.fail", params: { path: "configuration.php" } });
    for (const p of ["configuration.php", "attachments", "downloads"]) ok(chmodFile(s, ws, `${folder}/${p}`, "0777"));
    expect(runShopInstaller(s, ws, folder, { ...form, key: k.key })).toMatchObject({ ok: false, params: { path: "templates_c" } });
    ok(chmodFile(s, ws, `${folder}/templates_c`, "0777"));
    expect(go()).toBeNull();
    // The installer leaves the config open as the player set it: a finding until it is locked again.
    expect(configWritable(s)).toBe(true);
    ok(chmodFile(s, ws, `${folder}/configuration.php`, "0644"));
    expect(configWritable(s)).toBe(false);
  });

  it("creates admin with the password admin in HostBull until it is changed", () => {
    const { s, c, ws, folder, form } = prepared("2016-05", "hostBull");
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    ok(runShopInstaller(s, ws, folder, { ...form, user: "", pass: "", email: "", key: issueKey(s, "hostBull", null).key }));
    expect(defaultAdmin(s)).toBe(true);
    ok(shopLogin(s, "admin", "admin"));
    expect(err(changeShopPassword(s, "admin", "wrong", "n3wpass!"))).toBe("shop-setup.login.hostBull");
    ok(changeShopPassword(s, "admin", "admin", "n3wpass!"));
    expect(defaultAdmin(s)).toBe(false);
    ok(shopLogin(s, "admin", "n3wpass!"));
  });

  it("bills only while the cron job runs, and for a month after it was removed", () => {
    const { s, c, ws, folder, form } = prepared("2016-05", "whmCache", "6.0");
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    ok(runShopInstaller(s, ws, folder, { ...form, key: issueKey(s, "whmCache", null).key }));
    expect(shopCronOk(s)).toBe(false);
    const home = webspaceOf(s, ws)!.home, job = idOf(createCron(s, ws, `php -q ${home}/${folder}/crons/cron.php`, 1));
    expect(shopCronOk(s)).toBe(true);
    syncShopGuide(s);
    expect(s.shop.cronRanAt).toBe(s.hour);
    ok(deleteCron(s, ws, job));
    expect(shopCronOk(s)).toBe(true);
    s.hour += CRON_GRACE + 1;
    expect(shopCronOk(s)).toBe(false);
  });

  it("skips the month's invoice run while the shop has no cron job", () => {
    const s = withServer(newGame(3));
    s.hour = hourOfMonth("2010-05");
    addService(s, addCustomer(s, "Initech", "enterprise", "late"), "vps", "VPS", 0.02, "hour");
    s.hour = hourOfMonth("2010-06");
    const without = structuredClone(s), withCron = structuredClone(s);
    billingTick(without, false);
    billingTick(withCron, true);
    expect(without.invoices.length).toBe(0);
    expect(withCron.invoices.length).toBe(1);
  });

  it("gives a saved shop from before the cron rule a month of billing", () => {
    const { s, c, ws, folder, form } = prepared("2016-05", "whmCache", "6.0");
    ok(setIonCube(s, c.id, true));
    s.hour += PHP_UPGRADE_HOURS;
    ok(runShopInstaller(s, ws, folder, { ...form, key: issueKey(s, "whmCache", null).key }));
    expect(s.shop.cronRanAt).toBeUndefined();
    const back = deserialize(serialize(s));
    expect(back.shop.cronRanAt).toBe(back.hour);
    expect(shopCronOk(back)).toBe(true);
  });

  it("gives a save with an installed shop its files, database and a mailed admin account", () => {
    const s = game("2012-05"), c = panelHost(s);
    installWithKey(s, "clientExit", true);
    createOwnWebspace(s, c.id);
    const t = deserialize(serialize(s));
    const at = shopSpace(t)!;
    expect(at.folder).toBe("public_html/portal");
    expect(installDirLeft(t)).toBe(false);
    expect(shopActive(t)).toBe(true);
    const mail = mailsAbout(t, "shopCredentials")[0];
    ok(shopLogin(t, String(mail.p!.user), String(mail.p!.pass)));
    expect(mailsAbout(deserialize(serialize(t)), "shopCredentials")).toHaveLength(1);
  });
});
