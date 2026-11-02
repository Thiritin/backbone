import { describe, expect, it } from "vitest";
import { FREEMAIL_DOMAINS } from "../src/sim/30-customers/addresses";
import { parseSearch, searchMailbox } from "../src/sim/80-business/mail-search";
import { markImportant } from "../src/sim/90-actions/mail-provider";
import { createMailFolder, deleteMessages, labelMessages, markMessages, moveMessages, reportJunk, sendMessage } from "../src/sim/90-actions/mailmsg";
import { idOf } from "./company-mail.helpers";
import { goggleBox, mail } from "./gmial.helpers";

const ids = (xs: { id: string }[]) => xs.map((m) => m.id).sort();

describe("mail search", () => {
  it("parses operators, quoted phrases, negation and OR", () => {
    expect(parseSearch('from:ada "big deal" -spam')).toEqual([
      [{ key: "from", value: "ada", not: false }], [{ key: "text", value: "big deal", not: false }], [{ key: "text", value: "spam", not: true }],
    ]);
    expect(parseSearch("subject:invoice OR subject:receipt is:unread")).toEqual([
      [{ key: "subject", value: "invoice", not: false }, { key: "subject", value: "receipt", not: false }], [{ key: "is", value: "unread", not: false }],
    ]);
    expect(parseSearch('subject:"rack quote" note:x')).toEqual([[{ key: "subject", value: "rack quote", not: false }], [{ key: "text", value: "note:x", not: false }]]);
    expect(parseSearch("  ")).toEqual([]);
  });

  it("matches every operator over one mailbox", () => {
    const { s, a, address } = goggleBox(41);
    const rack = mail(s, address, "Rack quote", { text: "Two racks in Frankfurt" });
    const bill = mail(s, address, "Invoice March", { att: [{ k: "file", name: "march.pdf", kb: 3000 }] });
    s.hour += 24 * 40;
    const late = mail(s, address, "Big deal inside", { from: "ext:bob@builder.example" });
    const label = idOf(createMailFolder(s, a, "Vendors"));
    labelMessages(s, a, [rack, bill], [label], []);
    markMessages(s, a, [rack], { read: true, star: true });
    markImportant(s, a, [bill], true);
    const sent = idOf(sendMessage(s, a, { from: address, to: [`carol@${FREEMAIL_DOMAINS[0]}`], subject: "Hi Carol", text: "Lunch?" }));
    const day = new Date(Date.UTC(2009, 3, 1)).toISOString().slice(0, 10).replace(/-/g, "/");
    const find = (q: string) => ids(searchMailbox(s, a, q));
    expect(find("from:ada")).toEqual(ids([{ id: rack }, { id: bill }]));
    expect(find("from:bob@builder.example")).toEqual([late]);
    expect(find("to:carol")).toEqual([sent]);
    expect(find("subject:invoice")).toEqual([bill]);
    expect(find("frankfurt")).toEqual([rack]);
    expect(find('"big deal"')).toEqual([late]);
    expect(find('"deal big"')).toEqual([]);
    expect(find("label:vendors")).toEqual(ids([{ id: rack }, { id: bill }]));
    expect(find(`label:${label}`)).toEqual(ids([{ id: rack }, { id: bill }]));
    expect(find("in:sent")).toEqual([sent]);
    expect(find("in:inbox").includes(sent)).toBe(false);
    expect(find("is:starred")).toEqual([rack]);
    expect(find("is:read").includes(rack)).toBe(true);
    expect(find("is:unread").includes(rack)).toBe(false);
    expect(find("is:important")).toEqual([bill]);
    expect(find("has:attachment")).toEqual([bill]);
    expect(find("larger:2M")).toEqual([bill]);
    expect(find("smaller:2M").includes(bill)).toBe(false);
    expect(find(`after:${day} from:ada`)).toEqual([]);
    expect(find(`before:${day} from:ada`)).toEqual(ids([{ id: rack }, { id: bill }]));
    expect(find(`after:${day}`)).toEqual(ids([{ id: late }, { id: sent }]));
    expect(find("subject:rack OR subject:invoice")).toEqual(ids([{ id: rack }, { id: bill }]));
    expect(find("from:ada -subject:rack")).toEqual([bill]);
    expect(find("label:vendors is:unread has:attachment")).toEqual([bill]);
  });

  it("leaves Spam and Trash out unless asked, and lists newest first", () => {
    const { s, a, address } = goggleBox(42);
    const one = mail(s, address, "Quote one");
    s.minute += 5;
    const two = mail(s, address, "Quote two");
    s.minute += 5;
    const junk = mail(s, address, "Quote junk"), gone = mail(s, address, "Quote gone");
    reportJunk(s, a, [junk], true);
    deleteMessages(s, a, [gone]);
    expect(searchMailbox(s, a, "quote").map((m) => m.id)).toEqual([two, one]);
    expect(searchMailbox(s, a, "quote in:spam").map((m) => m.id)).toEqual([junk]);
    expect(searchMailbox(s, a, "quote in:trash").map((m) => m.id)).toEqual([gone]);
    expect(ids(searchMailbox(s, a, "quote in:anywhere"))).toEqual(ids([{ id: one }, { id: two }, { id: junk }, { id: gone }]));
    moveMessages(s, a, [one], "archive");
    expect(searchMailbox(s, a, "in:inbox quote").map((m) => m.id)).toEqual([two]);
    expect(searchMailbox(s, a, "").map((m) => m.id)).toContain(one);
  });
});
