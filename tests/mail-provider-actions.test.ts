import { describe, expect, it } from "vitest";
import { hourOfMonth, nextMonthStart } from "../src/sim/00-core/time";
import { goggleToken, verificationAt } from "../src/sim/10-catalog/mail-consumer";
import { checkMailLogin } from "../src/sim/42-mail/accounts";
import type { GameState } from "../src/sim/50-state";
import { mailProviderTick } from "../src/sim/80-business/mail-provider";
import { setCompanyRecord } from "../src/sim/90-actions/domains";
import { endTenant, resubscribe } from "../src/sim/90-actions/mail";
import { deleteGmixMailbox, restoreUser, setGmixTier, signUpGmix, signUpGoggle, suspendUser, upgradeGoggleEdition, verifyDomain } from "../src/sim/90-actions/mail-provider";
import { createMailAccount } from "../src/sim/90-actions/mailbox";
import { hire } from "../src/sim/90-actions/staff";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";
import { tick } from "../src/sim/88-tick/tick";

// Skips to the hour before the next month start and ticks into it.
const toMonthStart = (s: GameState) => { s.hour = nextMonthStart(s.hour) - 1; tick(s); };

const at = (ym: string) => hourOfMonth(ym);
const charged = (s: GameState) => s.ledger.filter((e) => e.hour === s.hour && e.key === "ledger.companyMail" && e.params?.name === "GMix");
const tenantOf = (s: GameState, accountId: string) => {
  const a = s.mail.accounts.find((x) => x.id === accountId)!;
  return s.mail.tenants.find((t) => t.id === a.tenant)!;
};
const boxes = (s: GameState, tenantId: string) => s.mail.accounts.filter((a) => a.tenant === tenantId);
const gmix = (s: GameState, local: string, plan = "pro") => signUpGmix(s, { local, title: "Box", password: "secret-pw", plan });
const goggle = (s: GameState, plan: string) => signUpGoggle(s, { domain: s.company.domain!, plan, local: "admin", title: "Admin", password: "admin-pw" });

