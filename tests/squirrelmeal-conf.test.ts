import { describe, expect, it } from "vitest";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { treeOf } from "../src/sim/60-infra/fs";
import { CONF_PL, confLine, type ConfMenu } from "../src/sim/60-infra/squirrel-conf";
import { runLine, type Session } from "../src/sim/60-infra/terminal";
import { CONFIG_PHP, webmailSignIn } from "../src/sim/80-business/webmail";
import type { Call } from "../src/sim/90-actions/index";
import { installSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { idOf, run, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const act = (s: GameState) => ([fn, ...args]: Call) => fn(s, ...args);
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

// SquirrelMeal beside Postfixit on one VM, a mailbox sales@ on it, and an ssh session there.
function setup(seed = 4) {
  const s = readyGame(seed), mail = selfHosted(s), vm = cluster(s, mail).vm!;
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  const web = idOf(installSoftware(s, vm, "squirrelmeal"));
  run(s, 2);
  const at: Session = { host: "mail", deviceId: vm };
  return { s, vm, web, at };
}

// Opens conf.pl and types each line into it; the last screen and the menu it leaves.
function drive(s: GameState, at: Session, open: string, typed: string[]): { out: string; menu: ConfMenu | null } {
  const r = runLine(() => s, act(s), at, null, open);
  let menu = r.menu, out = r.output.join("\n");
  for (const line of typed) {
    const step = confLine(() => s, act(s), menu!, line);
    out = step.output.join("\n");
    menu = step.menu;
  }
  return { out, menu };
}

describe("SquirrelMeal conf.pl", () => {
  it("opens the main menu over ssh from config_default.php", () => {
    const { s, at } = setup();
    const { out, menu } = drive(s, at, "sudo squirrelmeal-configure", []);
    expect(out).toContain("SquirrelMeal Configuration : Read: config_default.php (1.4.0)");
    expect(out).toContain("10. Languages");
    expect(menu?.screen).toBe("main");
    expect(drive(s, at, CONF_PL, []).menu).not.toBeNull();
  });

  it("sets the IMAP server, saves config.php and quits", () => {
    const { s, vm, web, at } = setup();
    expect(cluster(s, web).setupPending).toBe(true);
    const edit = drive(s, at, "squirrelmeal-configure", ["2", "A", "3"]);
    expect(edit.out).toContain("This is the hostname where your IMAP server can be contacted.");
    const saved = drive(s, at, "squirrelmeal-configure", ["2", "A", "3", "mail.example.org", "S"]);
    expect(saved.out).toBe("Data saved in config.php");
    expect(s.webmail.installs[web].imapHost).toBe("mail.example.org");
    expect(cluster(s, web).setupPending).toBe(false);
    expect(treeOf(s, vm)[CONFIG_PHP]).toContain("$imapServerAddress                = 'mail.example.org';");
    expect(webmailSignIn(s, cluster(s, web), "sales", "hunter22")).toEqual({ ok: false, error: "refused" });
    const quit = drive(s, at, "squirrelmeal-configure", ["2", "A", "3", "localhost", "S", "", "Q"]);
    expect(quit.menu).toBeNull();
    expect(quit.out).toContain("Happy SquirrelMealing!");
    expect(webmailSignIn(s, cluster(s, web), "sales", "hunter22")).toMatchObject({ ok: true });
  });

  it("asks to save on quit, and the D presets set the server type", () => {
    const { s, web, at } = setup();
    const asked = drive(s, at, "squirrelmeal-configure", ["D", "dovecoat", "", "Q"]);
    expect(asked.out).toBe("You have not saved your data.");
    expect(asked.menu?.draft.conf.imap_server_type).toBe("dovecoat");
    expect(drive(s, at, "squirrelmeal-configure", ["D", "dovecoat", "", "Q", "n"]).menu).toBeNull();
    expect(cluster(s, web).setupPending).toBe(true);
    drive(s, at, "squirrelmeal-configure", ["D", "dovecoat", "", "Q", "y"]);
    expect(s.webmail.installs[web].conf).toMatchObject({ imap_server_type: "dovecoat", trash_folder: "Trash" });
    expect(cluster(s, web).setupPending).toBe(false);
  });

  it("toggles plugins and loads a save from before conf", () => {
    const { s, web, at } = setup();
    drive(s, at, "squirrelmeal-configure", ["8", "1", "S"]);
    expect(s.webmail.installs[web].plugins).toEqual(["squirrelspelt"]);
    const raw = JSON.parse(serialize(s));
    delete raw.webmail.installs[web].conf;
    expect(deserialize(JSON.stringify(raw)).webmail.installs[web].conf).toEqual({});
  });
});
