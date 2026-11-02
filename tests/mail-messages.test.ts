import { afterEach, describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { mailHooks } from "../src/sim/42-mail/caps";
import { deliver, mailDeliveryTick, MAIL_HOPS } from "../src/sim/42-mail/deliver";
import { boxOf, listFolder, unread } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { NOTARY_MAIL } from "../src/sim/80-business/paperwork";
import { createTenant, verifyTenant } from "../src/sim/90-actions/mail";
import { createMailAccount } from "../src/sim/90-actions/mailbox";
import {
  createMailFolder, deleteMailFolder, deleteMessages, discardDraft, emptyFolder, markMessages, moveMailFolder, moveMessages, purgeOlder,
  reportJunk, restoreMessages, saveDraft, sendMessage, setVacation, snoozeMessages,
} from "../src/sim/90-actions/mailmsg";
import { idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const sales = (s: GameState) => s.mail.accounts.find((a) => a.local === "sales" && a.domain === s.company.domain)!;
const add = (s: GameState, local: string, tenant = sales(s).tenant) => idOf(createMailAccount(s, { tenant, local, title: local, password: "secret1" }));
const addr = (s: GameState, id: string) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
const send = (s: GameState, from: string, to: string[], more: Partial<Parameters<typeof sendMessage>[2]> = {}) =>
  sendMessage(s, from, { from: addr(s, from), to, subject: "Hello", text: "Body", ...more });
const req = (s: GameState, to: string) => deliver(s, { to, from: "n:x", kind: "support", topic: "x" });
const original = mailHooks.mxTarget;
afterEach(() => { mailHooks.mxTarget = original; });

// A Goggle tenant on the company domain that receives its mail, in 2008.
function goggle(s: GameState) {
  s.hour = hourOfMonth("2008-03");
  const g = idOf(createTenant(s, { host: "goggle", plan: "paid" }));
  verifyTenant(s, g);
  mailHooks.mxTarget = () => s.mail.tenants.find((x) => x.id === g)!;
  return g;
}

describe("mail messages", () => {
  it("sends to every recipient, keeps bcc on the Sent copy only and returns its id", () => {
    const s = readyGame(1), a = sales(s).id, b = add(s, "info"), c = add(s, "office");
    const r = send(s, a, [addr(s, b)], { bcc: [addr(s, c)] });
    expect(r.ok).toBe(true);
    const sent = boxOf(s, a).find((m) => m.id === idOf(r))!;
    expect(sent).toMatchObject({ folder: "sent", bcc: [addr(s, c)], read: true });
    for (const id of [b, c]) {
      const got = boxOf(s, id).at(-1)!;
      expect(got).toMatchObject({ folder: "inbox", from: `acct:${a}`, own: { subject: "Hello", text: "Body" } });
      expect(got.bcc).toBeUndefined();
    }
    expect(send(s, a, [addr(s, b)], { from: "nobody@x.de" })).toEqual({ ok: false, error: "error.mailFrom" });
  });

  it("returns a daemon message for an unknown domain and lets the notary answer", () => {
    const s = readyGame(2), a = sales(s).id;
    const n = boxOf(s, a).length;
    expect(send(s, a, ["someone@nowhere-at-all.xyz"])).toEqual({ ok: true });
    expect(boxOf(s, a).slice(n).map((m) => m.topic)).toEqual(["bounceUser"]);
    const m = boxOf(s, a).length;
    expect(send(s, a, [NOTARY_MAIL]).ok).toBe(true);
    expect(boxOf(s, a).slice(m).filter((x) => x.folder === "inbox").map((x) => x.topic)).toEqual(["noForm"]);
  });

  it("refuses an attachment over the plan's limit", () => {
    const s = readyGame(3), a = sales(s).id;
    expect(send(s, a, ["x@hotmeal.com"], { att: [{ k: "file", name: "big.zip", kb: 21 * 1024 }] })).toEqual({ ok: false, error: "error.mailAttach" });
    expect(send(s, a, ["x@hotmeal.com"], { att: [{ k: "file", name: "ok.zip", kb: 1024 }] }).ok).toBe(true);
  });

  it("loops two vacation replies on a host without loop protection to the hop limit", () => {
    const s = readyGame(4), a = sales(s).id, b = add(s, "office");
    for (const id of [a, b]) setVacation(s, id, { on: true, subject: "Away", text: "Back Monday", until: null });
    send(s, a, [addr(s, b)]);
    const all = [...boxOf(s, a), ...boxOf(s, b)];
    expect(all.filter((m) => m.auto && m.folder === "sent").length).toBe(MAIL_HOPS + 1);
    expect(all.filter((m) => m.topic === "bounceLoop")).toHaveLength(1);
  });

  it("answers once a week on a loop-protected host and never answers an auto-reply", () => {
    const s = readyGame(5), g = goggle(s), a = add(s, "ann", g), b = add(s, "bob", g);
    setVacation(s, b, { on: true, subject: "Away", text: "Back Monday", until: null });
    send(s, a, [addr(s, b)], { auto: true });
    expect(boxOf(s, b).some((m) => m.auto && m.folder === "sent")).toBe(false);
    send(s, a, [addr(s, b)]); send(s, a, [addr(s, b)]);
    expect(boxOf(s, b).filter((m) => m.auto && m.folder === "sent")).toHaveLength(1);
    expect(boxOf(s, a).filter((m) => m.auto && m.folder === "inbox")).toHaveLength(1);
  });

  it("moves to Trash, restores, deletes for good and empties Trash", () => {
    const s = readyGame(6), a = sales(s).id, d = s.company.domain!;
    const f = idOf(createMailFolder(s, a, "Clients"));
    const ids = [req(s, `sales@${d}`).id!, req(s, `sales@${d}`).id!];
    moveMessages(s, a, ids, f);
    deleteMessages(s, a, ids);
    expect(listFolder(s, a, "trash").map((m) => m.prev)).toEqual([f, f]);
    restoreMessages(s, a, [ids[0]]);
    expect(listFolder(s, a, f).map((m) => m.id)).toEqual([ids[0]]);
    const used = s.mail.accounts.find((x) => x.id === a)!.usedKb;
    deleteMessages(s, a, [ids[1]]);
    expect(boxOf(s, a).some((m) => m.id === ids[1])).toBe(false);
    expect(s.mail.accounts.find((x) => x.id === a)!.usedKb).toBeLessThan(used);
    deleteMessages(s, a, [ids[0]]);
    emptyFolder(s, a, "trash");
    expect(listFolder(s, a, "trash")).toHaveLength(0);
  });

  it("follows imapDelete for deletes from an IMAP client", () => {
    const s = readyGame(7), a = sales(s).id, d = s.company.domain!;
    const one = req(s, `sales@${d}`).id!;
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a ? { ...x, prefs: { imapDelete: "flag" } } : x)) };
    deleteMessages(s, a, [one], "imap");
    expect(boxOf(s, a).find((m) => m.id === one)).toMatchObject({ folder: "inbox", read: true });
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a ? { ...x, prefs: { imapDelete: "expunge" } } : x)) };
    deleteMessages(s, a, [one], "imap");
    expect(boxOf(s, a).some((m) => m.id === one)).toBe(false);
  });

  it("nests folders three deep and moves a folder host's mail to Trash when its folder goes", () => {
    const s = readyGame(8), a = sales(s).id;
    const f1 = idOf(createMailFolder(s, a, "A")), f2 = idOf(createMailFolder(s, a, "B", f1)), f3 = idOf(createMailFolder(s, a, "C", f2));
    expect(createMailFolder(s, a, "D", f3)).toEqual({ ok: false, error: "error.mailFolderDepth" });
    expect(createMailFolder(s, a, "b", f1)).toEqual({ ok: false, error: "error.mailFolderName" });
    expect(moveMailFolder(s, a, f1, f3)).toEqual({ ok: false, error: "error.mailNoFolder" });
    const id = req(s, `sales@${s.company.domain}`).id!;
    moveMessages(s, a, [id], f3);
    deleteMailFolder(s, a, f1);
    expect(s.mail.folders.filter((f) => f.accountId === a)).toHaveLength(0);
    expect(boxOf(s, a).find((m) => m.id === id)!.folder).toBe("trash");
  });

  it("treats folders as labels on a label host", () => {
    const s = readyGame(9), g = goggle(s), a = add(s, "ann", g);
    const l = idOf(createMailFolder(s, a, "Clients"));
    expect(s.mail.folders.find((f) => f.id === l)!.label).toBe(true);
    const id = req(s, `ann@${s.company.domain}`).id!;
    moveMessages(s, a, [id], l);
    expect(boxOf(s, a).find((m) => m.id === id)).toMatchObject({ folder: "archive", labels: [l] });
    expect(listFolder(s, a, l).map((m) => m.id)).toEqual([id]);
    deleteMailFolder(s, a, l);
    expect(boxOf(s, a).find((m) => m.id === id)).toMatchObject({ folder: "archive" });
    expect(boxOf(s, a).find((m) => m.id === id)!.labels).toBeUndefined();
  });

  it("returns a snoozed message unread at its hour", () => {
    const s = readyGame(10), a = sales(s).id, id = req(s, `sales@${s.company.domain}`).id!;
    markMessages(s, a, [id], { read: true });
    snoozeMessages(s, a, [id], s.hour + 2);
    expect(listFolder(s, a, "inbox").some((m) => m.id === id)).toBe(false);
    s.hour += 2; mailDeliveryTick(s);
    expect(listFolder(s, a, "inbox")[0]).toMatchObject({ id });
    expect(listFolder(s, a, "inbox")[0].read).toBeUndefined();
    expect(s.mail.snoozed).toHaveLength(0);
  });

  it("keeps drafts in Drafts, sends one and drops it, and reports junk", () => {
    const s = readyGame(11), a = sales(s).id;
    const d = idOf(saveDraft(s, a, { to: ["x@hotmeal.com"], subject: "Draft", text: "One" }));
    expect(idOf(saveDraft(s, a, { id: d, to: ["x@hotmeal.com"], subject: "Draft", text: "Two" }))).toBe(d);
    expect(listFolder(s, a, "drafts").map((m) => m.own?.text)).toEqual(["Two"]);
    expect(send(s, a, ["x@hotmeal.com"], { draftId: d }).ok).toBe(true);
    expect(listFolder(s, a, "drafts")).toHaveLength(0);
    const d2 = idOf(saveDraft(s, a, { to: [], subject: "", text: "" }));
    expect(discardDraft(s, a, d2).ok).toBe(true);
    const id = req(s, `sales@${s.company.domain}`).id!;
    reportJunk(s, a, [id], true);
    expect(boxOf(s, a).find((m) => m.id === id)!.folder).toBe("junk");
    reportJunk(s, a, [id], false);
    expect(boxOf(s, a).find((m) => m.id === id)!.folder).toBe("inbox");
    expect(s.mail.accounts.find((x) => x.id === a)!.trained).toBe(2);
    expect(unread(s, a)).toBeGreaterThan(0);
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a ? { ...x, older: { n: 3, kb: 90 }, usedKb: x.usedKb + 90 } : x)) };
    const used = s.mail.accounts.find((x) => x.id === a)!.usedKb;
    purgeOlder(s, a);
    expect(s.mail.accounts.find((x) => x.id === a)!).toMatchObject({ older: { n: 0, kb: 0 }, usedKb: used - 90 });
  });
});

describe("mail action names", () => {
  it("are unique in the action registry, so replays call the mail actions", async () => {
    const { ACTIONS } = await import("../src/sim/90-actions/index");
    const mm = await import("../src/sim/90-actions/mailmsg"), mb = await import("../src/sim/90-actions/mailbox");
    for (const [name, fn] of [...Object.entries(mm), ...Object.entries(mb)]) if (typeof fn === "function") expect(ACTIONS[name], name).toBe(fn);
  });
});
