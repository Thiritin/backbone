import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { subscribed, webmailPref, webmailSignIn, webmailUser } from "../src/sim/80-business/webmail";
import {
  configureWebmail, deleteWebmailMessages, removeContact, runLocalFilters, saveContact, saveIdentity, saveLocalFilter, setFolderSubscribed, setWebmailPref,
} from "../src/sim/90-actions/mail-server";
import { changePassword } from "../src/sim/90-actions/mailbox";
import { createMailFolder } from "../src/sim/90-actions/mailmsg";
import { installSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf, run, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

// SquirrelMeal configured beside Postfixit, with the mailbox sales@ signed in.
function signedIn(seed = 4) {
  const s = readyGame(seed), mail = selfHosted(s), vm = cluster(s, mail).vm!;
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  const web = idOf(installSoftware(s, vm, "squirrelmeal"));
  run(s, 2);
  expect(err(configureWebmail(s, web, {}))).toBe("ok");
  const r = webmailSignIn(s, cluster(s, web), "sales", "hunter22");
  if (!r.ok) throw new Error(r.error);
  return { s, web, acc: r.account, address: `sales@${s.company.domain}` };
}
const mailTo = (s: GameState, to: string, from: string, subject: string) => deliver(s, { to, from: `ext:${from}`, kind: "reply", topic: "", own: { subject, text: "hi" } });
const ids = (s: GameState, acc: string, folder: string) => listFolder(s, acc, folder).map((m) => m.id);

describe("SquirrelMeal mailbox", () => {
  it("moves a deleted message to Trash and removes it from Trash", () => {
    const { s, web, acc, address } = signedIn();
    mailTo(s, address, "a@example.com", "One");
    const [id] = ids(s, acc, "inbox");
    expect(err(deleteWebmailMessages(s, web, acc, [id]))).toBe("ok");
    expect(ids(s, acc, "trash")).toContain(id);
    deleteWebmailMessages(s, web, acc, [id]);
    expect((s.mail.msgs[acc] ?? []).some((m) => m.id === id)).toBe(false);
  });

  it("removes at once with Do not use Trash and moves to a custom Trash folder", () => {
    const { s, web, acc, address } = signedIn();
    mailTo(s, address, "a@example.com", "One");
    mailTo(s, address, "a@example.com", "Two");
    const [two, one] = ids(s, acc, "inbox");
    const bin = idOf(createMailFolder(s, acc, "Bin"));
    setWebmailPref(s, web, acc, "trash", bin);
    deleteWebmailMessages(s, web, acc, [one]);
    expect(ids(s, acc, bin)).toEqual([one]);
    setWebmailPref(s, web, acc, "trash", "");
    deleteWebmailMessages(s, web, acc, [two]);
    expect((s.mail.msgs[acc] ?? []).some((m) => m.id === two)).toBe(false);
    expect(ids(s, acc, "trash")).toEqual([]);
  });

  it("sorts with Message Filters only when the Inbox is opened, over mail since the last run", () => {
    const { s, web, acc, address } = signedIn();
    const lists = idOf(createMailFolder(s, acc, "Lists"));
    mailTo(s, address, "news@example.com", "Early");
    runLocalFilters(s, web, acc);
    expect(err(saveLocalFilter(s, web, acc, { field: "from", text: "news@", folder: lists }))).toBe("ok");
    run(s, 1);
    mailTo(s, address, "news@example.com", "Late");
    mailTo(s, address, "boss@example.com", "Stay");
    expect(ids(s, acc, lists)).toEqual([]);
    runLocalFilters(s, web, acc);
    expect(listFolder(s, acc, lists).map((m) => m.own?.subject)).toEqual(["Late"]);
    expect(listFolder(s, acc, "inbox").flatMap((m) => m.own?.subject ?? []).sort()).toEqual(["Early", "Stay"]);
  });

  it("refuses a filter into a missing folder and runs none with the plugin off", () => {
    const { s, web, acc } = signedIn();
    expect(err(saveLocalFilter(s, web, acc, { field: "subject", text: "x", folder: "nope" }))).toBe("error.mailNoFolder");
    configureWebmail(s, web, { plugins: [] });
    expect(err(runLocalFilters(s, web, acc))).toBe("error.webmailConfig");
  });

  it("changes the password only with the old one", () => {
    const { s, web, acc } = signedIn();
    expect(err(changePassword(s, acc, "wrong", "newpass1"))).toBe("error.mailLogin");
    expect(err(changePassword(s, acc, "hunter22", "newpass1"))).toBe("ok");
    expect(webmailSignIn(s, cluster(s, web), "sales", "newpass1").ok).toBe(true);
  });

  it("blocks the login with a wrong IMAP server and shows the real error for a wrong password", () => {
    const { s, web } = signedIn();
    const bad = webmailSignIn(s, cluster(s, web), "sales", "nope");
    expect(bad).toEqual({ ok: false, error: "badLogin" });
    expect(t("mailserver.login.bad")).toBe("Unknown user or password incorrect.");
    configureWebmail(s, web, { imapHost: "mail.nowhere.example" });
    expect(webmailSignIn(s, cluster(s, web), "sales", "hunter22")).toEqual({ ok: false, error: "refused" });
  });

  it("keeps identities, contacts, preferences and subscriptions per account", () => {
    const { s, web, acc, address } = signedIn();
    expect(webmailUser(s, web, acc).identities[0].email).toBe(address);
    expect(err(saveIdentity(s, web, acc, null, { name: "Help", email: "help@x", replyTo: "", signature: "" }))).toBe("error.mailAddress");
    saveIdentity(s, web, acc, 0, { name: "Sales Team", email: address, replyTo: "", signature: "-- \nSales" });
    saveContact(s, web, acc, { nick: "bob", name: "Bob", email: "Bob@Example.com", info: "" });
    saveContact(s, web, acc, { nick: "bob", name: "Robert", email: "bob@example.com", info: "" });
    expect(webmailUser(s, web, acc).contacts).toEqual([{ nick: "bob", name: "Robert", email: "bob@example.com", info: "" }]);
    removeContact(s, web, acc, "bob");
    expect(webmailUser(s, web, acc).contacts).toEqual([]);
    expect(webmailPref(webmailUser(s, web, acc), "perPage")).toBe(15);
    setWebmailPref(s, web, acc, "perPage", 25);
    const f = idOf(createMailFolder(s, acc, "Old"));
    setFolderSubscribed(s, acc, f, false);
    const back = deserialize(serialize(s));
    expect(webmailPref(webmailUser(back, web, acc), "perPage")).toBe(25);
    expect(webmailUser(back, web, acc).identities[0].name).toBe("Sales Team");
    expect(subscribed(back, acc, f)).toBe(false);
  });

  it("loads a save from before the mailbox screens", () => {
    const { s, web, acc } = signedIn();
    const data = JSON.parse(serialize(s));
    delete data.webmail.users;
    delete data.webmail.subs;
    const back = deserialize(JSON.stringify(data));
    expect(back.webmail.users).toEqual({});
    expect(webmailUser(back, web, acc).filteredAt).toBe(0);
  });
});
