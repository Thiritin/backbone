import { describe, expect, it } from "vitest";
import { archiveNamed } from "../src/sim/10-catalog/archives";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { installerFile, programById, programRelease } from "../src/sim/10-catalog/programs";
import type { GameState } from "../src/sim/50-state";
import { addressTick, mailAddress } from "../src/sim/60-infra/addresses";
import { ftpLogin, SFTP_YEAR } from "../src/sim/60-infra/ftp";
import { mailQueueTick, mailStateOf, mailsPerBox } from "../src/sim/60-infra/netsvc-mail";
import { mailboxesOf, SPAM_OFF, webspaceOf } from "../src/sim/60-infra/webspace";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { downloadProgram, installProgram } from "../src/sim/90-actions/programs";
import * as web from "../src/sim/90-actions/webspace";
import * as mail from "../src/sim/90-actions/webspace-mail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  expect(r.error).toBeUndefined();
  return r.id!;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

// A static site with three mailboxes on a cPanic server, sold in the given year.
function account(year = 2010) {
  const s = withServer(newGame(3));
  skipTo(s, year);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, year), mailboxes: 3, app: "static" }, clusterId: host }));
  s.hour += 24;
  const w = s.workloads.find((x) => x.serviceId === svc)!;
  return { s, host, id: w.id };
}
const ws = (s: GameState, id: string) => webspaceOf(s, id)!;

describe("mail in the panel", () => {
  it("creates and deletes autoresponders and keeps them through a save", () => {
    const { s, id } = account();
    expect(err(mail.createAutoresponder(s, id, "info", "nope.de", "", "Away", "", 8))).toBe("webspace.error.address");
    expect(err(mail.createAutoresponder(s, id, "info", "sockenshop.de", "", " ", "", 8))).toBe("webspace.error.subject");
    expect(err(mail.createAutoresponder(s, id, "info", "sockenshop.de", "", "Away", "", -1))).toBe("webspace.error.interval");
    ok(mail.createAutoresponder(s, id, "info", "sockenshop.de", "Socken Shop", "Away", "Back on Monday.", 8));
    const back = deserialize(serialize(s));
    expect(ws(back, id).autoresponders["info@sockenshop.de"]).toMatchObject({ subject: "Away", intervalHours: 8 });
    ok(mail.deleteAutoresponder(s, id, "info@sockenshop.de"));
    expect(err(mail.deleteAutoresponder(s, id, "info@sockenshop.de"))).toBe("webspace.error.noAutoresponder");
    expect(s.webspaces[id]).toBeUndefined();
  });

  it("stores the spam filter and rejects a score out of range", () => {
    const { s, id } = account();
    expect(ws(s, id).spam).toEqual(SPAM_OFF);
    expect(err(mail.setSpamFilter(s, id, { ...SPAM_OFF, on: true, score: 11 }))).toBe("webspace.error.spamScore");
    ok(mail.setSpamFilter(s, id, { on: true, spamBox: true, autoDelete: false, score: 6 }));
    expect(ws(s, id).spam).toEqual({ on: true, spamBox: true, autoDelete: false, score: 6 });
    ok(mail.setSpamFilter(s, id, { on: false, spamBox: true, autoDelete: true, score: 6 }));
    expect(ws(s, id).spam).toEqual({ on: false, spamBox: false, autoDelete: false, score: 6 });
  });

  it("sends less mail from the server once a mailbox is deleted", () => {
    const { s, host, id } = account();
    expect(mailboxesOf(s, id, 3)).toBe(3);
    ok(web.deleteMailbox(s, id, "info@sockenshop.de"));
    expect(mailboxesOf(s, id, 3)).toBe(2);
    ok(web.createMailbox(s, id, "shop", "sockenshop.de", "s3cret!", 250));
    expect(mailboxesOf(s, id, 3)).toBe(3);
    ok(web.deleteMailbox(s, id, "shop@sockenshop.de"));
    addressTick(s);
    const addr = mailAddress(s, host)!;
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.id === addr.id ? { ...a, listed: true } : a)) };
    mailQueueTick(s);
    expect(mailStateOf(s, addr.id).deferred).toBe(2 * mailsPerBox(2010));
  });
});

