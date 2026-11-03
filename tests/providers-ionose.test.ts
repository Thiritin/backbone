import { describe, expect, it } from "vitest";
import { hourOfMonth, nextMonthStart } from "../src/sim/00-core/time";
import { owaAt } from "../src/sim/10-catalog/mail-hosted";
import { mailboxCap, mailPlan, quotaMbAt } from "../src/sim/10-catalog/mail-providers";
import { checkMailLogin, seatsBilled } from "../src/sim/42-mail/accounts";
import { mxTarget } from "../src/sim/42-mail/caps";
import { deliver, MAIL_HOPS } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { cancelMail, setTenantPlan } from "../src/sim/90-actions/mail";
import { checkIonoseDomain, orderIonose } from "../src/sim/90-actions/mail-hosted";
import { addAlias, createMailAccount, requestPasswordReset, resetPassword } from "../src/sim/90-actions/mailbox";
import { setVacation } from "../src/sim/90-actions/mailmsg";
import { hire } from "../src/sim/90-actions/staff";
import { err, idOf, mailLedger, run } from "./company-mail.helpers";
import { readyGame, withDesk } from "./fixtures";
import { tick } from "../src/sim/88-tick/tick";

// Skips to the hour before the next month start and ticks into it.
const toMonthStart = (s: GameState) => { s.hour = nextMonthStart(s.hour) - 1; tick(s); };

const at = (ym: string) => hourOfMonth(ym);
const ionose = (s: GameState) => s.mail.tenants.find((t) => t.host === "ionose" && t.endsAt === null)!;
const box = (s: GameState, local: string) => idOf(createMailAccount(s, { tenant: ionose(s).id, local, title: local, password: "box-pw" }));
const pointMx = (s: GameState) => {
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "10 mx00.ionose.de" });
  s.hour += 2;
};

function ordered(seed: number, ym: string, plan = "exchange"): GameState {
  const s = readyGame(seed);
  s.hour = at(ym);
  // readyGame books Hosted Exchange through the old sheet; the company starts from GMix here.
  cancelMail(s);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  s.hour += 2;
  expect(err(orderIonose(s, { domain: s.company.domain!, plan, local: "info", title: "Info", password: "owner-pw" }))).toBe("ok");
  return s;
}

