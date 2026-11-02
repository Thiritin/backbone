import { afterEach, describe, expect, it } from "vitest";
import { hourOfMonth, yearOf } from "../src/sim/00-core/time";
import { mailServersOf } from "../src/sim/10-catalog/mail-providers";
import { MAIL_LOGIN } from "../src/sim/42-mail/accounts";
import { tenantOf } from "../src/sim/42-mail/address";
import { mailHooks } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import type { MailAccount } from "../src/sim/42-mail/types";
import { clientError, pearMailTick } from "../src/sim/43-pear-mail/check";
import { draftClient, type AccountInput } from "../src/sim/43-pear-mail/setup";
import { MY_PEAR, localFolder } from "../src/sim/43-pear-mail/state";
import { clientFolder } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import { checkDone } from "../src/sim/checklist";
import { editClientAccount, removeClientAccount, setAccountEnabled, setupClientAccount } from "../src/sim/90-actions/pear-mail";
import { savedPassword } from "../src/ui/apps/pear-mail/Assistant";
import { newGame, readyGame } from "./fixtures";

const addressOf = (a: MailAccount) => `${a.local}@${a.domain}`;
const hostOf = (s: GameState, a: MailAccount, p: "imap" | "pop" | "smtp") => mailServersOf(tenantOf(s, a)!.host, a.domain, yearOf(s.hour))[p]!.host;
// A fresh game on the start GMix FreeMix mailbox, at the month given, with external programs allowed.
function gmix(month = "2005-03") {
  const s = newGame(1), a = s.mail.accounts[0];
  s.hour = hourOfMonth(month);
  s.installed.push("Pear Mail");
  a.external = true;
  return { s, a };
}
const input = (s: GameState, a: MailAccount, p: "imap" | "pop", extra: Partial<AccountInput> = {}): AccountInput =>
  ({ fullName: "Owner", address: addressOf(a), password: a.password, protocol: p, host: hostOf(s, a, p), smtp: hostOf(s, a, "smtp"), ...extra });
const verify = (s: GameState, i: AccountInput) => clientError(s, draftClient(s, "", i));
const err = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);
const original = mailHooks.mxTarget;
afterEach(() => { mailHooks.mxTarget = original; });

