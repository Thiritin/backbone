import { afterEach, describe, expect, it } from "vitest";
import { nowMinutes, yearOf } from "../src/sim/00-core/time";
import { mailBuild, MAIL_BUILDS } from "../src/sim/10-catalog/pear-mail";
import { mailServersOf } from "../src/sim/10-catalog/mail-providers";
import { tenantOf } from "../src/sim/42-mail/address";
import { mailHooks } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import type { MailAccount } from "../src/sim/42-mail/types";
import { checkAccount, clientError } from "../src/sim/43-pear-mail/check";
import { clientAccount, localFolder, MY_PEAR, newPearMail } from "../src/sim/43-pear-mail/state";
import { clientFolder } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { createMailAccount, deleteMailAccount } from "../src/sim/90-actions/mailbox";
import { createPearFolder, dismissPearWelcome, editClientAccount, removeClientAccount, transferMessages } from "../src/sim/90-actions/pear-mail";
import { removeSignature, saveSignature, seePearBuild, setPearPref } from "../src/sim/90-actions/pear-prefs";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const original = mailHooks.mxTarget;
afterEach(() => { mailHooks.mxTarget = original; });
const to = (a: MailAccount) => `${a.local}@${a.domain}`;
const hostOf = (s: GameState, a: MailAccount, host = tenantOf(s, a)!.host) => mailServersOf(host, a.domain, yearOf(s.hour)).imap!.host;
// Sales as cl1 over IMAP set up automatically, as cl2 over the given protocol with a typed host.
function setup(protocol: "imap" | "pop" = "imap") {
  const s = readyGame(3), a = s.mail.accounts.find((x) => x.local === "sales")!, now = nowMinutes(s);
  const o = { accountId: a.id, address: to(a), description: "Sales", fullName: "", password: a.password, protocol };
  s.pearMail.accounts.push(clientAccount("cl1", { ...o, protocol: "imap" }, now));
  const host = mailServersOf(tenantOf(s, a)!.host, a.domain, yearOf(s.hour))[protocol]!.host;
  s.pearMail.accounts.push({ ...clientAccount("cl2", o, now), server: { host, port: 993, tls: true } });
  return { s, a };
}
function arrive(s: GameState, a: MailAccount, subject: string): void {
  s.minute += 1;
  deliver(s, { to: to(a), from: "n:Customer", kind: "staff", topic: "x", own: { subject, text: "Hello" } });
  s.minute += 1;
}
const idOf = (r: ActionResult): string => { if (!r.ok || !r.id) throw new Error(r.ok ? "no id" : r.error); return r.id; };
const acct = (s: GameState, id: string) => s.pearMail.accounts.find((c) => c.id === id)!;
const subjects = (s: GameState, id: string, f = "inbox") => clientFolder(s, acct(s, id), f).map((m) => m.own?.subject);

