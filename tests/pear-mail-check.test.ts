import { afterEach, describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { mailHooks } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import { clientError, pearMailTick } from "../src/sim/43-pear-mail/check";
import { clientAccount, type ClientAccount } from "../src/sim/43-pear-mail/state";
import { clientFolder, unreadBadge } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import { tickMinute } from "../src/sim/88-tick/tick";
import { getMail, setClientPassword } from "../src/sim/90-actions/pear-mail";
import { readyGame } from "./fixtures";

const sales = (s: GameState) => s.mail.accounts.find((a) => a.local === "sales")!;
const address = (s: GameState) => `${sales(s).local}@${sales(s).domain}`;
// Pear Mail installed with one account on the sales mailbox, checking every 5 minutes from minute 0.
function setup(protocol: "imap" | "pop", extra: Partial<ClientAccount> = {}) {
  const s = readyGame(1), a = sales(s);
  s.installed.push("Pear Mail");
  s.pearMail.accounts.push({ ...clientAccount("cl900", { accountId: a.id, address: address(s), description: "Sales", fullName: "Sales", password: a.password, protocol }, nowMinutes(s)), ...extra });
  return s;
}
const client = (s: GameState) => s.pearMail.accounts[0];
const mail = (s: GameState, topic = "x") => deliver(s, { to: address(s), from: "n:Dwell", kind: "order", topic }).id!;
// Moves the clock to the minute of the hour and runs the check as the minute tick does.
const at = (s: GameState, minute: number) => { s.hour += Math.floor(minute / 60); s.minute = minute % 60; return pearMailTick(s); };
const server = (s: GameState) => listFolder(s, sales(s).id, "inbox").map((m) => m.id);
const original = mailHooks.mxTarget;
afterEach(() => { mailHooks.mxTarget = original; });

describe("Pear Mail check", () => {
  it("shows an IMAP message at the next check, while webmail has it at once", () => {
    const s = setup("imap");
    at(s, 1);
    const id = mail(s);
    expect(server(s)).toContain(id);
    at(s, 4);
    const badge = unreadBadge(s);
    expect(clientFolder(s, client(s), "inbox").map((m) => m.id)).not.toContain(id);
    at(s, 5);
    expect(clientFolder(s, client(s), "inbox").map((m) => m.id)).toContain(id);
    expect(unreadBadge(s)).toBe(badge + 1);
  });

  it("downloads POP mail at its interval and removes the server copy right away", () => {
    const s = setup("pop");
    at(s, 1);
    const id = mail(s);
    at(s, 4);
    expect(s.pearMail.local.messages).toHaveLength(0);
    at(s, 5);
    expect(s.pearMail.local.messages).toHaveLength(1);
    expect(s.pearMail.local.messages[0]).toMatchObject({ origin: "cl900", folder: "pear:cl900:inbox" });
    expect(server(s)).not.toContain(id);
    expect(unreadBadge(s)).toBe(1);
  });

  it("keeps the server copy unread with never and downloads nothing twice", () => {
    const s = setup("pop", { popRemove: "never" });
    at(s, 1);
    const id = mail(s);
    at(s, 5);
    at(s, 10);
    at(s, 15);
    expect(s.pearMail.local.messages).toHaveLength(1);
    expect(listFolder(s, sales(s).id, "inbox").find((m) => m.id === id)?.read).toBeUndefined();
  });

  it("removes a server copy at its scheduled time", () => {
    const s = setup("pop", { popRemove: "day" });
    at(s, 1);
    const id = mail(s);
    at(s, 5);
    s.hour += 23;
    at(s, 50);
    expect(server(s)).toContain(id);
    at(s, 65);
    expect(server(s)).not.toContain(id);
  });

  it("checks a manual account only on Get Mail", () => {
    const s = setup("imap", { checkEvery: 0 });
    at(s, 1);
    const id = mail(s);
    at(s, 30);
    expect(clientFolder(s, client(s), "inbox").map((m) => m.id)).not.toContain(id);
    expect(getMail(s).ok).toBe(true);
    expect(clientFolder(s, client(s), "inbox").map((m) => m.id)).toContain(id);
  });

  it("checks from the minute tick with no window open and not before Pear Mail is installed", () => {
    const s = setup("imap");
    s.installed = s.installed.filter((x) => x !== "Pear Mail");
    s.minute = 1;
    const id = mail(s);
    for (let i = 0; i < 10; i++) tickMinute(s);
    expect(client(s).syncedAt).toBe(0);
    s.installed.push("Pear Mail");
    for (let i = 0; i < 5; i++) tickMinute(s);
    expect(clientFolder(s, client(s), "inbox").map((m) => m.id)).toContain(id);
  });

  it("sets the warning while the server cannot be reached and clears it at the next good check", () => {
    const s = setup("imap");
    mailHooks.mxTarget = () => null;
    at(s, 5);
    expect(clientError(s, client(s))).toBe("error.mailDns");
    expect(s.pearMail.activity.at(-1)).toMatchObject({ clientId: "cl900", error: "error.mailDns" });
    expect(client(s).syncedAt).toBe(0);
    mailHooks.mxTarget = original;
    at(s, 10);
    expect(clientError(s, client(s))).toBeNull();
    expect(s.pearMail.activity.at(-1)).toMatchObject({ clientId: "cl900", count: 0 });
    expect(s.pearMail.activity.at(-1)?.error).toBeUndefined();
    expect(s.pearMail.activity.filter((l) => l.clientId === "cl900")).toHaveLength(1);
  });

  it("stops an account whose password was changed on the provider until the new one is entered", () => {
    const s = setup("imap");
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === sales(s).id ? { ...a, password: "changed1" } : a)) };
    at(s, 5);
    expect(client(s).authFailed).toBe(true);
    expect(s.pearMail.activity.at(-1)?.error).toBe("error.mailAuth");
    at(s, 30);
    expect(client(s).checkedAt).toBe(5);
    expect(setClientPassword(s, "cl900", "wrong11")).toEqual({ ok: false, error: "error.mailAuth" });
    expect(setClientPassword(s, "cl900", "changed1").ok).toBe(true);
    expect(client(s).authFailed).toBeUndefined();
    expect(client(s).syncedAt).toBe(30);
    at(s, 35);
    expect(client(s).checkedAt).toBe(35);
  });

  it("raises one event per new message up to three, then one with the rest", () => {
    const s = setup("imap");
    at(s, 1);
    const ids = Array.from({ length: 5 }, () => mail(s));
    const events = at(s, 5);
    expect(events.map((e) => e.key)).toEqual(["event.newMail", "event.newMail", "event.newMail", "event.newMailMore"]);
    expect(events[0]).toMatchObject({ app: "Pear Mail", params: { account: "Sales", count: 1, messageId: ids[0] } });
    expect(events[3].params.count).toBe(2);
  });
});
