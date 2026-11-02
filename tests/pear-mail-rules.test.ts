import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { boxOf, listFolder } from "../src/sim/42-mail/model";
import type { MailCond, Message } from "../src/sim/42-mail/types";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { smartRows } from "../src/sim/43-pear-mail/smart";
import { clientAccount, MY_PEAR, newPearMail, type ClientAct, type ClientRule } from "../src/sim/43-pear-mail/state";
import { mailboxRows } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { createMailAccount } from "../src/sim/90-actions/mailbox";
import { createMailFolder, sendMessage, setVacation } from "../src/sim/90-actions/mailmsg";
import { createPearFolder } from "../src/sim/90-actions/pear-mail";
import { applyClientRules, deleteClientRule, moveClientRule, removeSmartMailbox, saveClientRule, saveSmartMailbox } from "../src/sim/90-actions/pear-rules";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const addr = (s: GameState, id: string) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
const okId = (r: ActionResult) => (r.ok && r.id) || "";
// Sales over IMAP as cl1 and info over POP (copies kept on the server) as cl2.
function setup() {
  const s = readyGame(1), sales = s.mail.accounts.find((a) => a.local === "sales")!.id;
  const info = idOf(createMailAccount(s, { tenant: s.mail.accounts.find((a) => a.id === sales)!.tenant, local: "info", title: "Info", password: "secret1" }));
  const add = (id: string, accountId: string, protocol: "imap" | "pop") => s.pearMail.accounts.push({ ...clientAccount(id, { accountId, address: addr(s, accountId), description: id, fullName: "", password: s.mail.accounts.find((a) => a.id === accountId)!.password, protocol }, nowMinutes(s)), popRemove: "never" });
  add("cl1", sales, "imap");
  add("cl2", info, "pop");
  return { s, sales, info };
}
// Mail arrives, then both accounts check, which runs the rules.
function arrive(s: GameState, to: string, from: string, subject: string, kind: Message["kind"] = "order"): void {
  s.minute += 1;
  deliver(s, { to, from, kind, topic: "x", own: { subject, text: `About ${subject}` } });
  s.minute += 1;
  checkAccount(s, "cl1", false);
  checkAccount(s, "cl2", false);
}
const rule = (conds: MailCond[], acts: ClientAct[], more: Partial<ClientRule> = {}) => ({ name: "Rule", on: true, match: "all" as const, clientId: null, conds, acts, ...more });
const from = (v: string): MailCond => ({ field: "from", op: "contains", value: v });
const subj = (v: string): MailCond => ({ field: "subject", op: "contains", value: v });
const salesRow = (s: GameState, subject: string) => boxOf(s, s.pearMail.accounts[0].accountId).find((m) => m.own?.subject === subject)!;