describe("Pear Mail account lifecycle", () => {
  it("keeps an automatic account checking after a provider switch and breaks a typed host until it is edited", () => {
    const { s, a } = setup();
    expect(clientError(s, acct(s, "cl1"))).toBeNull();
    expect(clientError(s, acct(s, "cl2"))).toBeNull();
    // Ionose to GMix Pro; the switch moves the domain's MX with the mailbox.
    const t = tenantOf(s, a)!;
    expect(t.host).toBe("ionose");
    t.host = "gmix";
    t.plan = "pro";
    mailHooks.mxTarget = () => t;
    expect(clientError(s, acct(s, "cl1"))).toBeNull();
    expect(clientError(s, acct(s, "cl2"))).toBe("error.mailNoBox");
    expect(editClientAccount(s, "cl2", { host: hostOf(s, a) }).ok).toBe(true);
    expect(clientError(s, acct(s, "cl2"))).toBeNull();
  });

  it("fails the check of a mailbox deleted on the server and keeps downloaded POP mail", () => {
    const { s, a } = setup();
    const id = idOf(createMailAccount(s, { tenant: a.tenant, local: "office", title: "Office", password: "Office-Pass-2005" }));
    const box = s.mail.accounts.find((x) => x.id === id)!;
    s.pearMail.accounts.push(clientAccount("cl3", { accountId: box.id, address: to(box), description: "Office", fullName: "", password: box.password, protocol: "pop" }, nowMinutes(s)));
    arrive(s, box, "Kept");
    checkAccount(s, "cl3", false);
    expect(subjects(s, "cl3")).toContain("Kept");
    expect(deleteMailAccount(s, box.id).ok).toBe(true);
    s.minute += 10;
    checkAccount(s, "cl3", false);
    expect(s.pearMail.activity.at(-1)).toMatchObject({ clientId: "cl3", error: "error.mailNoBox" });
    expect(subjects(s, "cl3")).toContain("Kept");
  });

  it("leaves a closed mailbox readable and keeps a message dragged to On My Pear", () => {
    const { s, a } = setup();
    arrive(s, a, "Contract");
    checkAccount(s, "cl1", false);
    s.mail.accounts.find((x) => x.id === a.id)!.closedAt = nowMinutes(s);
    expect(clientError(s, acct(s, "cl1"))).toBe("error.mailClosed");
    const m = clientFolder(s, acct(s, "cl1"), "inbox").find((x) => x.own?.subject === "Contract")!;
    expect(m).toBeDefined();
    const folder = idOf(createPearFolder(s, "Archive", null));
    expect(transferMessages(s, "cl1", [m.id], MY_PEAR, folder).ok).toBe(true);
    expect(s.pearMail.local.messages.some((x) => x.folder === localFolder(MY_PEAR, folder) && x.own?.subject === "Contract")).toBe(true);
  });

  it("removes a POP account with and without a copy in On My Pear", () => {
    for (const keep of [true, false]) {
      const { s, a } = setup("pop");
      arrive(s, a, "Order");
      checkAccount(s, "cl2", false);
      setPearPref(s, { defaultFrom: "cl2" });
      expect(removeClientAccount(s, "cl2", keep).ok).toBe(true);
      expect(s.pearMail.local.messages.some((m) => m.own?.subject === "Order")).toBe(keep);
      expect(s.pearMail.local.folders.length).toBe(keep ? 1 : 0);
      expect(s.pearMail.prefs.defaultFrom).toBeNull();
      expect(s.mail.accounts.some((x) => x.id === a.id)).toBe(true);
    }
  });

  it("stores preferences and refuses an unknown size or account", () => {
    const { s } = setup();
    expect(setPearPref(s, { sound: false, listSize: 14, ccSelf: "bcc", defaultFrom: "cl2" }).ok).toBe(true);
    expect(s.pearMail.prefs).toMatchObject({ sound: false, listSize: 14, ccSelf: "bcc", defaultFrom: "cl2", quote: true });
    expect(setPearPref(s, { msgSize: 99 }).ok).toBe(false);
    expect(setPearPref(s, { defaultFrom: "cl9" }).ok).toBe(false);
  });

  it("saves, edits and removes signatures, and an account loses a removed default", () => {
    const { s } = setup();
    const id = idOf(saveSignature(s, { name: "Work", text: "Regards\nSales" }));
    expect(editClientAccount(s, "cl1", { signature: id, storeSent: false }).ok).toBe(true);
    expect(acct(s, "cl1")).toMatchObject({ signature: id, storeSent: false });
    expect(editClientAccount(s, "cl1", { signature: "sg0" }).ok).toBe(false);
    saveSignature(s, { id: id, name: "Work", text: "Thanks" });
    expect(s.pearMail.signatures).toEqual([{ id: id, name: "Work", text: "Thanks" }]);
    expect(removeSignature(s, id).ok).toBe(true);
    expect(s.pearMail.signatures).toEqual([]);
    expect(acct(s, "cl1").signature).toBeNull();
  });

  it("shows What's new once per build", () => {
    const { s } = setup();
    const version = mailBuild(s.os, s.hour).version;
    s.pearMail.seenBuild = "";
    seePearBuild(s);
    expect(s.pearMail.seenBuild).toBe(version);
    s.pearMail = { ...s.pearMail, welcomed: false, seenBuild: "" };
    dismissPearWelcome(s);
    expect(s.pearMail.seenBuild).toBe(version);
    expect(MAIL_BUILDS.some((b) => b.version === version)).toBe(true);
  });

  it("loads a save without preferences or signatures with the defaults", () => {
    const { s } = setup();
    const raw = JSON.parse(serialize(s));
    delete raw.pearMail.prefs;
    delete raw.pearMail.signatures;
    const back = deserialize(JSON.stringify(raw));
    expect(back.pearMail.prefs).toEqual(newPearMail().prefs);
    expect(back.pearMail.signatures).toEqual([]);
    raw.pearMail.prefs = { sound: false };
    expect(deserialize(JSON.stringify(raw)).pearMail.prefs).toEqual({ ...newPearMail().prefs, sound: false });
  });
});