describe("FTP", () => {
  function ftp(year = 2010) {
    const a = account(year);
    ok(web.createFtpAccount(a.s, a.id, "dev", "sockenshop.de", "s3cret!", "public_html", 0));
    return a;
  }

  it("signs in by domain with the right password and refuses the wrong one", () => {
    const { s, id } = ftp();
    expect(ftpLogin(s, "ftp.sockenshop.de", "dev@sockenshop.de", "s3cret!", 21)).toMatchObject({ ok: true, workloadId: id, folder: "public_html", daemon: "pureeFtpd" });
    expect(ftpLogin(s, "sockenshop.de", "dev@sockenshop.de", "wrong", 21)).toMatchObject({ ok: false, error: "login" });
    expect(ftpLogin(s, "sockenshop.de", "nobody@sockenshop.de", "s3cret!", 21)).toMatchObject({ ok: false, error: "login" });
    expect(ftpLogin(s, "unknown.example", "dev@sockenshop.de", "s3cret!", 21)).toMatchObject({ ok: false, error: "resolve" });
    expect(ftpLogin(s, "sockenshop.de", "dev@sockenshop.de", "s3cret!", 2121)).toMatchObject({ ok: false, error: "timeout" });
  });

  it("offers SFTP only from its year", () => {
    expect(ftpLogin(ftp(2006).s, "sockenshop.de", "dev@sockenshop.de", "s3cret!", 22, true)).toMatchObject({ ok: false, error: "timeout" });
    expect(ftpLogin(ftp(SFTP_YEAR).s, "sockenshop.de", "dev@sockenshop.de", "s3cret!", 22, true)).toMatchObject({ ok: true });
  });

  it("uploads from Downloads through the File Manager's upload, within the account's folder and quota", () => {
    const { s, id } = ftp();
    const wp = archiveNamed("wordpass-latest.tar.gz")!;
    s.media.files = [wp.name];
    ok(web.createFolder(s, id, "public_html", "shop"));
    ok(web.createFtpAccount(s, id, "tiny", "sockenshop.de", "s3cret!", "public_html/shop", Math.floor(wp.mb / 2)));
    ok(web.createFtpAccount(s, id, "small", "sockenshop.de", "s3cret!", "public_html/shop", Math.ceil(wp.mb) + 1));
    expect(err(mail.ftpUpload(s, id, "small@sockenshop.de", "public_html", wp.name))).toBe("webspace.error.noFolder");
    expect(err(mail.ftpUpload(s, id, "small@sockenshop.de", "public_html/shop", "missing.zip"))).toBe("webspace.error.noDownload");
    expect(err(mail.ftpUpload(s, id, "tiny@sockenshop.de", "public_html/shop", wp.name))).toBe("webspace.error.ftpQuota");
    expect(ok(mail.ftpUpload(s, id, "small@sockenshop.de", "public_html/shop", wp.name))).toBe(`public_html/shop/${wp.name}`);
    expect(ok(mail.ftpUpload(s, id, "small@sockenshop.de", "public_html/shop", wp.name))).toBe(`public_html/shop/${wp.name}`);
    expect(ws(s, id).files[`public_html/shop/${wp.name}`]).toMatchObject({ mb: wp.mb });
    expect(err(mail.ftpUpload(s, id, "nobody@sockenshop.de", "public_html", wp.name))).toBe("webspace.error.noFtp");
  });
});

describe("FileGorilla", () => {
  it("downloads for a while, then installs into the dock", () => {
    const s = withServer(newGame(3));
    const p = programById("FileGorilla")!;
    expect(installerFile(p, 2005)).toBe("FileGorilla_2.2.15.dmg");
    expect(programRelease(p, 2012).version).toBe("3.5.3");
    expect(err(installProgram(s, "FileGorilla"))).toBe("error.booksNotDownloaded");
    ok(downloadProgram(s, "FileGorilla"));
    expect(err(downloadProgram(s, "FileGorilla"))).toBe("error.programDownloaded");
    expect(err(installProgram(s, "FileGorilla"))).toBe("error.booksDownloading");
    s.hour = s.installers.FileGorilla.readyAt;
    ok(installProgram(s, "FileGorilla"));
    expect(s.installed).toContain("FileGorilla");
    expect(deserialize(serialize(s)).installers.FileGorilla).toBeDefined();
  });

  it("loads a save from before installers with none", () => {
    const s = newGame(3), raw = JSON.parse(serialize(s));
    delete raw.installers;
    expect(deserialize(JSON.stringify(raw)).installers).toEqual({});
  });
});
