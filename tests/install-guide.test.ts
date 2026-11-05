import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { shopArchive } from "../src/sim/10-catalog/archives";
import { shopEditionFor, shopLease } from "../src/sim/10-catalog/shop-licences";
import { shopSetup } from "../src/sim/10-catalog/shop-setup";
import type { ShopId } from "../src/sim/10-catalog/shops";
import { versionAt } from "../src/sim/10-catalog/software-versions";
import { companyDomain } from "../src/sim/30-customers/domains";
import type { GameState } from "../src/sim/50-state";
import { guideOf, syncShopGuide } from "../src/sim/60-infra/install-guide";
import { isLicensed, issueKey } from "../src/sim/60-infra/licence";
import { PHP_UPGRADE_HOURS } from "../src/sim/60-infra/php";
import { IONCUBE } from "../src/sim/60-infra/shop-files";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { shopCount } from "../src/sim/80-business/shop";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { upgradePhp } from "../src/sim/90-actions/clusters";
import { downloadArchive } from "../src/sim/90-actions/media";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { finishShopSetup } from "../src/sim/90-actions/portal";
import { installShop } from "../src/sim/90-actions/shop";
import { changeShopPassword, runShopInstaller, type InstallForm } from "../src/sim/90-actions/shop-setup";
import { setIonCube } from "../src/sim/90-actions/webpanel";
import { createCron, createDatabase, createDbUser, createOwnWebspace, createSubdomain, deleteCron, deleteFile, grantDb, renameFile } from "../src/sim/90-actions/webspace";
import { chmodFile, extractFile, uploadFile } from "../src/sim/90-actions/webspace-files";
import { readyGame } from "./fixtures";

const ok = (r: ActionResult) => expect(r.ok ? null : r.error).toBeNull();
const panelHost = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!;

// Walks the vendor's installation guide in order and checks each step turns from open to done with its own action.
function walk(id: ShopId, ym: string) {
  const s = readyGame(5);
  s.hour = hourOfMonth(ym);
  s.cash = 1e6;
  s.marketing.launched = true;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  const c = panelHost(s), version = versionAt(id, s.hour).version, sp = shopSetup(id, version), zip = shopArchive(id, version)!.name;
  const steps = () => Object.fromEntries(guideOf(s, id, version).map((x) => [x.id, x.done]));
  const flips = (step: string, act: () => void) => {
    expect(steps()[step], `${step} before`).toBe(false);
    act();
    expect(steps()[step], `${step} after`).toBe(true);
  };
  // The domains take the host's PHP when they are made.
  upgradePhp(s, c.id);
  const ws = createOwnWebspace(s, c.id), wsId = ws.ok ? ws.id! : "", folder = "public_html/portal", home = webspaceOf(s, wsId)!.home;
  let key: string | undefined;
  if (isLicensed(id)) flips("licence", () => { key = issueKey(s, id, shopLease(id, s.hour) === null ? null : shopEditionFor(id, s.hour, shopCount(s))?.id ?? null).key; });
  else expect(steps().licence).toBe(true);
  flips("download", () => ok(downloadArchive(s, zip)));
  flips("folder", () => ok(createSubdomain(s, wsId, "portal", companyDomain(s))));
  flips("upload", () => ok(uploadFile(s, wsId, folder, zip)));
  flips("extract", () => ok(extractFile(s, wsId, `${folder}/${zip}`)));
  const loader = () => { if (IONCUBE.includes(id)) ok(setIonCube(s, c.id, true)); s.hour += PHP_UPGRADE_HOURS; };
  if (IONCUBE.includes(id)) flips("requirements", loader);
  else { loader(); expect(steps().requirements).toBe(true); }
  if (sp.rename) flips("rename", () => ok(renameFile(s, wsId, `${folder}/${sp.config}.new`, sp.config.split("/").pop()!)));
  if (sp.writable.length) flips("permissions", () => sp.writable.forEach(([p]) => ok(chmodFile(s, wsId, `${folder}/${p}`, "0777"))));
  const db = { id: "", user: "" };
  flips("database", () => { const d = createDatabase(s, wsId, "shop"); db.id = d.ok ? d.id! : ""; });
  flips("dbuser", () => { const u = createDbUser(s, wsId, "shop", "dbpass1"); db.user = u.ok ? u.id! : ""; ok(grantDb(s, wsId, db.user, db.id)); });
  const form: InstallForm = { first: "Ada", last: "Admin", email: "ada@example.com", user: "ada", pass: "s3cret!", dbHost: "localhost", dbName: db.id, dbUser: db.user, dbPass: "dbpass1", key };
  flips("installer", () => ok(runShopInstaller(s, wsId, folder, id === "hostBull" ? { ...form, user: "", pass: "" } : form)));
  if (id === "hostBull") flips("password", () => ok(changeShopPassword(s, "admin", "admin", "n3wpass!")));
  if (sp.installDir) flips("removeInstall", () => ok(deleteFile(s, wsId, `${folder}/${sp.installDir}`)));
  if (sp.lock) flips("lockConfig", () => ok(chmodFile(s, wsId, `${folder}/${sp.config}`, "0644")));
  flips("cron", () => sp.cron!.scripts.forEach((x) => ok(createCron(s, wsId, `php -q ${home}/${folder}/${x}`, sp.cron!.hours))));
  flips("setup", () => ok(finishShopSetup(s)));
  expect(guideOf(s, id, version).every((x) => x.done)).toBe(true);
  return { s, version, steps, wsId, folder };
}

