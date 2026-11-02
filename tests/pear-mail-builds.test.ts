import { describe, expect, it } from "vitest";
import { hourOfMonth, nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { mailBuild, mailHas } from "../src/sim/10-catalog/pear-mail";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, readyGame } from "./fixtures";

describe("Pear Mail builds", () => {
  it("follows the installed release and the date", () => {
    expect(mailBuild("aqua", hourOfMonth("2012-06")).version).toBe("2");
    expect(mailBuild("leopard", hourOfMonth("2011-06")).version).toBe("3");
    expect(mailBuild("leopard", hourOfMonth("2011-07")).version).toBe("5");
    expect(mailBuild("leopard", hourOfMonth("2016-01")).version).toBe("6");
    expect(mailBuild("yosemite", hourOfMonth("2014-10")).version).toBe("8");
    expect(mailBuild("tahoe", hourOfMonth("2025-09")).version).toBe("26");
  });

  it("gates features by build", () => {
    const old = mailBuild("aqua", hourOfMonth("2012-06")), lion = mailBuild("leopard", hourOfMonth("2011-07"));
    expect(mailHas(old, "rules")).toBe(true);
    expect(mailHas(old, "notes")).toBe(false);
    expect(mailHas(old, "conversations")).toBe(false);
    expect(mailHas(lion, "notes")).toBe(true);
    expect(mailHas(lion, "conversations")).toBe(true);
    expect(mailHas(lion, "banners")).toBe(false);
  });
});

describe("Pear Mail state", () => {
  it("starts a new game empty with the welcome open", () => {
    const s = newGame(1);
    expect(s.pearMail.accounts).toEqual([]);
    expect(s.pearMail.welcomed).toBe(false);
  });

  it("round trips through a save", () => {
    const s = readyGame(1), a = s.mail.accounts.find((x) => x.local === "sales")!;
    s.pearMail.accounts.push(clientAccount("cl900", { accountId: a.id, address: "sales@x", description: "Sales", fullName: "Sales", password: a.password, protocol: "imap" }, nowMinutes(s)));
    expect(deserialize(serialize(s)).pearMail).toEqual(s.pearMail);
  });

  it("gives an old save one account for its primary mailbox, once", () => {
    const s = readyGame(1), primary = s.mail.accounts.find((a) => a.id === s.mail.primary)!;
    const { pearMail: _p, ...old } = JSON.parse(serialize(s));
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.pearMail.welcomed).toBe(true);
    expect(loaded.pearMail.accounts).toHaveLength(1);
    expect(loaded.pearMail.accounts[0]).toMatchObject({ accountId: primary.id, password: primary.password, syncedAt: nowMinutes(loaded) });
    loaded.pearMail.accounts = [];
    expect(deserialize(serialize(loaded)).pearMail.accounts).toEqual([]);
  });

  it("keeps 2,000 downloaded messages under 500 KB", () => {
    const s = readyGame(1), a = s.mail.accounts.find((x) => x.local === "sales")!;
    s.pearMail.accounts.push({ ...clientAccount("cl900", { accountId: a.id, address: "sales@x", description: "Sales", fullName: "Sales", password: a.password, protocol: "pop" }, nowMinutes(s)), popRemove: "never" });
    s.minute = 1;
    deliver(s, { to: `${a.local}@${a.domain}`, from: "n:Dwell", kind: "order", topic: "orderShipped", p: { order: "o1" } });
    s.minute = 2;
    checkAccount(s, "cl900");
    const m = s.pearMail.local.messages.at(-1)!;
    s.pearMail.local.messages = Array.from({ length: 2000 }, (_, i) => ({ ...m, id: `msg${10_000 + i}`, thread: `msg${10_000 + i}`, at: m.at + i, p: { order: `o${1000 + i}` } }));
    expect(JSON.stringify(s.pearMail).length).toBeLessThan(500_000);
  });
});
