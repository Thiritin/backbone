import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { FREEMAIL_DOMAINS } from "../src/sim/30-customers/addresses";
import { boxOf } from "../src/sim/42-mail/model";
import type { MailAccount } from "../src/sim/42-mail/types";
import { deserialize, serialize } from "../src/sim/91-save/save";
import {
  gmialLook, gogglesLate, gogglesQuiz, inboxType, keysOn, labOn, nextStar, smartReplies, snoozeChoices, tabOf, undoPeriod,
} from "../src/sim/80-business/gmial";
import { importantLabel } from "../src/sim/80-business/mail-search";
import { sendMessage } from "../src/sim/90-actions/mailmsg";
import { goggleBox, mail } from "./gmial.helpers";

const acct = (prefs: MailAccount["prefs"] = {}) => ({ prefs }) as MailAccount;
const h = (ym: string) => hourOfMonth(ym);

describe("Gmial eras in the sim", () => {
  it("changes look at the real redesign months", () => {
    expect(["2005-01", "2011-11", "2013-05", "2018-04", "2022-07"].map((m) => gmialLook(h(m)))).toEqual(["classic", "redesign", "tabs", "material", "pill"]);
    expect(gmialLook(h("2011-10"))).toBe("classic");
  });

  it("labels important mail on arrival from 2010 by kind, sender written to and answered thread", () => {
    const old = goggleBox(81, "2009-06");
    mail(old.s, old.address, "Help", { kind: "support" });
    expect(importantLabel(old.s, old.a)).toBeUndefined();
    const { s, a, address } = goggleBox(82, "2011-03");
    const imp = () => importantLabel(s, a)?.id;
    const has = (id: string) => !!boxOf(s, a).find((m) => m.id === id)?.labels?.includes(imp() ?? "-");
    const help = mail(s, address, "Help", { kind: "support" }), hi = mail(s, address, "Hi");
    expect([has(help), has(hi)]).toEqual([true, false]);
    const pal = `pal@${FREEMAIL_DOMAINS[0]}`;
    expect(sendMessage(s, a, { from: address, to: [pal], subject: "Lunch", text: "Noon?" }).ok).toBe(true);
    expect(has(mail(s, address, "Sure", { from: `ext:${pal}` }))).toBe(true);
  });

  it("puts a message in the tab of its kind and group mail in Forums", () => {
    const { s, address } = goggleBox(83, "2014-03");
    const box = () => boxOf(s, s.mail.tenants.find((x) => x.host === "goggle")!.admin!);
    const of = (id: string) => tabOf(s, box().find((m) => m.id === id)!);
    expect([of(mail(s, address, "A", { kind: "promotion" })), of(mail(s, address, "B", { kind: "invoice" })), of(mail(s, address, "C"))]).toEqual(["promotions", "updates", "primary"]);
  });

  it("switches Labs, shortcuts, Priority Inbox and Undo Send by year", () => {
    const a = acct({ labs: "undo,nested,goggles", keys: "on", inbox: "priority" });
    expect(labOn(h("2009-02"), a, "undo")).toBe(false);
    expect(labOn(h("2009-04"), a, "undo")).toBe(true);
    expect(labOn(h("2010-02"), acct(), "nested")).toBe(true);
    expect(labOn(h("2019-06"), a, "goggles")).toBe(true);
    expect(labOn(h("2020-02"), a, "goggles")).toBe(false);
    expect([keysOn(h("2007-09"), a), keysOn(h("2007-10"), a), keysOn(h("2008-01"), acct())]).toEqual([false, true, false]);
    expect([inboxType(h("2010-07"), a), inboxType(h("2012-01"), a), inboxType(h("2019-02"), a)]).toEqual(["default", "priority", "default"]);
    expect([undoPeriod(h("2009-04"), a), undoPeriod(h("2009-04"), acct()), undoPeriod(h("2016-01"), acct()), undoPeriod(h("2016-01"), acct({ undo: 20 })), undoPeriod(h("2019-01"), acct())])
      .toEqual([10, 0, 0, 20, 5]);
  });

  it("cycles stars, picks Smart Reply chips and keeps the Mail Goggles sums for the hour", () => {
    expect(nextStar({}, [0, 2])).toEqual({ star: true, flag: null });
    expect(nextStar({ star: true }, [0, 2])).toEqual({ star: true, flag: 2 });
    expect(nextStar({ star: true, flag: 2 }, [0, 2])).toEqual({ star: false, flag: null });
    expect(smartReplies("reply")).toEqual(["thanks", "gotIt", "willDo"]);
    expect(smartReplies("support")).toHaveLength(3);
    const night = h("2012-03") + 23;
    expect(gogglesLate(night)).toBe(true);
    expect(gogglesLate(night - 10)).toBe(false);
    expect(gogglesQuiz(5, night)).toEqual(gogglesQuiz(5, night));
    expect(gogglesQuiz(5, night)).toHaveLength(5);
  });

  it("offers snooze hours ahead of now", () => {
    const now = h("2019-03") + 9;
    const c = snoozeChoices(now);
    expect(c.map((x) => x.id)).toContain("tomorrow");
    expect(c.every((x) => x.until > now)).toBe(true);
  });

  it("loads a save whose mailboxes carry none of the later settings", () => {
    const { s, a } = goggleBox(84, "2016-03");
    const back = deserialize(serialize(s));
    const box = back.mail.accounts.find((x) => x.id === a)!;
    expect([labOn(back.hour, box, "superstars"), keysOn(back.hour, box), undoPeriod(back.hour, box)]).toEqual([false, false, 0]);
  });
});