describe("provider actions", () => {
  it("bill a GMix sign-up from the next month start and charge nothing for a cancel before it", () => {
    const s = readyGame(11);
    const paid = idOf(gmix(s, "paid.box")), trial = idOf(gmix(s, "trial.box"));
    expect(tenantOf(s, paid).admin).toBe(paid);
    expect(err(endTenant(s, tenantOf(s, trial).id))).toBe("ok");
    toMonthStart(s);
    expect(charged(s)).toHaveLength(1);
    expect(boxes(s, tenantOf(s, paid).id).every((a) => a.closedAt === null)).toBe(true);
    expect(s.mail.accounts.some((a) => a.id === trial)).toBe(false);
  });

  it("cap a GMix tier at one mailbox and drop nothing when the box is refused", () => {
    const s = readyGame(12);
    const id = idOf(gmix(s, "one.box")), t = tenantOf(s, id), before = s.mail.tenants.length;
    expect(err(createMailAccount(s, { tenant: t.id, local: "two.box", title: "Box", password: "secret-pw" }))).toBe("error.mailLimit");
    expect(err(gmix(s, "one.box"))).not.toBe("ok");
    expect(s.mail.tenants).toHaveLength(before);
  });

  it("raise a GMix tier at once and let a cheaper one wait for the month start", () => {
    const s = readyGame(13);
    const t = tenantOf(s, idOf(gmix(s, "tier.box", "pro")));
    expect(err(setGmixTier(s, t.id, "top"))).toBe("ok");
    expect(s.mail.tenants.find((x) => x.id === t.id)!.plan).toBe("top");
    expect(err(setGmixTier(s, t.id, "free"))).toBe("ok");
    expect(s.mail.tenants.find((x) => x.id === t.id)).toMatchObject({ plan: "top", next: "free" });
    toMonthStart(s);
    expect(s.mail.tenants.find((x) => x.id === t.id)!.plan).toBe("free");
    expect(charged(s)).toHaveLength(0);
  });

  it("free a deleted GMix address only with the right password", () => {
    const s = readyGame(14);
    const id = idOf(gmix(s, "gone.box"));
    expect(err(deleteGmixMailbox(s, id, "wrong-pw"))).toBe("error.mailLogin");
    expect(err(deleteGmixMailbox(s, id, "secret-pw"))).toBe("ok");
    expect(err(gmix(s, "gone.box"))).toBe("ok");
  });

  it("give a Goggle sign-up a mailbox for every employee and an admin that cannot be suspended", () => {
    const s = readyGame(15);
    s.candidates = s.candidates.map((c) => ({ ...c, arriveAt: Math.min(c.arriveAt, s.hour), leaveAt: Math.max(c.leaveAt, s.hour + 1) }));
    expect(hire(s, visibleCandidates(s)[0].id).ok).toBe(true);
    s.hour = at("2011-06");
    expect(err(signUpGoggle(s, { domain: "elsewhere.com", plan: "free", local: "admin", title: "Admin", password: "admin-pw" }))).toBe("error.needsDomain");
    const admin = idOf(goggle(s, "free")), t = tenantOf(s, admin);
    expect(boxes(s, t.id).filter((a) => a.employee === s.staff[0].id)).toHaveLength(1);
    expect(err(suspendUser(s, admin))).toBe("error.mailAdmin");
    const user = idOf(createMailAccount(s, { tenant: t.id, local: "intern", title: "Intern", password: "intern-pw" })), address = `intern@${t.domain}`;
    expect(err(suspendUser(s, user))).toBe("ok");
    expect(err(checkMailLogin(s, address, "intern-pw"))).toBe("error.mailSuspended");
    expect(err(restoreUser(s, user))).toBe("ok");
    expect(err(checkMailLogin(s, address, "intern-pw"))).toBe("ok");
  });

  it("verify a Goggle domain once the shown record resolves", () => {
    const s = readyGame(16);
    s.hour = at("2013-03");
    const t = tenantOf(s, idOf(goggle(s, "paid")));
    expect(err(verifyDomain(s, t.id))).toBe("error.goggleVerify");
    const want = verificationAt(t.since, goggleToken(s.seed, t.domain));
    expect(err(setCompanyRecord(s, { type: want.type, name: want.name, ttl: 300, data: `"${want.data}"` }))).toBe("ok");
    s.hour += 1;
    expect(err(verifyDomain(s, t.id))).toBe("ok");
    expect(s.mail.tenants.find((x) => x.id === t.id)!.verified).toBe(true);
  });

  it("end a Goggle cancel at the month end, keep the boxes 20 days and take a resubscribe until then", () => {
    const s = readyGame(17);
    s.hour = at("2013-03");
    const t = tenantOf(s, idOf(goggle(s, "paid")));
    expect(err(endTenant(s, t.id))).toBe("ok");
    toMonthStart(s);
    expect(boxes(s, t.id).every((a) => a.closedAt === s.hour)).toBe(true);
    expect(err(resubscribe(s, t.id))).toBe("ok");
    expect(boxes(s, t.id).every((a) => a.closedAt === null)).toBe(true);
    endTenant(s, t.id);
    s.hour = at("2013-05") + 19 * 24;
    mailProviderTick(s);
    expect(boxes(s, t.id).length).toBeGreaterThan(0);
    s.hour += 24;
    mailProviderTick(s);
    expect(boxes(s, t.id)).toHaveLength(0);
    expect(err(resubscribe(s, t.id))).toBe("error.mailNoService");
  });

  it("lock a free Goggle tenant on 2022-05-01 and unlock it with a paid edition", () => {
    const s = readyGame(18);
    s.hour = at("2011-06");
    const admin = idOf(goggle(s, "free")), t = tenantOf(s, admin);
    s.hour = at("2022-01");
    mailProviderTick(s);
    expect((s.mail.msgs[admin] ?? []).map((m) => m.topic)).toContain("goggleConversion");
    s.hour = at("2022-05");
    mailProviderTick(s);
    expect(s.mail.tenants.find((x) => x.id === t.id)!.locked).toBe(true);
    expect(err(upgradeGoggleEdition(s, t.id))).toBe("ok");
    expect(s.mail.tenants.find((x) => x.id === t.id)).toMatchObject({ plan: "paid" });
    expect(s.mail.tenants.find((x) => x.id === t.id)!.locked).toBeUndefined();
  });

  it("load a save from before tier changes and suspensions", () => {
    const s = readyGame(19);
    const id = idOf(gmix(s, "old.box"));
    const back = deserialize(serialize(s));
    expect(back.mail.tenants.find((t) => t.admin === id)?.next).toBeUndefined();
    expect(back.mail.accounts.find((a) => a.id === id)?.suspended).toBeUndefined();
  });
});
