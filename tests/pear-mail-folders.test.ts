import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { boxOf, foldersOf, listFolder } from "../src/sim/42-mail/model";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { clientAccount, MY_PEAR } from "../src/sim/43-pear-mail/state";
import { clientFolders, mailboxRows, myFolders } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { createMailAccount } from "../src/sim/90-actions/mailbox";
import { createMailFolder, deleteMessages } from "../src/sim/90-actions/mailmsg";
import {
  createPearFolder, deletePearFolder, deletePearMessages, erasePearMailbox, movePearFolder, renamePearFolder, transferMessages,
} from "../src/sim/90-actions/pear-mail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const addr = (s: GameState, id: string) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
const okId = (r: ActionResult) => (r.ok && r.id) || "";
// Sales over IMAP as cl1, info over POP as cl2, one message each, both checked.
function setup() {
  const s = readyGame(1), sales = s.mail.accounts.find((a) => a.local === "sales")!;
  const info = idOf(createMailAccount(s, { tenant: sales.tenant, local: "info", title: "Info", password: "secret1" }));
  const add = (id: string, accountId: string, protocol: "imap" | "pop") => s.pearMail.accounts.push(clientAccount(id, { accountId, address: addr(s, accountId), description: id, fullName: "", password: s.mail.accounts.find((a) => a.id === accountId)!.password, protocol }, nowMinutes(s)));
  add("cl1", sales.id, "imap");
  add("cl2", info, "pop");
  s.minute = 1;
  const a = deliver(s, { to: addr(s, sales.id), from: "n:Dwell", kind: "order", topic: "x", own: { subject: "Rack order", text: "" } }).id!;
  deliver(s, { to: addr(s, info), from: "n:Sysko", kind: "order", topic: "x", own: { subject: "Switch order", text: "" } });
  s.minute = 5;
  checkAccount(s, "cl1");
  checkAccount(s, "cl2");
  // The POP download is a new local message.
  return { s, sales: sales.id, a, b: s.pearMail.local.messages[0].id };
}

describe("Pear Mail mailboxes", () => {
  it("files a mailbox made on an IMAP account on the server and one under On My Pear only locally", () => {
    const { s, sales } = setup();
    const server = okId(createMailFolder(s, sales, "Vendors"));
    expect(foldersOf(s, sales).some((f) => f.id === server)).toBe(true);
    expect(clientFolders(s, s.pearMail.accounts[0]).some((f) => f.id === server)).toBe(true);
    const mine = okId(createPearFolder(s, "Archive 2005"));
    expect(myFolders(s).map((f) => f.name)).toEqual(["Archive 2005"]);
    expect(foldersOf(s, sales).some((f) => f.id === mine)).toBe(false);
  });

  it("moves an IMAP message into On My Pear and takes the server copy away", () => {
    const { s, sales, a } = setup();
    const f = okId(createPearFolder(s, "Orders"));
    expect(transferMessages(s, "cl1", [a], MY_PEAR, f).ok).toBe(true);
    expect(boxOf(s, sales).some((m) => m.id === a)).toBe(false);
    expect(mailboxRows(s, MY_PEAR, f).map((r) => r.m.id)).toEqual([a]);
  });

  it("copies with Option held and keeps the original", () => {
    const { s, sales, a } = setup();
    const f = okId(createPearFolder(s, "Orders"));
    expect(transferMessages(s, "cl1", [a], MY_PEAR, f, true).ok).toBe(true);
    expect(listFolder(s, sales, "inbox").some((m) => m.id === a)).toBe(true);
    const copy = mailboxRows(s, MY_PEAR, f)[0].m;
    expect(copy.id).not.toBe(a);
    expect(copy.own?.subject).toBe("Rack order");
  });

  it("uploads On My Pear mail to an IMAP mailbox and refiles a POP download under On My Pear", () => {
    const { s, sales, a, b } = setup();
    const f = okId(createPearFolder(s, "Orders"));
    transferMessages(s, "cl1", [a], MY_PEAR, f);
    expect(transferMessages(s, MY_PEAR, [a], "cl1", "inbox").ok).toBe(true);
    expect(listFolder(s, sales, "inbox").map((m) => m.id)).toContain(a);
    expect(mailboxRows(s, MY_PEAR, f)).toEqual([]);
    expect(transferMessages(s, "cl2", [b], MY_PEAR, f).ok).toBe(true);
    expect(mailboxRows(s, "cl2", "inbox")).toEqual([]);
    expect(mailboxRows(s, MY_PEAR, f).map((r) => r.m.id)).toEqual([b]);
  });

  it("refuses a move into another account", () => {
    const { s, a, b } = setup();
    expect(transferMessages(s, "cl1", [a], "cl2", "inbox")).toEqual({ ok: false, error: "error.mailCrossAccount" });
    expect(transferMessages(s, "cl2", [b], "cl1", "inbox")).toEqual({ ok: false, error: "error.mailCrossAccount" });
    expect(transferMessages(s, "cl2", [b], "cl2", "fd1")).toEqual({ ok: false, error: "error.mailNoFolder" });
  });

  it("renames, nests three deep and deletes On My Pear mailboxes, sending their mail to its Trash", () => {
    const { s, b } = setup();
    const top = okId(createPearFolder(s, "Projects")), mid = okId(createPearFolder(s, "Racks", top)), low = okId(createPearFolder(s, "2005", mid));
    expect(createPearFolder(s, "Too deep", low)).toEqual({ ok: false, error: "error.mailFolderDepth" });
    expect(createPearFolder(s, "racks", top)).toEqual({ ok: false, error: "error.mailFolderName" });
    expect(renamePearFolder(s, mid, "Cabinets").ok).toBe(true);
    expect(movePearFolder(s, top, low)).toEqual({ ok: false, error: "error.mailNoFolder" });
    expect(movePearFolder(s, low, null).ok).toBe(true);
    transferMessages(s, "cl2", [b], MY_PEAR, mid);
    expect(deletePearFolder(s, top).ok).toBe(true);
    expect(myFolders(s).map((f) => f.name)).toEqual(["2005"]);
    expect(mailboxRows(s, null, "trash").map((r) => r.m.id)).toEqual([b]);
  });

  it("erases deleted messages of every account and On My Pear", () => {
    const { s, sales, a, b } = setup();
    deleteMessages(s, sales, [a], "imap");
    deletePearMessages(s, [b]);
    expect(mailboxRows(s, null, "trash").length).toBe(2);
    expect(erasePearMailbox(s, "trash").ok).toBe(true);
    expect(mailboxRows(s, null, "trash")).toEqual([]);
    expect(boxOf(s, sales).some((m) => m.id === a)).toBe(false);
  });

  it("keeps On My Pear mailboxes and their mail through a save", () => {
    const { s, b } = setup();
    const f = okId(createPearFolder(s, "Orders"));
    transferMessages(s, "cl2", [b], MY_PEAR, f);
    const back = deserialize(serialize(s));
    expect(mailboxRows(back, MY_PEAR, f).map((r) => r.m.id)).toEqual([b]);
  });
});
