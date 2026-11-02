import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { salesAddress } from "../src/sim/80-business/mail";
import { accountByAddress, addressesOf, boxOf, foldersOf, listFolder, ownsAddress, unread, view } from "../src/sim/42-mail/model";
import type { Message } from "../src/sim/42-mail/types";
import { setCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const primary = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
// A save written before mailboxes existed.
const preMail = (s: GameState): GameState => {
  const raw = JSON.parse(serialize(s));
  delete raw.mail;
  return deserialize(JSON.stringify(raw));
};

describe("mail model", () => {
  it("starts a game with one GMix mailbox on the sales address and a welcome stating its password", () => {
    const s = newGame(7);
    expect(s.mail.tenants).toMatchObject([{ host: "gmix", domain: "gmix.com", plan: "free", verified: true, admin: s.mail.primary }]);
    const a = primary(s);
    expect(`${a.local}@${a.domain}`).toBe(salesAddress(s));
    expect(a.external).toBe(false);
    expect(a.password).toMatch(/^[a-z2-9]{8}$/);
    expect(newGame(7).mail).toEqual(s.mail);
    const [w] = boxOf(s, a.id);
    expect(view(s, w)).toMatchObject({ subject: "Welcome to GMix", fromName: "GMix", to: salesAddress(s) });
    expect(view(s, w).text).toContain(a.password);
    expect(unread(s, a.id)).toBe(1);
  });

  it("carries the starting GMix address along when the company is renamed", () => {
    const s = newGame(7);
    expect(setCompany(s, { name: "Pixel Werk" }).ok).toBe(true);
    expect(primary(s).local).toBe("pixel-werk");
    expect(salesAddress(s)).toBe("pixel-werk@gmix.com");
    expect(view(s, boxOf(s, primary(s).id)[0]).text).toContain("pixel-werk@gmix.com");
  });

  it("gives a save without mail a tenant for its service and the sales address as primary mailbox", () => {
    const free = newGame(3);
    setCompany(free, { name: "Kellerhost" });
    const f = preMail(free);
    expect(`${primary(f).local}@${primary(f).domain}`).toBe(salesAddress(f));
    expect(primary(f).roles).toEqual(["owner", "sales", "support", "abuse"]);

    const ext = newGame(3);
    ext.company = { ...ext.company, domain: "kellerhost.de", mail: { kind: "external", provider: "goggleWorkspace", seats: 3 } };
    const e = preMail(ext);
    expect(salesAddress(e)).toBe("sales@kellerhost.de");
    expect(accountByAddress(e, "Sales@kellerhost.de")?.id).toBe(e.mail.primary);
    expect(e.mail.tenants[0]).toMatchObject({ host: "goggle", domain: "kellerhost.de", verified: true });
    expect(view(e, boxOf(e, e.mail.primary)[0]).subject).toBe("Welcome to Goggle Workspace");

    const self = newGame(3);
    self.company = { ...self.company, domain: "kellerhost.de", mail: { kind: "self", software: "mailpig", clusterId: "cl9" } };
    expect(preMail(self).mail.tenants[0]).toMatchObject({ host: "self", clusterId: "cl9", domain: "kellerhost.de" });
  });

  it("keeps a saved mail state through a round trip", () => {
    const s = newGame(5);
    expect(deserialize(serialize(s)).mail).toEqual(s.mail);
  });

  it("finds mailboxes by alias and lists folders newest first, labels across folders", () => {
    const s = newGame(5), a = primary(s);
    s.mail = {
      ...s.mail,
      accounts: [{ ...a, aliases: ["info"] }],
      folders: [{ id: "f1", accountId: a.id, name: "Orders", parent: null }, { id: "l1", accountId: a.id, name: "Bank", parent: null, label: true }],
      msgs: { [a.id]: [...boxOf(s, a.id), msg("m2", "inbox", { labels: ["l1"] }), msg("m3", "f1", { labels: ["l1"], read: true }), msg("m4", "inbox", { snooze: 99 })] },
    };
    const b = primary(s);
    expect(addressesOf(b)).toEqual([`${b.local}@gmix.com`, "info@gmix.com"]);
    expect(ownsAddress(b, "INFO@gmix.com")).toBe(true);
    expect(accountByAddress(s, "info@gmix.com")?.id).toBe(b.id);
    expect(foldersOf(s, b.id).map((f) => f.name)).toEqual(["Inbox", "Sent", "Drafts", "Junk", "Trash", "Archive", "Orders", "Bank"]);
    expect(listFolder(s, b.id, "inbox").map((m) => m.id)).toEqual(["m2", "msg1"]);
    expect(listFolder(s, b.id, "l1").map((m) => m.id)).toEqual(["m3", "m2"]);
    expect(unread(s, b.id, "l1")).toBe(1);
  });

  it("renders a ticket envelope from its ticket and takes its read state", () => {
    const s = newGame(5), a = primary(s);
    s.tickets = [{ id: "tk_1", customerId: "c1", serviceId: null, kind: "mail", topic: "mailWelcome", status: "open", createdAt: 0, dueAt: 0, updatedAt: 0, unread: false, replies: [], outcome: null, work: null, assignee: null, mail: { from: "GMix", params: { provider: "GMix", address: "x", password: "y" } } } as GameState["tickets"][number]];
    const env = msg("m9", "inbox", { ticket: "tk_1" });
    s.mail = { ...s.mail, msgs: { [a.id]: [env] } };
    expect(view(s, env).subject).toBe("Welcome to GMix");
    expect(unread(s, a.id)).toBe(0);
  });

  it("stays within the size budget for 5,000 messages across three mailboxes", () => {
    const s = newGame(11);
    const kinds = [
      { kind: "support", topic: "", ticket: "tk_123", from: "cust:c42" },
      { kind: "bank", topic: "bankReturned", from: "n:Sparklasse", p: { amount: 12900, name: "Dwell", account: "DE12" } },
      { kind: "licence", topic: "licenceKey", from: "n:Pleskit", att: [{ k: "key", order: "ord88" }] },
    ] as const;
    const msgs: Record<string, Message[]> = { mb1: [], mb2: [], mb3: [] };
    for (let i = 0; i < 5000; i++) {
      const box = `mb${(i % 3) + 1}`, k = kinds[i % 3];
      msgs[box].push({ ...k, id: `msg${i + 10}`, thread: `msg${i + 10}`, folder: "inbox", to: "sales@kellerhost.de", at: 2_000_000 + i * 37, kb: 40, ...(i % 2 ? { read: true } : {}) } as Message);
    }
    s.mail = { ...s.mail, msgs };
    // Retention (MAIL_KEEP per mailbox) brings this under 400,000 characters once delivery folds old mail.
    expect(JSON.stringify(s.mail).length / 5000).toBeLessThan(200);
  });
});

function msg(id: string, folder: string, extra: Partial<Message> = {}): Message {
  return { id, thread: id, folder, from: "ext:a@b.de", to: "x@gmix.com", kind: "notice", topic: "mailWelcome", p: { provider: "GMix" }, at: Number(id.slice(1)), kb: 3, ...extra };
}
