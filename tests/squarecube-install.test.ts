import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { squarecubeFeatures } from "../src/sim/10-catalog/squarecube";
import { versionAt } from "../src/sim/10-catalog/software-versions";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { consoleAt } from "../src/sim/80-business/consoles";
import { advisorChecks } from "../src/sim/80-business/readouts";
import { imapUp, installedWebmail, installerLeft, webmailSignIn } from "../src/sim/80-business/webmail";
import { configureWebmail, disableWebmailInstaller, setWebmailDefault } from "../src/sim/90-actions/mail-server";
import { installSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf, run, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const at = (s: GameState, ym: string) => { s.hour = Math.max(s.hour, hourOfMonth(ym)); };
const flagged = (s: GameState, id: string) => advisorChecks(s, cluster(s, id)).checks.some((x) => x.kind === "installer");

// A Postfixit VM with the mailbox sales@ on it, in the month given.
function mailVm(ym: string, seed = 4) {
  const s = readyGame(seed), mail = selfHosted(s), vm = cluster(s, mail).vm!;
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  at(s, ym);
  return { s, mail, vm };
}
function withSquarecube(seed = 4) {
  const { s, mail, vm } = mailVm("2008-03", seed), web = idOf(installSoftware(s, vm, "squarecube"));
  run(s, 2);
  return { s, mail, vm, web };
}

describe("Squarecube install", () => {
  it("is not installable before its first release in March 2008", () => {
    const { s, vm } = mailVm("2008-02");
    expect(err(installSoftware(s, vm, "squarecube"))).toBe("error.softwareNotYet");
    at(s, "2008-03");
    expect(err(installSoftware(s, vm, "squarecube"))).toBe("ok");
    expect(versionAt("squarecube", hourOfMonth("2008-03")).version).toBe("0.1");
    expect(versionAt("squarecube", hourOfMonth("2012-09")).version).toBe("0.8");
  });

  it("waits for its installer, which stays flagged until it is disabled", () => {
    const { s, mail, web } = withSquarecube();
    const c = cluster(s, web);
    expect(c.backend).toBe(mail);
    expect(c.setupPending).toBe(true);
    expect(s.webmail.installs[web]).toMatchObject({ productName: "Squarecube Webmail", imapHost: "localhost", plugins: [], installerOpen: true });
    expect(flagged(s, web)).toBe(true);
    expect(err(configureWebmail(s, web, { productName: "Hosttoast Mail" }))).toBe("ok");
    expect(cluster(s, web).setupPending).toBe(false);
    expect(imapUp(s, cluster(s, web))).toBe(true);
    expect(webmailSignIn(s, cluster(s, web), "sales", "hunter22")).toMatchObject({ ok: true });
    expect(installerLeft(s, web)).toBe(true);
    expect(err(disableWebmailInstaller(s, web))).toBe("ok");
    expect(flagged(s, web)).toBe(false);
    expect(err(disableWebmailInstaller(s, web))).toBe("error.unknownCluster");
  });

  it("shares one machine with SquirrelMeal, and the first installed answers until another is picked", () => {
    const { s, vm } = mailVm("2008-03");
    const squirrel = idOf(installSoftware(s, vm, "squirrelmeal")), cube = idOf(installSoftware(s, vm, "squarecube"));
    run(s, 2);
    const host = s.workloads.find((w) => w.id === vm)!.hostname!;
    expect(consoleAt(s, host, "", "/squarecube/installer/")?.id).toBe(cube);
    expect(consoleAt(s, host, "", "/squirrelmeal/src/login.php")?.id).toBe(squirrel);
    expect(installedWebmail(s)).toBe("squirrelmeal");
    expect(resolve(s, `webmail.${s.company.domain}/`).page).toMatchObject({ kind: "console", clusterId: squirrel });
    expect(err(setWebmailDefault(s, cube))).toBe("ok");
    expect(installedWebmail(s)).toBe("squarecube");
    expect(resolve(s, `webmail.${s.company.domain}/installer/`).page).toMatchObject({ kind: "console", clusterId: cube });
  });

  it("gates features by version, never by year", () => {
    expect(squarecubeFeatures("0.1")).toMatchObject({ vcard: false, threads: false, filters: false, skins: ["classic"] });
    expect(squarecubeFeatures("0.4")).toMatchObject({ threads: true, groups: true, copy: true, filters: true, vacation: false });
    expect(squarecubeFeatures("0.8").skins).toEqual(["barry", "classic"]);
    expect(squarecubeFeatures("1.1")).toMatchObject({ vacation: true, multiFolderSearch: true, skins: ["barry"] });
    expect(squarecubeFeatures("1.7")).toMatchObject({ collected: true, darkTheme: true, skins: ["plastic"] });
  });

  it("keeps the installer state in saves and loads installs saved without it", () => {
    const { s, web } = withSquarecube();
    expect(deserialize(serialize(s)).webmail.installs[web].installerOpen).toBe(true);
    const raw = JSON.parse(serialize(s));
    delete raw.webmail.installs[web].installerOpen;
    expect(installerLeft(deserialize(JSON.stringify(raw)), web)).toBe(false);
  });
});
