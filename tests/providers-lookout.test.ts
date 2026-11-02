import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { lookoutToken, owaAt } from "../src/sim/10-catalog/mail-hosted";
import { GRACE_DAYS, mailboxCap, mailPlan } from "../src/sim/10-catalog/mail-providers";
import { checkMailLogin, seatsBilled } from "../src/sim/42-mail/accounts";
import { capsOf, mxTarget } from "../src/sim/42-mail/caps";
import { deliver, deliveryTrace } from "../src/sim/42-mail/deliver";
import { importTick } from "../src/sim/42-mail/imports";
import type { GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { cancelMail, endTenant } from "../src/sim/90-actions/mail";
import { addOrgRule, signUpLookout, verifyLookout } from "../src/sim/90-actions/mail-hosted";
import { createMailAccount, importMail, requestPasswordReset, resetPassword, setAccountRoles, setExternalAccess, setPrimary } from "../src/sim/90-actions/mailbox";
import { err, idOf, run } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const lookout = (s: GameState) => s.mail.tenants.find((t) => t.host === "lookout" && t.endsAt === null)!;
const user = (s: GameState, local: string) => idOf(createMailAccount(s, { tenant: lookout(s).id, local, title: local, password: "user-pw" }));
const addr = (s: GameState, local: string) => `${local}@${s.company.domain}`;

// A company on free GMix with no MX record, signed up to Lookout 365.
function signedUp(seed: number, ym: string, plan = "business"): GameState {
  const s = readyGame(seed);
  s.hour = at(ym);
  cancelMail(s);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  s.hour += 2;
  expect(err(signUpLookout(s, { domain: s.company.domain!, plan, local: "admin", title: "Admin", password: "admin-pw" }))).toBe("ok");
  return s;
}
function live(seed: number, ym: string): GameState {
  const s = signedUp(seed, ym);
  setCompanyRecord(s, { type: "TXT", name: "@", ttl: 300, data: lookoutToken(s.seed, s.company.domain!) });
  setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "0 mail.protection.lookout365.com" });
  s.hour += 2;
  expect(err(verifyLookout(s, lookout(s).id))).toBe("ok");
  expect(mxTarget(s)?.id).toBe(lookout(s).id);
  return s;
}