describe("Pear Mail Add Account", () => {
  it("refuses IMAP on GMix FreeMix before 2012 and accepts it from then, and ProMix at once", () => {
    const early = gmix("2006-03");
    expect(verify(early.s, input(early.s, early.a, "imap"))).toBe("error.mailProtocol");
    expect(verify(early.s, input(early.s, early.a, "pop"))).toBeNull();
    const late = gmix("2012-02");
    expect(verify(late.s, input(late.s, late.a, "imap"))).toBeNull();
    const pro = gmix("2006-03");
    tenantOf(pro.s, pro.a)!.plan = "pro";
    expect(verify(pro.s, input(pro.s, pro.a, "imap"))).toBeNull();
  });

  it("fails a wrong password and passes the right one", () => {
    const { s, a } = gmix();
    expect(verify(s, input(s, a, "pop", { password: "nope" }))).toBe("error.mailAuth");
    expect(verify(s, input(s, a, "pop"))).toBeNull();
  });

  it("fills the password from KeePassive only once it is installed", () => {
    const { s, a } = gmix();
    s.logins[MAIL_LOGIN(addressOf(a))] = [addressOf(a), a.password];
    expect(savedPassword(s, addressOf(a))).toBe("");
    s.installed.push("keepassive");
    expect(savedPassword(s, addressOf(a))).toBe(a.password);
    expect(savedPassword(s, "someone@else.example")).toBe("");
  });

  it("names a wrong host, an address the host does not hold and a closed external access", () => {
    const { s, a } = gmix();
    expect(verify(s, input(s, a, "pop", { host: "pop.gmix.org" }))).toBe("error.mailServer");
    expect(verify(s, input(s, a, "pop", { host: hostOf(s, a, "imap") }))).toBe("error.mailServer");
    expect(verify(s, input(s, a, "pop", { host: "pop.ionose.de" }))).toBe("error.mailNoBox");
    expect(verify(s, input(s, a, "pop", { address: `nobody-${a.local}@${a.domain}` }))).toBe("error.mailNoBox");
    a.external = false;
    expect(verify(s, input(s, a, "pop"))).toBe("error.mailExternal");
  });

  it("reports the own server off and a domain whose mail does not reach the provider", () => {
    const s = readyGame(1), a = s.mail.accounts.find((x) => x.local === "sales")!;
    expect(verify(s, input(s, a, "imap"))).toBeNull();
    mailHooks.mxTarget = () => null;
    expect(verify(s, input(s, a, "imap"))).toBe("error.mailDns");
    mailHooks.mxTarget = original;
    const t = tenantOf(s, a)!;
    t.host = "self";
    t.clusterId = undefined;
    expect(verify(s, input(s, a, "imap", { host: `mail.${a.domain}` }))).toBe("error.mailDown");
  });

  it("stores the account, downloads the Inbox and keeps checking on its interval", () => {
    const { s, a } = gmix();
    const r = setupClientAccount(s, input(s, a, "pop"));
    expect(r.ok).toBe(true);
    const c = s.pearMail.accounts[0];
    expect(c).toMatchObject({ id: r.id, address: addressOf(a), protocol: "pop", server: { host: "pop.gmix.net" }, enabled: true });
    expect(c.checkEvery).toBeGreaterThanOrEqual(15);
    expect(clientFolder(s, c, "inbox").length).toBeGreaterThan(0);
    expect(listFolder(s, a.id, "inbox")).toHaveLength(0);
    expect(checkDone(s, "pearMail")).toBe(true);
    s.minute += 1;
    const id = deliver(s, { to: addressOf(a), from: "n:Dwell", kind: "order", topic: "x" }).id!;
    s.hour += 1;
    pearMailTick(s);
    expect(s.pearMail.local.messages.some((m) => m.origin === c.id && m.topic === "x")).toBe(true);
    expect(listFolder(s, a.id, "inbox").map((m) => m.id)).not.toContain(id);
    expect(s.pearMail.activity.at(-1)).toMatchObject({ clientId: c.id, count: 1 });
  });

  it("refuses a duplicate and keeps an account added in error", () => {
    const { s, a } = gmix();
    a.external = false;
    expect(setupClientAccount(s, input(s, a, "pop")).ok).toBe(true);
    expect(clientError(s, s.pearMail.accounts[0])).toBe("error.mailExternal");
    expect(s.pearMail.activity.at(-1)?.error).toBe("error.mailExternal");
    expect(err(setupClientAccount(s, input(s, a, "pop", { address: addressOf(a).toUpperCase() })))).toBe("error.mailDuplicate");
    expect(s.pearMail.accounts).toHaveLength(1);
  });

  it("sets up automatically only from Pear Mail 3", () => {
    const { s, a } = gmix("2009-03");
    const auto = input(s, a, "imap", { host: "", smtp: "" });
    expect(err(setupClientAccount(s, auto))).toBe("error.mailFeature");
    s.os = "leopard";
    expect(setupClientAccount(s, auto).ok).toBe(true);
    expect(s.pearMail.accounts[0]).toMatchObject({ protocol: "pop", server: null });
    expect(clientError(s, s.pearMail.accounts[0])).toBeNull();
  });

  it("fixes an account through its settings and leaves the unified mailboxes when disabled", () => {
    const { s, a } = gmix();
    setupClientAccount(s, input(s, a, "pop", { host: "pop.gmix.org" }));
    const id = s.pearMail.accounts[0].id;
    expect(clientError(s, s.pearMail.accounts[0])).toBe("error.mailServer");
    expect(editClientAccount(s, id, { host: "pop.gmix.net" }).ok).toBe(true);
    expect(clientError(s, s.pearMail.accounts[0])).toBeNull();
    expect(err(editClientAccount(s, id, { checkEvery: 7 }))).toBe("error.mailUnknown");
    setAccountEnabled(s, id, false);
    const before = s.pearMail.activity.length;
    s.hour += 1;
    pearMailTick(s);
    expect(s.pearMail.activity).toHaveLength(before);
  });

  it("removes a POP account with or without a copy of its mail in On My Pear", () => {
    for (const keep of [true, false]) {
      const { s, a } = gmix();
      setupClientAccount(s, input(s, a, "pop", { description: "Owner" }));
      const c = s.pearMail.accounts[0], n = clientFolder(s, c, "inbox").length;
      expect(n).toBeGreaterThan(0);
      expect(removeClientAccount(s, c.id, keep).ok).toBe(true);
      expect(s.pearMail.accounts).toHaveLength(0);
      const kept = s.pearMail.local.folders.find((f) => f.name === "Owner");
      expect(!!kept).toBe(keep);
      expect(s.pearMail.local.messages.filter((m) => kept && m.folder === localFolder(MY_PEAR, kept.id))).toHaveLength(keep ? n : 0);
      expect(s.pearMail.local.messages.filter((m) => m.folder.startsWith(localFolder(c.id, "")))).toHaveLength(0);
    }
  });
});