describe("Hosted Exchange by Ionose", () => {
  it("orders a tenant that turns verified once the MX points at Ionose", () => {
    const s = ordered(1, "2007-04");
    const t = ionose(s);
    expect(t.admin).toBe(s.mail.accounts.find((a) => a.local === "info" && a.tenant === t.id)!.id);
    expect(t.verified).toBe(false);
    expect(err(checkIonoseDomain(s, t.id))).toBe("error.ionoseMx");
    pointMx(s);
    expect(err(checkIonoseDomain(s, t.id))).toBe("ok");
    expect(mxTarget(s)?.id).toBe(t.id);
    expect(err(orderIonose(s, { domain: "other.example", plan: "exchange", local: "a", title: "A", password: "secret-pw" }))).toBe("error.needsDomain");
  });

  it("sells Basic with ten mailboxes and Business with a hundred at a euro more and double the quota", () => {
    const h = at("2010-02");
    expect([mailboxCap("ionose", "exchange", h), mailboxCap("ionose", "business", h)]).toEqual([10, 100]);
    expect(mailPlan("ionose", "business")!.price(2010) - mailPlan("ionose", "exchange")!.price(2010)).toBeCloseTo(1);
    expect(quotaMbAt("ionose", "business", h)).toBe(2 * quotaMbAt("ionose", "exchange", h));
  });

  it("bills an added mailbox at the seat price and an alias for nothing", () => {
    const s = ordered(2, "2008-03");
    pointMx(s);
    checkIonoseDomain(s, ionose(s).id);
    const before = seatsBilled(s, ionose(s)), ada = box(s, "ada");
    expect(err(addAlias(s, ada, "hello"))).toBe("ok");
    expect(seatsBilled(s, ionose(s))).toBe(before + 1);
    toMonthStart(s);
    const line = mailLedger(s).find((e) => e.params?.seats === before + 1)!;
    expect(line.amount).toBeCloseTo(-(before + 1) * mailPlan("ionose", "exchange")!.price(2008));
  });

  it("refuses an eleventh mailbox on Basic and a hire, and takes both after the change to Business", () => {
    const s = ordered(3, "2009-05");
    pointMx(s);
    checkIonoseDomain(s, ionose(s).id);
    for (let i = 0; seatsBilled(s, ionose(s)) < 10; i++) box(s, `box${i}`);
    expect(err(createMailAccount(s, { tenant: ionose(s).id, local: "extra", title: "Extra", password: "box-pw" }))).toBe("error.mailLimit");
    const c = s.candidates[0];
    s.candidates = [{ ...c, arriveAt: 0, leaveAt: s.hour + 1000 }, ...s.candidates.slice(1)];
    expect(err(hire(withDesk(s), c.id))).toBe("error.hireNoMailbox");
    expect(err(setTenantPlan(s, ionose(s).id, "business"))).toBe("ok");
    expect(err(hire(withDesk(s), c.id))).toBe("ok");
  });

  it("sends the reset code by letter, keeps the old password until the reset and refuses a wrong code", () => {
    const s = ordered(4, "2010-09");
    expect(err(requestPasswordReset(s, `info@${s.company.domain}`))).toBe("ok");
    expect(err(requestPasswordReset(s, `info@${s.company.domain}`))).toBe("error.mailResetOpen");
    const a = s.mail.accounts.find((x) => x.id === ionose(s).admin)!, letter = s.letters.find((l) => l.id === a.reset!.letter)!;
    expect(letter.link).toBe("www.ionose.com/control/reset");
    const days = (letter.at - s.hour) / 24;
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(5);
    run(s, letter.at - s.hour + 1);
    expect(s.letters.find((l) => l.id === letter.id)!.arrived).toBe(true);
    expect(checkMailLogin(s, `info@${s.company.domain}`, "owner-pw").ok).toBe(true);
    expect(err(resetPassword(s, `info@${s.company.domain}`, "000000", "fresh-pw"))).toBe("error.mailCode");
    expect(err(resetPassword(s, `info@${s.company.domain}`, a.reset!.code, "fresh-pw"))).toBe("ok");
    expect(checkMailLogin(s, `info@${s.company.domain}`, "owner-pw").ok).toBe(false);
    expect(checkMailLogin(s, `info@${s.company.domain}`, "fresh-pw").ok).toBe(true);
  });

  it("lets two mailboxes on vacation answer each other until the hop limit", () => {
    const s = ordered(5, "2011-07");
    pointMx(s);
    checkIonoseDomain(s, ionose(s).id);
    const ada = box(s, "ada"), bob = box(s, "bob");
    for (const id of [ada, bob]) expect(err(setVacation(s, id, { on: true, subject: "Away", text: "Back soon", until: null }))).toBe("ok");
    deliver(s, { to: `bob@${s.company.domain}`, from: `acct:${ada}`, kind: "reply", own: { subject: "Hi", text: "Hello" } });
    const auto = [ada, bob].flatMap((id) => (s.mail.msgs[id] ?? []).filter((m) => m.auto && m.folder === "sent")).length;
    expect(auto).toBeGreaterThan(2);
    expect(auto).toBeLessThanOrEqual(MAIL_HOPS + 2);
  });

  it("runs the web mail generation of the year", () => {
    expect(["2006-01", "2010-01", "2014-01", "2018-01", "2022-01"].map((m) => owaAt("ionose", at(m)))).toEqual(["2003", "2007", "2010", "2013", "web"]);
  });

  it("keeps an Ionose tenant through a save", () => {
    const s = ordered(6, "2012-02", "business");
    const back = deserialize(serialize(s));
    expect(ionose(back).plan).toBe("business");
    expect(back.mail.accounts.find((a) => a.id === ionose(back).admin)?.local).toBe("info");
  });
});
