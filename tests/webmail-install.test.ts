import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { versionAt } from "../src/sim/10-catalog/software-versions";
import { mailHooks } from "../src/sim/42-mail/caps";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { installLog } from "../src/sim/60-infra/apt";
import { resolve } from "../src/sim/80-business/browser";
import { consoleAt, consoleBookmarks } from "../src/sim/80-business/consoles";
import { imapUp, installedWebmail, selfHostCaps, webmailSignIn } from "../src/sim/80-business/webmail";
import { createVm } from "../src/sim/90-actions/clusters";
import { softwareTarget, upgradeSoftware } from "../src/sim/90-actions/console";
import { configureWebmail, setWebmailDefault } from "../src/sim/90-actions/mail-server";
import { installSoftware, setChannel, uninstallSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf, run, selfHosted } from "./company-mail.helpers";
import { bootedMachine, panelVm, readyGame } from "./fixtures";

const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const at = (s: GameState, ym: string) => { s.hour = Math.max(s.hour, hourOfMonth(ym)); };

// A Postfixit VM with SquirrelMeal beside it and a self-hosted mailbox sales@ on it.
function withSquirrel(seed = 4) {
  const s = readyGame(seed), mail = selfHosted(s), vm = cluster(s, mail).vm!;
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  const web = idOf(installSoftware(s, vm, "squirrelmeal"));
  run(s, 2);
  return { s, mail, vm, web };
}

