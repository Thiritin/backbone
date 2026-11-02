import { describe, expect, it } from "vitest";
import { appArchive, archiveNamed, shopArchive } from "../src/sim/10-catalog/archives";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { GameState } from "../src/sim/50-state";
import { modeOf, webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { downloadArchive, downloadedFiles, downloadImage, transferHours, uploadMbps } from "../src/sim/90-actions/media";
import { createFolder } from "../src/sim/90-actions/webspace";
import * as fm from "../src/sim/90-actions/webspace-files";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);
const WHMCACHE = "whmcache_5.0.zip";

// A static site on a cPanic server in 2012, with the WHMCache 5.0 archive in Downloads.
function account(seed = 1) {
  const s = withServer(newGame(seed));
  skipTo(s, 2012);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2012), mailboxes: 1, app: "static" }, clusterId: host }));
  ok(downloadArchive(s, WHMCACHE));
  return { s, id: s.workloads.find((x) => x.serviceId === svc)!.id };
}
const ws = (s: GameState, id: string) => webspaceOf(s, id)!;

describe("archive catalog", () => {
  it("names shop archives per version and reads them back", () => {
    const a = shopArchive("whmCache", "5.0")!;
    expect(a.name).toBe(WHMCACHE);
    expect(archiveNamed(WHMCACHE)).toEqual(a);
    expect(a.entries.map(([p]) => p)).toContain("install/");
    expect(a.mb).toBeGreaterThan(0);
    expect(shopArchive("orderBocks", "9")).toBeNull();
    expect(archiveNamed("nothing.zip")).toBeNull();
    expect(archiveNamed(appArchive("wordpass")!.name)).toEqual(appArchive("wordpass"));
  });

  it("puts archives and images into Downloads", () => {
    const s = newGame(1);
    expect(err(downloadArchive(s, "nothing.zip"))).toBe("webspace.error.noArchive");
    ok(downloadArchive(s, WHMCACHE));
    ok(downloadImage(s, s.media.images[0] ?? "lunix@12"));
    expect(downloadedFiles(s).map((f) => f.name)).toEqual(expect.arrayContaining([WHMCACHE, expect.stringMatching(/\.iso$/)]));
  });
});

describe("upload and extract", () => {
  it("uploads from Downloads over the line's upload speed and extracts the tree", () => {
    const { s, id } = account(), before = ws(s, id).usage.diskMb, a = archiveNamed(WHMCACHE)!;
    expect(transferHours(a.mb, uploadMbps(s))).toBeGreaterThan(transferHours(1, uploadMbps(s)));
    ok(createFolder(s, id, "public_html", "portal"));
    expect(err(fm.checkUpload(s, id, "public_html/portal", "missing.zip"))).toBe("webspace.error.noDownload");
    expect(ok(fm.uploadFile(s, id, "public_html/portal", WHMCACHE))).toBe(`public_html/portal/${WHMCACHE}`);
    expect(fm.uploadFile(s, id, "public_html/portal", WHMCACHE)).toEqual({ ok: false, error: "webspace.error.uploadExists", params: { name: WHMCACHE } });
    ok(fm.uploadFile(s, id, "public_html/portal", WHMCACHE, true));
    expect(ws(s, id).usage.diskMb).toBeCloseTo(before + a.mb, 3);

    ok(fm.extractFile(s, id, `public_html/portal/${WHMCACHE}`));
    const x = ws(s, id);
    expect(x.files["public_html/portal/install"]?.dir).toBe(true);
    expect(x.files["public_html/portal/configuration.php.new"]).toBeDefined();
    expect(x.usage.diskMb).toBeCloseTo(before + a.mb + a.entries.reduce((n, [, mb]) => n + mb, 0), 3);
    // Extracting again overwrites in place and adds nothing.
    ok(fm.extractFile(s, id, `public_html/portal/${WHMCACHE}`));
    expect(ws(s, id).usage.diskMb).toBeCloseTo(x.usage.diskMb, 3);
  });

  it("creates the parent folders of an app archive", () => {
    const { s, id } = account();
    const name = appArchive("drupel")!.name;
    ok(downloadArchive(s, name));
    ok(fm.uploadFile(s, id, "tmp", name));
    ok(fm.extractFile(s, id, `tmp/${name}`, "public_html"));
    expect(ws(s, id).files["public_html/drupel/sites/default/default.settings.php"]).toBeDefined();
    expect(err(fm.extractFile(s, id, "public_html/index.html"))).toBe("webspace.error.notArchive");
  });

  it("refuses writes past the disk quota", () => {
    const { s, id } = account(), w = s.workloads.find((x) => x.id === id)!;
    const quotaFor = (freeMb: number) => (ws(s, id).usage.diskMb + freeMb) / 1024;
    w.diskGb = quotaFor(1);
    expect(err(fm.checkUpload(s, id, "public_html", WHMCACHE))).toBe("webspace.error.diskQuota");
    expect(err(fm.uploadFile(s, id, "public_html", WHMCACHE))).toBe("webspace.error.diskQuota");
    expect(s.webspaces[id]).toBeUndefined();
    w.diskGb = quotaFor(archiveNamed(WHMCACHE)!.mb + 1);
    ok(fm.uploadFile(s, id, "public_html", WHMCACHE));
    expect(err(fm.extractFile(s, id, `public_html/${WHMCACHE}`))).toBe("webspace.error.diskQuota");
    expect(ws(s, id).files["public_html/install"]).toBeUndefined();
  });
});

