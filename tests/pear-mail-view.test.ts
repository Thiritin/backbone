import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { clientUnread, mailboxRows, sortMessages, threadsOf } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import { createMailAccount } from "../src/sim/90-actions/mailbox";
import { markMessages } from "../src/sim/90-actions/mailmsg";
import { markPearMessages } from "../src/sim/90-actions/pear-mail";
import { idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const addr = (s: GameState, id: string) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
// Pear Mail reading the sales box over IMAP and an info box over POP, with mail that arrived before minute 5.
function setup() {
  const s = readyGame(1), sales = s.mail.accounts.find((a) => a.local === "sales")!;
  const info = idOf(createMailAccount(s, { tenant: sales.tenant, local: "info", title: "Info", password: "secret1" }));
  const add = (id: string, accountId: string, protocol: "imap" | "pop") => s.pearMail.accounts.push(clientAccount(id, { accountId, address: addr(s, accountId), description: id, fullName: "", password: s.mail.accounts.find((a) => a.id === accountId)!.password, protocol }, nowMinutes(s)));
  add("cl1", sales.id, "imap");
  add("cl2", info, "pop");
  s.minute = 1;
  const a = deliver(s, { to: addr(s, sales.id), from: "n:Dwell", kind: "order", topic: "x", own: { subject: "Banana", text: "" } }).id!;
  s.minute = 2;
  const b = deliver(s, { to: addr(s, info), from: "n:Sysko", kind: "order", topic: "x", own: { subject: "Apple", text: "" } }).id!;
  const c = deliver(s, { to: addr(s, sales.id), from: "n:Hewlett-Packet", kind: "order", topic: "x", own: { subject: "Re: Banana", text: "" }, thread: a }).id!;
  s.minute = 5;
  checkAccount(s, "cl1");
  checkAccount(s, "cl2");
  return { s, a, b, c };
}

describe("Pear Mail views", () => {
  it("merges the Inboxes of every enabled account and lists the POP account from its downloads", () => {
    const { s, a, b, c } = setup();
    const inbox = mailboxRows(s, null, "inbox").map((r) => r.m.id);
    expect(inbox).toEqual(expect.arrayContaining([a, c]));
    expect(mailboxRows(s, "cl2", "inbox").map((r) => r.m.own?.subject)).toEqual(["Apple"]);
    expect(inbox).not.toContain(b);
    s.pearMail.accounts = s.pearMail.accounts.map((x) => (x.id === "cl2" ? { ...x, enabled: false } : x));
    expect(mailboxRows(s, null, "inbox").some((r) => r.c.id === "cl2")).toBe(false);
  });

  it("sorts by date, sender and subject", () => {
    const { s, a, c } = setup();
    const rows = mailboxRows(s, null, "inbox").filter((r) => r.m.own);
    const ids = (key: "date" | "from" | "subject", asc: boolean) => sortMessages(s, rows, (r) => r.m, key, asc).map((r) => r.m.own!.subject);
    expect(ids("date", false)[0]).not.toBe("Banana");
    expect(ids("subject", true)).toEqual(["Apple", "Banana", "Re: Banana"]);
    expect(ids("from", true)).toEqual(["Banana", "Re: Banana", "Apple"]);
    expect(threadsOf(sortMessages(s, rows, (r) => r.m, "date", false), (r) => r.m).find((g) => g.length === 2)!.map((r) => r.m.id).sort()).toEqual([a, c].sort());
  });

  it("counts unread mail and follows reads on the server and in the downloads", () => {
    const { s, a } = setup();
    const sales = s.pearMail.accounts[0], info = s.pearMail.accounts[1];
    const before = clientUnread(s, sales, "inbox");
    markMessages(s, sales.accountId, [a], { read: true });
    expect(clientUnread(s, sales, "inbox")).toBe(before - 1);
    const local = mailboxRows(s, "cl2", "inbox").map((r) => r.m.id);
    expect(clientUnread(s, info, "inbox")).toBe(local.length);
    expect(markPearMessages(s, local, { read: true }).ok).toBe(true);
    expect(clientUnread(s, info, "inbox")).toBe(0);
  });
});