describe("Lookout 365", () => {
  it("verifies the domain only once the TXT record is published", () => {
    const s = signedUp(1, "2012-03");
    expect(lookout(s).verified).toBe(false);
    expect(err(verifyLookout(s, lookout(s).id))).toBe("error.lookoutVerify");
    setCompanyRecord(s, { type: "TXT", name: "@", ttl: 300, data: lookoutToken(s.seed, s.company.domain!) });
    s.hour += 2;
    expect(err(verifyLookout(s, lookout(s).id))).toBe("ok");
    expect(lookout(s).verified).toBe(true);
  });

  it("is not sold before 2011 and sells Basic with ten users and Standard with a hundred at a euro more", () => {
    const s = readyGame(2);
    s.hour = at("2010-05");
    cancelMail(s);
    expect(err(signUpLookout(s, { domain: s.company.domain!, plan: "business", local: "admin", title: "A", password: "admin-pw" }))).toBe("error.mailProviderLater");
    const h = at("2015-01");
    expect([mailboxCap("lookout", "business", h), mailboxCap("lookout", "standard", h)]).toEqual([10, 100]);
    expect(mailPlan("lookout", "standard")!.price(2015) - mailPlan("lookout", "business")!.price(2015)).toBeCloseTo(1);
  });

  it("bills a user and not a shared mailbox", () => {
    const s = live(3, "2013-04");
    const before = seatsBilled(s, lookout(s));
    expect(err(createMailAccount(s, { tenant: lookout(s).id, local: "info", title: "Info", password: "", shared: true }))).toBe("ok");
    expect(seatsBilled(s, lookout(s))).toBe(before);
    user(s, "ada");
    expect(seatsBilled(s, lookout(s))).toBe(before + 1);
  });

  it("shows mail held for a full mailbox in Message trace", () => {
    const s = live(4, "2014-02");
    const ada = user(s, "ada"), quota = capsOf(s, s.mail.accounts.find((a) => a.id === ada)!).quotaMb;
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === ada ? { ...a, usedKb: quota * 1024 } : a)) };
    deliver(s, { to: addr(s, "ada"), from: "n:Supplier", kind: "notice", topic: "x" });
    expect(deliveryTrace(s, { address: addr(s, "ada") })[0]).toMatchObject({ result: "queued", why: "full" });
  });

  it("applies an organisation rule to every user mailbox", () => {
    const s = live(5, "2015-06");
    const ada = user(s, "ada"), admin = lookout(s).admin!;
    expect(err(addOrgRule(s, lookout(s).id, { name: "Invoices", on: true, match: "all", conds: [{ field: "subject", op: "contains", value: "Invoice" }], acts: [{ do: "read" }] }))).toBe("ok");
    expect([ada, admin].map((id) => s.mail.filters.filter((f) => f.accountId === id).length)).toEqual([1, 1]);
  });

  it("migrates a mailbox into the target, and cancelling before the import loses the mail after the grace period", () => {
    const s = live(6, "2016-03");
    const gmix = s.mail.accounts.find((a) => a.domain !== s.company.domain && a.closedAt === null)!;
    const n = (s.mail.msgs[gmix.id] ?? []).filter((m) => m.folder === "inbox").length;
    expect(n).toBeGreaterThan(0);
    const ada = user(s, "ada");
    expect(err(importMail(s, ada, { source: `${gmix.local}@${gmix.domain}`, password: gmix.password, proto: "imap" }))).toBe("error.mailExternal");
    setExternalAccess(s, gmix.id, true);
    expect(err(importMail(s, ada, { source: `${gmix.local}@${gmix.domain}`, password: gmix.password, proto: "imap" }))).toBe("ok");
    s.hour = s.mail.imports[s.mail.imports.length - 1].doneAt;
    importTick(s);
    expect((s.mail.msgs[ada] ?? []).length).toBeGreaterThanOrEqual(n);

    deliver(s, { to: addr(s, "ada"), from: "n:Supplier", kind: "notice", topic: "x" });
    // The import moved the primary and the roles to ada; giving them back lets the tenant go.
    expect(err(endTenant(s, lookout(s).id))).toBe("error.mailRoleInUse");
    const roles = s.mail.accounts.find((a) => a.id === ada)!.roles;
    expect(err(setPrimary(s, gmix.id))).toBe("ok");
    expect(err(setAccountRoles(s, gmix.id, roles))).toBe("ok");
    expect(err(setAccountRoles(s, ada, []))).toBe("ok");
    expect(err(endTenant(s, lookout(s).id))).toBe("ok");
    const ends = s.mail.tenants.find((t) => t.host === "lookout")!.endsAt!;
    s.hour = ends + GRACE_DAYS.lookout * 24 + 1;
    run(s, 24);
    expect(s.mail.accounts.some((a) => a.id === ada)).toBe(false);
    expect(s.mail.msgs[ada] ?? []).toEqual([]);
  });

  it("runs the web mail generation of the year", () => {
    expect(["2011-08", "2014-01", "2017-01"].map((m) => owaAt("lookout", at(m)))).toEqual(["2010", "2013", "web"]);
  });

  it("sends the admin's reset code by a letter from Lookout 365 and refuses a user's reset", () => {
    const s = signedUp(8, "2012-03");
    user(s, "anna");
    expect(err(requestPasswordReset(s, addr(s, "anna")))).toBe("error.mailAdmin");
    expect(err(requestPasswordReset(s, addr(s, "admin")))).toBe("ok");
    const a = s.mail.accounts.find((x) => x.id === lookout(s).admin)!, letter = s.letters.find((l) => l.id === a.reset!.letter)!;
    expect([letter.from, letter.link]).toEqual(["Lookout 365", "admin.lookout365.macrosoft.com/reset"]);
    run(s, letter.at - s.hour + 1);
    expect(err(resetPassword(s, addr(s, "admin"), a.reset!.code, "fresh-pw"))).toBe("ok");
    expect(checkMailLogin(s, addr(s, "admin"), "fresh-pw").ok).toBe(true);
  });

  it("keeps a Lookout tenant through a save", () => {
    const s = signedUp(7, "2012-09", "standard");
    expect(deserialize(serialize(s)).mail.tenants.find((t) => t.host === "lookout" && t.endsAt === null)?.plan).toBe("standard");
  });
});