describe("Pear Mail rules", () => {
  it("matches all or any of the conditions", () => {
    const { s, sales } = setup();
    saveClientRule(s, rule([from("dwell"), subj("rack")], [{ do: "star" }]));
    saveClientRule(s, rule([from("nobody"), subj("switch")], [{ do: "read" }], { match: "any" }));
    arrive(s, addr(s, sales), "n:Dwell", "Rack order");
    arrive(s, addr(s, sales), "n:Dwell", "Cable order");
    arrive(s, addr(s, sales), "n:Sysko", "Switch order");
    expect(salesRow(s, "Rack order").star).toBe(true);
    expect(salesRow(s, "Cable order").star).toBeUndefined();
    expect(salesRow(s, "Switch order").read).toBe(true);
  });

  it("moves an IMAP message into a server folder webmail shows, copies, colours and chimes", () => {
    const { s, sales } = setup();
    const f = okId(createMailFolder(s, sales, "Vendors")), mine = okId(createPearFolder(s, "Kept"));
    saveClientRule(s, rule([from("dwell")], [{ do: "copy", folder: `${MY_PEAR}:${mine}` }, { do: "move", folder: f }, { do: "color", color: "red" }, { do: "sound" }]));
    arrive(s, addr(s, sales), "n:Dwell", "Rack order");
    const m = salesRow(s, "Rack order");
    expect(listFolder(s, sales, f).map((x) => x.id)).toEqual([m.id]);
    expect(mailboxRows(s, MY_PEAR, mine).map((r) => r.m.own?.subject)).toEqual(["Rack order"]);
    expect(s.pearMail.colors[m.id]).toBe("red");
    expect(s.pearMail.chimes).toBe(1);
  });

  it("sends to Trash and Junk, takes out of Junk and forwards", () => {
    const { s, sales, info } = setup();
    saveClientRule(s, rule([subj("spam")], [{ do: "junk" }]));
    saveClientRule(s, rule([subj("old")], [{ do: "trash" }]));
    saveClientRule(s, rule([subj("pass on")], [{ do: "forward", to: addr(s, info) }]));
    arrive(s, addr(s, sales), "n:Dwell", "Cheap spam");
    arrive(s, addr(s, sales), "n:Dwell", "Old news");
    arrive(s, addr(s, sales), "n:Dwell", "Pass on please");
    expect(salesRow(s, "Cheap spam").folder).toBe("junk");
    expect(salesRow(s, "Old news").folder).toBe("trash");
    expect(boxOf(s, info).some((m) => m.own?.subject === "Fwd: Pass on please")).toBe(true);
    saveClientRule(s, rule([subj("spam")], [{ do: "notJunk" }]));
    deleteClientRule(s, s.pearMail.rules[0].id);
    applyClientRules(s, "cl1", [salesRow(s, "Cheap spam").id]);
    expect(salesRow(s, "Cheap spam").folder).toBe("inbox");
  });

  it("runs rules top to bottom and stops at Stop Evaluating Rules", () => {
    const { s, sales } = setup();
    const red = okId(saveClientRule(s, rule([from("dwell")], [{ do: "color", color: "red" }])));
    const blue = okId(saveClientRule(s, rule([from("dwell")], [{ do: "color", color: "blue" }])));
    arrive(s, addr(s, sales), "n:Dwell", "First");
    expect(s.pearMail.colors[salesRow(s, "First").id]).toBe("blue");
    moveClientRule(s, red, 1);
    arrive(s, addr(s, sales), "n:Dwell", "Second");
    expect(s.pearMail.colors[salesRow(s, "Second").id]).toBe("red");
    saveClientRule(s, { ...s.pearMail.rules.find((r) => r.id === blue)!, acts: [{ do: "color", color: "blue" }, { do: "stop" }] });
    arrive(s, addr(s, sales), "n:Dwell", "Third");
    expect(s.pearMail.colors[salesRow(s, "Third").id]).toBe("blue");
  });

  it("keeps a rule to its account and applies it to a selection", () => {
    const { s, sales, info } = setup();
    saveClientRule(s, rule([from("dwell")], [{ do: "star" }], { clientId: "cl2", on: false }));
    arrive(s, addr(s, sales), "n:Dwell", "Rack order");
    arrive(s, addr(s, info), "n:Dwell", "Info order");
    const local = s.pearMail.local.messages.find((m) => m.own?.subject === "Info order")!;
    expect(local.star).toBeUndefined();
    expect(applyClientRules(s, "cl2", [local.id]).ok).toBe(true);
    expect(s.pearMail.local.messages.find((m) => m.id === local.id)!.star).toBeUndefined();
    saveClientRule(s, { ...s.pearMail.rules[0], on: true });
    applyClientRules(s, "cl1", [salesRow(s, "Rack order").id]);
    applyClientRules(s, "cl2", [local.id]);
    expect(salesRow(s, "Rack order").star).toBeUndefined();
    expect(s.pearMail.local.messages.find((m) => m.id === local.id)!.star).toBe(true);
  });

  it("moves only the local copy of a POP download", () => {
    const { s, info } = setup();
    saveClientRule(s, rule([from("dwell")], [{ do: "trash" }]));
    arrive(s, addr(s, info), "n:Dwell", "Info order");
    expect(mailboxRows(s, "cl2", "trash").map((r) => r.m.own?.subject)).toEqual(["Info order"]);
    expect(listFolder(s, info, "inbox").some((m) => m.own?.subject === "Info order")).toBe(true);
  });

  it("collects licence keys of two accounts in one Smart Mailbox", () => {
    const { s, sales, info } = setup();
    const id = okId(saveSmartMailbox(s, { name: "Licence Keys", match: "all", conds: [{ field: "kind", op: "is", value: "licence" }], trash: false, sent: false }));
    arrive(s, addr(s, sales), "n:Dwell", "Key one", "licence");
    arrive(s, addr(s, info), "n:Dwell", "Key two", "licence");
    arrive(s, addr(s, info), "n:Dwell", "Not a key");
    const sm = s.pearMail.smart.find((x) => x.id === id)!;
    expect(smartRows(s, sm).map((r) => r.c.id).sort()).toEqual(["cl1", "cl2"]);
    expect(smartRows(s, { ...sm, match: "any", conds: [{ field: "unread", op: "is", value: 1 }, { field: "account", op: "is", value: "cl2" }] }).length).toBeGreaterThan(2);
    expect(saveSmartMailbox(s, { ...sm, conds: [] })).toEqual({ ok: false, error: "error.mailSmartRule" });
    expect(removeSmartMailbox(s, id).ok).toBe(true);
    expect(s.pearMail.smart).toEqual([]);
  });

  it("auto replies once to each own mailbox and never to a customer or vendor", () => {
    const { s, sales, info } = setup();
    saveClientRule(s, rule([from("@")], [{ do: "reply", subject: "Away", text: "Back Monday." }], { clientId: "cl1" }));
    setVacation(s, info, { on: true, subject: "Out", text: "Away too.", until: null });
    s.minute += 1;
    sendMessage(s, info, { from: addr(s, info), to: [addr(s, sales)], subject: "Hello", text: "Hi" });
    for (let i = 0; i < 4; i++) { s.minute += 1; checkAccount(s, "cl1", false); }
    sendMessage(s, info, { from: addr(s, info), to: [addr(s, sales)], subject: "Again", text: "Hi" });
    for (let i = 0; i < 4; i++) { s.minute += 1; checkAccount(s, "cl1", false); }
    const away = (id: string) => boxOf(s, id).filter((m) => m.folder === "sent" && m.own?.subject === "Away").length;
    expect(away(sales)).toBe(1);
    expect(boxOf(s, info).filter((m) => m.folder === "sent" && m.own?.subject === "Out").length).toBeLessThanOrEqual(1);
    arrive(s, addr(s, sales), "n:Dwell", "Vendor mail");
    expect(away(sales)).toBe(1);
  });

  it("does nothing without an enabled rule and keeps rules and Smart Mailboxes through a save", () => {
    const { s, sales, info } = setup();
    setVacation(s, info, { on: true, subject: "Out", text: "Away.", until: null });
    s.minute += 1;
    sendMessage(s, info, { from: addr(s, info), to: [addr(s, sales)], subject: "Hello", text: "Hi" });
    s.minute += 1;
    checkAccount(s, "cl1", false);
    expect(boxOf(s, sales).filter((m) => m.auto).length).toBe(0);
    saveClientRule(s, rule([from("dwell")], [{ do: "star" }]));
    saveSmartMailbox(s, { name: "Today", match: "all", conds: [{ field: "days", op: "over", value: 1 }], trash: false, sent: false });
    const back = deserialize(serialize(s));
    expect(back.pearMail.rules.length).toBe(1);
    expect(back.pearMail.smart.map((x) => x.name)).toEqual(["Today"]);
  });

  it("fills the new fields for a save made before them", () => {
    const { s } = setup();
    const { smart: _s, replied: _r, colors: _c, chimes: _h, ...old } = s.pearMail;
    const back = deserialize(serialize({ ...s, pearMail: old as never }));
    const fresh = newPearMail();
    expect([back.pearMail.smart, back.pearMail.replied, back.pearMail.colors, back.pearMail.chimes]).toEqual([fresh.smart, fresh.replied, fresh.colors, fresh.chimes]);
  });
});