describe("webmail install", () => {
  it("installs SquirrelMeal beside Postfixit and points it at the local server", () => {
    const { s, mail, web } = withSquirrel();
    const c = cluster(s, web);
    expect(c.kind).toBe("mailweb");
    expect(c.backend).toBe(mail);
    expect(c.setupPending).toBe(true);
    expect(s.webmail.installs[web].imapHost).toBe("localhost");
    expect(imapUp(s, c)).toBe(true);
  });

  it("is refused beside Mailpig and a web panel, and shares the web server with Postfixit Admin", () => {
    const { s, vm } = withSquirrel();
    expect(err(installSoftware(s, vm, "postfixitadmin"))).toBe("ok");
    const panel = cluster(s, panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id)).vm!;
    expect(err(installSoftware(s, panel, "squirrelmeal"))).toBe("error.portTaken");
    at(s, "2015-06");
    const pigVm = idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 2, ramGb: 4, diskGb: 40 }));
    const pig = bootedMachine(s, pigVm);
    s.clusters = s.clusters.filter((c) => c.kind !== "mail");
    expect(err(installSoftware(s, pig, "mailpig"))).toBe("ok");
    expect(err(installSoftware(s, pig, "squirrelmeal"))).toBe("error.portTaken");
  });

  it("installs the newest stable release of the month, and Edge takes the development line", () => {
    expect(versionAt("squirrelmeal", hourOfMonth("2007-06")).version).toBe("1.4.10");
    expect(versionAt("squirrelmeal", hourOfMonth("2005-03")).version).toBe("1.4.4");
    expect(versionAt("squirrelmeal", hourOfMonth("2007-06"), true).version).toBe("1.5.1");
    expect(versionAt("squirrelmeal", hourOfMonth("2005-01"), true).version).toBe("1.4.4");
    const { s, vm, web } = withSquirrel();
    const installed = () => s.workloads.find((w) => w.id === vm)!.software!.find((x) => x.id === "squirrelmeal")!.version;
    expect(installed()).toBe(versionAt("squirrelmeal", s.hour).version);
    expect(installed()).not.toBe("1.5.1");
    at(s, "2006-03");
    expect(softwareTarget(s, vm, "squirrelmeal")?.version).not.toBe("1.5.1");
    expect(err(setChannel(s, web, "edge"))).toBe("ok");
    expect(softwareTarget(s, vm, "squirrelmeal")?.version).toBe("1.5.1");
    expect(err(upgradeSoftware(s, vm, "squirrelmeal"))).toBe("ok");
    expect(installed()).toBe("1.5.1");
  });

  it("answers at webmail.<domain> and on its path, and names itself to mail-core", () => {
    const { s, web, vm } = withSquirrel();
    const r = resolve(s, `webmail.${s.company.domain}/`);
    expect(r.page).toMatchObject({ kind: "console", clusterId: web });
    const host = s.workloads.find((w) => w.id === vm)!.hostname!;
    expect(consoleAt(s, host, "", "/squirrelmeal/src/login.php")?.id).toBe(web);
    expect(consoleBookmarks(s).some((b) => b.url.endsWith("/squirrelmeal"))).toBe(true);
    expect(installedWebmail(s)).toBe("squirrelmeal");
    const admin = idOf(installSoftware(s, vm, "postfixitadmin"));
    expect(installedWebmail(s)).toBe("squirrelmeal");
    expect(err(setWebmailDefault(s, admin))).toBe("error.unknownCluster");
    expect(err(uninstallSoftware(s, vm, "squirrelmeal"))).toBe("ok");
    expect(installedWebmail(s)).toBe(null);
    expect(s.webmail.installs[web]).toBeUndefined();
    expect(resolve(s, `webmail.${s.company.domain}/`).page.kind).toBe("notfound");
  });

  it("signs in with the mailbox password once the setup names a reachable IMAP server", () => {
    const { s, web } = withSquirrel();
    const c = () => cluster(s, web);
    expect(webmailSignIn(s, c(), "sales", "hunter22")).toMatchObject({ ok: true });
    expect(webmailSignIn(s, c(), `sales@${s.company.domain}`, "wrong")).toEqual({ ok: false, error: "badLogin" });
    expect(err(configureWebmail(s, web, { imapHost: "mail.example.org" }))).toBe("ok");
    expect(c().backend).toBe(null);
    expect(c().setupPending).toBe(false);
    expect(webmailSignIn(s, c(), "sales", "hunter22")).toEqual({ ok: false, error: "refused" });
    expect(err(configureWebmail(s, web, { imapHost: "localhost", imapPort: 0 }))).toBe("error.webmailConfig");
    expect(err(configureWebmail(s, web, { imapHost: "localhost" }))).toBe("ok");
    expect(webmailSignIn(s, c(), "sales", "hunter22")).toMatchObject({ ok: true });
  });

  it("pulls in Dovecoat with Postfixit and the era's PHP with SquirrelMeal", () => {
    expect(softwareById("postfixit").ports).toEqual(expect.arrayContaining([110, 143, 993, 995]));
    const pf = installLog(softwareById("postfixit"), 2011).join("\n");
    expect(pf).toContain("dovecoat-imapd");
    expect(pf).toContain("dovecoat-sieve");
    expect(installLog(softwareById("postfixit"), 2006).join("\n")).not.toContain("dovecoat-sieve");
    expect(installLog(softwareById("squirrelmeal"), 2006).join("\n")).toContain("php5-imap");
    expect(installLog(softwareById("squirrelmeal"), 2021).join("\n")).toContain("php8.0-imap");
  });

  it("reports what the own server offers", () => {
    const { s } = withSquirrel();
    expect(selfHostCaps(s)).toMatchObject({ imap: true, pop: true, junkBonus: 0 });
  });

  it("loads a save from before webmail with no installs", () => {
    const { s } = withSquirrel();
    const raw = JSON.parse(serialize(s));
    delete raw.webmail;
    expect(deserialize(JSON.stringify(raw)).webmail).toEqual({ installs: {}, default: null });
  });
});

describe("mail-core hooks", () => {
  it("fills installedWebmail and selfHostCaps for the own server", () => {
    const { s } = withSquirrel();
    expect(mailHooks.installedWebmail(s)).toBe("squirrelmeal");
    expect(mailHooks.selfHostCaps(s)).toMatchObject({ imap: true, pop: true });
  });
});