describe("file operations", () => {
  it("creates, compresses, moves, copies and changes permissions", () => {
    const { s, id } = account();
    ok(fm.createFile(s, id, "public_html", "notes.txt"));
    expect(err(fm.createFile(s, id, "public_html", "notes.txt"))).toBe("webspace.error.fileTaken");
    ok(createFolder(s, id, "", "backup"));
    expect(ws(s, id).files.backup?.dir).toBe(true);

    expect(ok(fm.compressFiles(s, id, ["public_html/images", "public_html/index.html"], "site", "gz"))).toBe("public_html/site.tar.gz");
    expect(ws(s, id).files["public_html/site.tar.gz"].pack?.["images"]?.dir).toBe(true);
    expect(err(fm.compressFiles(s, id, ["public_html/index.html", "logs"], "x"))).toBe("webspace.error.oneFolder");

    ok(fm.moveFiles(s, id, ["public_html/site.tar.gz"], "backup"));
    ok(fm.extractFile(s, id, "backup/site.tar.gz"));
    const x = ws(s, id);
    expect(x.files["backup/images"]?.dir).toBe(true);
    expect(x.files["backup/index.html"].mb).toBe(x.files["public_html/index.html"].mb);
    expect(err(fm.moveFiles(s, id, ["public_html"], "backup"))).toBe("webspace.error.fixedFolder");
    expect(err(fm.moveFiles(s, id, ["backup"], "backup/images"))).toBe("webspace.error.intoItself");

    ok(fm.copyFiles(s, id, ["public_html/notes.txt"], "backup"));
    expect(ws(s, id).files["backup/notes.txt"]).toBeDefined();
    expect(err(fm.copyFiles(s, id, ["public_html/notes.txt"], "backup"))).toBe("webspace.error.fileTaken");

    expect(modeOf("public_html", ws(s, id).files.public_html)).toBe("0750");
    expect(modeOf("backup", ws(s, id).files.backup)).toBe("0755");
    ok(fm.chmodFile(s, id, "backup/notes.txt", "600"));
    expect(modeOf("backup/notes.txt", ws(s, id).files["backup/notes.txt"])).toBe("0600");
    expect(err(fm.chmodFile(s, id, "backup/notes.txt", "999"))).toBe("webspace.error.mode");
  });

  it("keeps the changes and Downloads through a save and loads saves without archives", () => {
    const { s, id } = account();
    ok(fm.uploadFile(s, id, "public_html", WHMCACHE));
    const back = deserialize(serialize(s));
    expect(back.media.files).toEqual([WHMCACHE]);
    expect(ws(back, id).files[`public_html/${WHMCACHE}`]).toEqual(ws(s, id).files[`public_html/${WHMCACHE}`]);
    const data = JSON.parse(serialize(s));
    delete data.media.files;
    expect(deserialize(JSON.stringify(data)).media.files).toEqual([]);
  });
});
