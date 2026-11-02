import { describe, expect, it } from "vitest";
import { serverStatus } from "../src/sim/42-mail/accounts";
import { boxOf, listFolder } from "../src/sim/42-mail/model";
import { searchMailbox } from "../src/sim/80-business/mail-search";
import { applyFilter } from "../src/sim/90-actions/mail-provider";
import { saveFilter, setAccountPrefs } from "../src/sim/90-actions/mailbox";
import { createMailFolder, deleteMessages, labelMessages, moveMessages } from "../src/sim/90-actions/mailmsg";
import { idOf } from "./company-mail.helpers";
import { FRIEND, goggleBox, mail } from "./gmial.helpers";

const msg = (s: ReturnType<typeof goggleBox>["s"], a: string, id: string) => boxOf(s, a).find((m) => m.id === id)!;
const inView = (s: ReturnType<typeof goggleBox>["s"], a: string, q: string) => searchMailbox(s, a, q).map((m) => m.id);

describe("Gmial labels", () => {
  it("shows a message with two labels in both views, keeps them on Archive and hides it from both in Trash", () => {
    const { s, a, address } = goggleBox(51);
    const id = mail(s, address, "Rack quote");
    const vendors = idOf(createMailFolder(s, a, "Vendors")), quotes = idOf(createMailFolder(s, a, "Quotes"));
    labelMessages(s, a, [id], [vendors, quotes], []);
    for (const l of [vendors, quotes]) {
      expect(listFolder(s, a, l).map((m) => m.id)).toEqual([id]);
      expect(inView(s, a, `label:${l}`)).toEqual([id]);
    }
    expect(inView(s, a, "in:inbox")).toContain(id);
    moveMessages(s, a, [id], "archive");
    expect(inView(s, a, "in:inbox")).not.toContain(id);
    expect(msg(s, a, id)).toMatchObject({ folder: "archive", labels: [vendors, quotes] });
    expect(inView(s, a, "label:quotes")).toEqual([id]);
    deleteMessages(s, a, [id]);
    expect(listFolder(s, a, vendors)).toEqual([]);
    expect(inView(s, a, "label:vendors")).toEqual([]);
    expect(msg(s, a, id).labels).toEqual([vendors, quotes]);
  });

  it("moving to a label labels the message and takes it out of the Inbox", () => {
    const { s, a, address } = goggleBox(52);
    const id = mail(s, address, "Order 66"), l = idOf(createMailFolder(s, a, "Orders"));
    moveMessages(s, a, [id], l);
    expect(msg(s, a, id)).toMatchObject({ folder: "archive", labels: [l] });
  });

  it("a filter made from a message labels and archives the next match and can run over existing mail", () => {
    const { s, a, address } = goggleBox(53);
    const old = mail(s, address, "Weekly report"), other = mail(s, address, "Lunch", { from: "ext:bob@builder.example" });
    const l = idOf(createMailFolder(s, a, "Ada"));
    const f = idOf(saveFilter(s, a, { name: `from:(${FRIEND})`, on: true, match: "all", conds: [{ field: "from", op: "contains", value: FRIEND }], acts: [{ do: "move", folder: "archive" }, { do: "label", label: l }, { do: "read" }] }));
    const next = mail(s, address, "Weekly report 2");
    expect(msg(s, a, next)).toMatchObject({ folder: "archive", labels: [l], read: true });
    expect(msg(s, a, old).folder).toBe("inbox");
    expect(applyFilter(s, f).ok).toBe(true);
    expect(msg(s, a, old)).toMatchObject({ folder: "archive", labels: [l], read: true });
    expect(msg(s, a, other).folder).toBe("inbox");
    expect(inView(s, a, `label:${l}`).sort()).toEqual([old, next].sort());
  });

  it("the IMAP delete setting decides whether a Pear Mail delete frees quota", () => {
    const { s, a, address } = goggleBox(54);
    const used = () => s.mail.accounts.find((x) => x.id === a)!.usedKb;
    const one = mail(s, address, "One", { att: [{ k: "file", name: "a.zip", kb: 900 }] });
    const two = mail(s, address, "Two", { att: [{ k: "file", name: "b.zip", kb: 900 }] });
    const before = used();
    deleteMessages(s, a, [one], "imap");
    expect(msg(s, a, one).folder).toBe("archive");
    expect(used()).toBe(before);
    setAccountPrefs(s, a, { imapDelete: "trash" });
    deleteMessages(s, a, [one], "imap");
    expect(msg(s, a, one).folder).toBe("trash");
    expect(used()).toBe(before);
    setAccountPrefs(s, a, { imapDelete: "expunge" });
    deleteMessages(s, a, [two], "imap");
    expect(boxOf(s, a).some((m) => m.id === two)).toBe(false);
    expect(used()).toBeLessThan(before - 800);
  });

  it("switches IMAP and POP off one by one", () => {
    const { s, a } = goggleBox(55);
    expect(serverStatus(s, a, "imap")).toBe("ok");
    setAccountPrefs(s, a, { imap: "off" });
    expect(serverStatus(s, a, "imap")).toBe("external");
    expect(serverStatus(s, a, "pop")).toBe("ok");
    setAccountPrefs(s, a, { pop: "off" });
    expect(serverStatus(s, a, "pop")).toBe("external");
  });
});
