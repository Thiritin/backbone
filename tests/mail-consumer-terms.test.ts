import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { IMAP_FREE_FROM, mailboxCap, mailPlan, mxSetAt, onSale, quotaMbAt } from "../src/sim/10-catalog/mail-providers";
import { brandAt, categoryOf, editionAt, importantOf, verificationAt } from "../src/sim/10-catalog/mail-consumer";
import { capsOf } from "../src/sim/42-mail/caps";
import type { MailKind, Message } from "../src/sim/42-mail/types";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const KINDS: MailKind[] = ["support", "order", "notice", "licence", "invoice", "bank", "registrar", "authority", "host", "staff",
  "newsletter", "promotion", "spam", "bounce", "system", "reply", "alert"];
const msg = (kind: MailKind, from = "n:Vendor", id = "m1"): Message =>
  ({ id, thread: id, folder: "inbox", from, to: "sales@kellerhost.de", kind, topic: "x", p: {}, at: 0, kb: 1 }) as Message;

describe("consumer mail terms", () => {
  it("open IMAP to FreeMix in IMAP_FREE_FROM and keep it on the paid tiers from the start", () => {
    const s = newGame(1), box = s.mail.accounts[0];
    s.hour = at(`${IMAP_FREE_FROM - 1}-12`);
    expect(capsOf(s, box)).toMatchObject({ imap: false, pop: true });
    s.hour = at(`${IMAP_FREE_FROM}-01`);
    expect(capsOf(s, box).imap).toBe(true);
    expect([mailPlan("gmix", "pro")!.imapFrom, mailPlan("gmix", "top")!.imapFrom]).toEqual([2005, 2005]);
    expect(["free", "pro", "top"].map((p) => [quotaMbAt("gmix", p, at("2010-01")), mailPlan("gmix", p)!.price(2010), mailPlan("gmix", p)!.ads]))
      .toEqual([[1024, 0, true], [5120, 2.99, false], [10240, 4.99, false]]);
  });

  it("close the free Goggle edition to new domains in 2012-12 and cap it by sign-up month", () => {
    const free = mailPlan("goggle", "free")!;
    expect([at("2006-07"), at("2006-08"), at("2012-11"), at("2012-12")].map((h) => onSale(free, h))).toEqual([false, true, true, false]);
    expect(["2006-08", "2008-01", "2009-06", "2011-04", "2011-05"].map((m) => mailboxCap("goggle", "free", at(m)))).toEqual([200, 100, 50, 50, 10]);
    expect(mailboxCap("goggle", "paid", at("2015-01"))).toBeNull();
    expect(["2007-02", "2007-10", "2013-05"].map((m) => quotaMbAt("goggle", "paid", at(m)))).toEqual([10240, 25600, 30720]);
  });

  it("name the product and its editions by date", () => {
    expect(["2006-08", "2007-02", "2016-09", "2020-10"].map((m) => brandAt(at(m)))).toEqual(["appsDomain", "apps", "swoot", "workspace"]);
    expect(["2007-02", "2010-11", "2014-09", "2016-09", "2020-10"].map((m) => editionAt("paid", at(m)))).toEqual(["premier", "business", "work", "basic", "starter"]);
    expect([editionAt("free", at("2008-01")), editionAt("free", at("2017-01"))]).toEqual(["standard", "legacy"]);
  });

  it("print five MX records, reweight them in 2013 and cut them to one in 2023", () => {
    const set = (m: string) => mxSetAt("goggle", "kellerhost.de", at(m));
    expect(set("2010-01").map(([p]) => p)).toEqual([10, 20, 20, 30, 30]);
    expect(set("2013-01").map(([p]) => p)).toEqual([1, 5, 5, 10, 10]);
    expect(set("2023-01")).toEqual([[1, "smtp.goggle.com"]]);
    expect(mxSetAt("self", "kellerhost.de", 0)).toEqual([[10, "mail.kellerhost.de"]]);
  });

  it("verify by CNAME before 2012 and by TXT after", () => {
    expect(verificationAt(at("2011-12"), "ab12")).toEqual({ type: "CNAME", name: "goggleab12", data: "goggle.com" });
    expect(verificationAt(at("2012-01"), "ab12")).toEqual({ type: "TXT", name: "@", data: "goggle-site-verification=ab12" });
  });

  it("sort every kind into a tab and mark the important ones", () => {
    const tabs = Object.fromEntries(KINDS.map((k) => [k, categoryOf(k)]));
    expect(tabs).toMatchObject({ support: "primary", reply: "primary", invoice: "updates", bounce: "updates", newsletter: "promotions" });
    expect(categoryOf("support", true)).toBe("forums");
    expect(KINDS.filter((k) => importantOf(msg(k), new Set(), new Set()))).toEqual(["support", "order", "staff"]);
    expect(importantOf(msg("invoice", "bank@sparkasse.de"), new Set(["bank@sparkasse.de"]), new Set())).toBe(true);
    expect(importantOf(msg("invoice"), new Set(), new Set(["m1"]))).toBe(true);
  });

  it("load a save whose Goggle tenant carries the old edition id", () => {
    const s = newGame(1);
    s.mail = { ...s.mail, tenants: [{ ...s.mail.tenants[0], host: "goggle", plan: "premier" }] };
    expect(deserialize(serialize(s)).mail.tenants[0].plan).toBe("paid");
  });
});