describe("the install guide of each shop system", () => {
  const CASES: [ShopId, string][] = [
    ["modemBill", "2006-05"], ["clientExit", "2010-05"], ["whmCache", "2016-05"], ["blessta", "2013-10"],
    ["hostBull", "2016-05"], ["ubersmyth", "2014-05"], ["boxBillin", "2015-05"],
  ];
  for (const [id, ym] of CASES) it(`ticks ${id} step by step in ${ym}`, () => { walk(id, ym); });

  it("ticks the hosted shop from its account to its setup", () => {
    const s = readyGame(5);
    s.hour = hourOfMonth("2010-05");
    s.marketing.launched = true;
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    const steps = () => Object.fromEntries(guideOf(s, "orderBocks", "7").map((x) => [x.id, x.done]));
    expect(steps()).toMatchObject({ account: false, hostedSetup: false });
    ok(installShop(s, panelHost(s).id, "orderBocks"));
    expect(steps().account).toBe(true);
    ok(finishShopSetup(s));
    expect(steps().hostedSetup).toBe(true);
  });

  it("follows the release: other cron lines, folders and permissions per major", () => {
    const old = walk("whmCache", "2012-05"), now = walk("whmCache", "2022-05");
    expect(shopSetup("whmCache", old.version).cron).toEqual({ scripts: ["admin/cron.php"], hours: 24 });
    expect(shopSetup("whmCache", now.version).cron).toEqual({ scripts: ["crons/cron.php"], hours: 1 });
    expect(shopSetup("whmCache", now.version).lock).toBe(true);
    const v2 = walk("blessta", "2011-05"), v3 = walk("blessta", "2015-05");
    expect(guideOf(v2.s, "blessta", v2.version).map((x) => x.id)).toEqual(expect.arrayContaining(["permissions", "removeInstall"]));
    expect(guideOf(v3.s, "blessta", v3.version).map((x) => x.id)).not.toContain("removeInstall");
    expect(guideOf(v3.s, "blessta", v3.version).map((x) => x.id)).not.toContain("permissions");
  });

  it("keeps a step ticked after its state is gone", () => {
    const { s, steps, wsId } = walk("clientExit", "2010-05");
    syncShopGuide(s);
    for (const id of Object.keys(webspaceOf(s, wsId)!.cron)) ok(deleteCron(s, wsId, id));
    expect(Object.keys(webspaceOf(s, wsId)!.cron)).toEqual([]);
    expect(steps().cron).toBe(true);
  });
});
