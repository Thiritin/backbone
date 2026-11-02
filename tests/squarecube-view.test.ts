import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { squarecubeFeatures } from "../src/sim/10-catalog/squarecube";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import { startMail } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { webmailSignIn } from "../src/sim/80-business/webmail";
import { folderTree, quotaPercent, specialFolder } from "../src/sim/80-business/webmail-view";
import { configureWebmail } from "../src/sim/90-actions/mail-server";
import { copyMessages, createMailFolder, emptyFolder, markMessages, moveMessages } from "../src/sim/90-actions/mailmsg";
import { installSoftware } from "../src/sim/90-actions/software";
import {
  deleteWebmailMessages, saveIdentity, saveWebmailDraft, sendWebmailMessage, setFolderSubscribed, setWebmailPref,
} from "../src/sim/90-actions/webmail";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf, run, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

// Squarecube 0.1 set up beside Postfixit, with the mailbox sales@ signed in.
function signedIn(seed = 4) {
  const s = readyGame(seed), mail = selfHosted(s), vm = cluster(s, mail).vm!;
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  s.hour = Math.max(s.hour, hourOfMonth("2008-03"));
  const web = idOf(installSoftware(s, vm, "squarecube"));
  run(s, 2);
  expect(err(configureWebmail(s, web, {}))).toBe("ok");
  const r = webmailSignIn(s, cluster(s, web), "sales", "hunter22");
  if (!r.ok) throw new Error(r.error);
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [r.account]: [] } };
  return { s, web, acc: r.account, address: `sales@${s.company.domain}` };
}
const mailTo = (s: GameState, to: string, subject: string) => deliver(s, { to, from: "ext:a@example.com", kind: "reply", topic: "", own: { subject, text: "hi" } });
const ids = (s: GameState, acc: string, folder: string) => listFolder(s, acc, folder).map((m) => m.id);
const draft = (to: string) => ({ to: [to], subject: "Hello", text: "Body" });

describe("Squarecube mailbox", () => {
  it("moves a deleted message to Trash, removes it inside Trash, and Empty clears Trash", () => {
    const { s, web, acc, address } = signedIn();
    mailTo(s, address, "One"); mailTo(s, address, "Two");
    const [a, b] = ids(s, acc, "inbox");
    expect(err(deleteWebmailMessages(s, web, acc, [a, b]))).toBe("ok");
    expect(ids(s, acc, "trash")).toEqual(expect.arrayContaining([a, b]));
    deleteWebmailMessages(s, web, acc, [a]);
    expect(ids(s, acc, "trash")).toEqual([b]);
    expect(err(emptyFolder(s, acc, "trash"))).toBe("ok");
    expect(ids(s, acc, "trash")).toEqual([]);
  });

  it("sends deletions to a Trash mapped to a custom folder", () => {
    const { s, web, acc, address } = signedIn();
    createMailFolder(s, acc, "Bin", null);
    const bin = s.mail.folders.find((f) => f.name === "Bin")!.id;
    expect(err(setWebmailPref(s, web, acc, "trash", bin))).toBe("ok");
    mailTo(s, address, "One");
    const [id] = ids(s, acc, "inbox");
    deleteWebmailMessages(s, web, acc, [id]);
    expect(ids(s, acc, bin)).toEqual([id]);
    expect(ids(s, acc, "trash")).toEqual([]);
  });

  it("moves by drag and copies only from 0.4", () => {
    const { s, acc, address } = signedIn();
    createMailFolder(s, acc, "Work", null);
    const work = s.mail.folders.find((f) => f.name === "Work")!.id;
    mailTo(s, address, "One"); mailTo(s, address, "Two");
    const [a, b] = ids(s, acc, "inbox");
    expect(err(moveMessages(s, acc, [a], work))).toBe("ok");
    expect(ids(s, acc, work)).toEqual([a]);
    expect(squarecubeFeatures("0.1").copy).toBe(false);
    expect(squarecubeFeatures("0.4").copy).toBe(true);
    const used = s.mail.accounts.find((x) => x.id === acc)!.usedKb;
    expect(err(copyMessages(s, acc, [b], work))).toBe("ok");
    expect(ids(s, acc, "inbox")).toEqual([b]);
    expect(ids(s, acc, work)).toHaveLength(2);
    expect(s.mail.accounts.find((x) => x.id === acc)!.usedKb).toBeGreaterThan(used);
  });

  it("lists folders in order with unread counts that follow the read flag", () => {
    const { s, acc, address } = signedIn();
    createMailFolder(s, acc, "Work", null);
    const work = s.mail.folders.find((f) => f.name === "Work")!.id;
    createMailFolder(s, acc, "Old", work);
    mailTo(s, address, "One"); mailTo(s, address, "Two");
    const tree = () => folderTree(s, acc).map((r) => `${r.folder.id === work ? "Work" : r.folder.parent ? "Old" : r.folder.id}:${r.depth}:${r.unread}`);
    expect(tree()).toEqual(["inbox:0:2", "drafts:0:0", "sent:0:0", "junk:0:0", "trash:0:0", "Work:0:0", "Old:1:0"]);
    markMessages(s, acc, [ids(s, acc, "inbox")[0]], { read: true });
    expect(tree()[0]).toBe("inbox:0:1");
    setFolderSubscribed(s, acc, work, false);
    expect(tree()).not.toContain("Work:0:0");
    expect(quotaPercent(s, acc)).toBeGreaterThanOrEqual(0);
  });

  it("fails at send for an identity with a foreign address and files Sent and Drafts by Special Folders", () => {
    const { s, web, acc, address } = signedIn();
    expect(err(saveIdentity(s, web, acc, null, { name: "Info", email: `info@${s.company.domain}`, replyTo: "", signature: "" }))).toBe("ok");
    expect(err(sendWebmailMessage(s, web, acc, { ...draft("bob@example.com"), from: `info@${s.company.domain}` }))).toBe("error.mailFrom");
    createMailFolder(s, acc, "Out", null);
    const out = s.mail.folders.find((f) => f.name === "Out")!.id;
    setWebmailPref(s, web, acc, "sent", out);
    setWebmailPref(s, web, acc, "drafts", out);
    expect(err(sendWebmailMessage(s, web, acc, { ...draft(address), from: address }))).toBe("ok");
    expect(ids(s, acc, "sent")).toEqual([]);
    expect(ids(s, acc, out)).toHaveLength(1);
    expect(err(saveWebmailDraft(s, web, acc, draft("bob@example.com")))).toBe("ok");
    expect(ids(s, acc, out)).toHaveLength(2);
    expect(specialFolder(s, web, acc, "trash")).toBe("trash");
  });

  it("loads a save without Special Folders and keeps them once set", () => {
    const { s, web, acc } = signedIn();
    const back = deserialize(serialize(s));
    expect(specialFolder(back, web, acc, "sent")).toBe("sent");
    setWebmailPref(s, web, acc, "trash", "");
    expect(specialFolder(deserialize(serialize(s)), web, acc, "trash")).toBe("");
  });
});
