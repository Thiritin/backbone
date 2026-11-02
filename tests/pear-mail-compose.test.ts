import { describe, expect, it } from "vitest";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { boxOf, listFolder } from "../src/sim/42-mail/model";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { clientFolder } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import { OFFICE_MAIL } from "../src/sim/80-business/paperwork";
import { reportJunk } from "../src/sim/90-actions/mailmsg";
import { COMPANY_LAW_SKILL } from "../src/sim/10-catalog/research";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { downloadForm, signForm } from "../src/sim/90-actions/docs";
import { deletePearMessages, discardPearDraft, movePearMessages, savePearDraft, sendPearMessage } from "../src/sim/90-actions/pear-mail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame, mailsAbout } from "./fixtures";

const sales = (s: GameState) => s.mail.accounts.find((a) => a.local === "sales")!;
const address = (s: GameState) => `${sales(s).local}@${sales(s).domain}`;
function setup(protocol: "imap" | "pop") {
  const s = readyGame(1), a = sales(s);
  s.pearMail.accounts.push(clientAccount("cl1", { accountId: a.id, address: address(s), description: "Sales", fullName: "Sales", password: a.password, protocol }, nowMinutes(s)));
  return s;
}
const draft = (to: string[], more = {}) => ({ to, subject: "Hello", text: "Body", ...more });
const idOf = (r: ActionResult): string => (r.ok && r.id) || "";
const c1 = (s: GameState) => s.pearMail.accounts[0];

describe("Pear Mail compose", () => {
  it("files a signed form sent to the trade office from a client account", () => {
    const s = setup("imap");
    s.hour = 56;
    expect(openBankAccount(s, "sparklasse" as never).ok).toBe(true);
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
    s.bank!.plan = "business";
    s.unlocks = [...s.unlocks, COMPANY_LAW_SKILL];
    const form = downloadForm(s, "partnership");
    expect(form).toMatchObject({ ok: true });
    expect(signForm(s, idOf(form)).ok).toBe(true);
    expect(sendPearMessage(s, "cl1", { ...draft([OFFICE_MAIL]), from: address(s), att: [{ k: "doc", id: idOf(form) }] }).ok).toBe(true);
    expect(mailsAbout(s, "officeReceived").map((m) => m.to)).toEqual([address(s)]);
    expect(clientFolder(s, c1(s), "sent").map((m) => m.own?.subject)).toContain("Hello");
  });

  it("bounces an unknown address into the sending account's Inbox", () => {
    const s = setup("imap"), n = boxOf(s, sales(s).id).length;
    expect(sendPearMessage(s, "cl1", { ...draft(["someone@nowhere-at-all.xyz"]), from: address(s) }).ok).toBe(true);
    expect(boxOf(s, sales(s).id).slice(n).map((m) => m.topic)).toEqual(["bounceUser"]);
  });

  it("keeps drafts through a save and sends them out of Drafts", () => {
    for (const protocol of ["imap", "pop"] as const) {
      const s = setup(protocol), r = savePearDraft(s, "cl1", draft(["x@nowhere-at-all.xyz"]));
      expect(r.ok).toBe(true);
      const loaded = deserialize(serialize(s));
      expect(clientFolder(loaded, c1(loaded), "drafts").map((m) => m.id)).toEqual([idOf(r)]);
      expect(savePearDraft(loaded, "cl1", { ...draft(["x@nowhere-at-all.xyz"]), subject: "Edited", id: idOf(r) })).toMatchObject({ id: idOf(r) });
      expect(clientFolder(loaded, c1(loaded), "drafts").map((m) => m.own?.subject)).toEqual(["Edited"]);
      expect(sendPearMessage(loaded, "cl1", { ...draft([address(loaded)]), from: address(loaded), draftId: idOf(r), draftOf: "cl1" }).ok).toBe(true);
      expect(clientFolder(loaded, c1(loaded), "drafts")).toEqual([]);
      expect(discardPearDraft(loaded, "cl1", idOf(r)).ok).toBe(false);
    }
  });

  it("keeps a POP account's Sent copy on the computer", () => {
    const s = setup("pop");
    const r = sendPearMessage(s, "cl1", { ...draft([address(s)]), from: address(s) });
    expect(r.ok).toBe(true);
    expect(listFolder(s, sales(s).id, "sent")).toEqual([]);
    expect(clientFolder(s, c1(s), "sent").map((m) => m.own?.subject)).toEqual(["Hello"]);
  });

  it("deletes downloads to Trash and out of Trash for good, and files junk", () => {
    const s = setup("pop");
    s.minute = 1;
    deliver(s, { to: address(s), from: "n:Dwell", kind: "order", topic: "x" });
    deliver(s, { to: address(s), from: "n:Hewlett-Packet", kind: "order", topic: "x" });
    s.minute = 5;
    checkAccount(s, "cl1");
    const [a, b] = clientFolder(s, c1(s), "inbox").map((m) => m.id);
    expect(deletePearMessages(s, [a]).ok).toBe(true);
    expect(clientFolder(s, c1(s), "trash").map((m) => m.id)).toEqual([a]);
    deletePearMessages(s, [a]);
    expect(s.pearMail.local.messages.some((m) => m.id === a)).toBe(false);
    expect(movePearMessages(s, [b], "junk").ok).toBe(true);
    expect(clientFolder(s, c1(s), "junk").map((m) => m.id)).toEqual([b]);
  });

  it("reports junk on the server for an IMAP account", () => {
    const s = setup("imap"), id = deliver(s, { to: address(s), from: "n:Rolecks", kind: "spam", topic: "x" }).id!, trained = sales(s).trained;
    expect(reportJunk(s, sales(s).id, [id], true).ok).toBe(true);
    expect(listFolder(s, sales(s).id, "junk").map((m) => m.id)).toContain(id);
    expect(sales(s).trained).toBe(trained + 1);
  });
});
