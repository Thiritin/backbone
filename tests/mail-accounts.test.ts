import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { roleAddress, seatsBilled, serverStatus, vacationOn } from "../src/sim/42-mail/accounts";
import { mxTarget } from "../src/sim/42-mail/caps";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { mxHostsAt } from "../src/sim/60-infra/company-zone";
import { salesAddress } from "../src/sim/80-business/mail";
import { bookMail, cancelMail, createTenant, setTenantPlan } from "../src/sim/90-actions/mail";
import { createMailAccount, deleteMailAccount, setExternalAccess } from "../src/sim/90-actions/mailbox";
import { fire, hire } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { idOf, mailLedger, toMonthStart } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
// Candidates of the start stay on the market at whatever hour a case jumps to.
const candidate = (s: GameState) => {
  s.candidates = s.candidates.map((c) => ({ ...c, arriveAt: Math.min(c.arriveAt, s.hour), leaveAt: Math.max(c.leaveAt, s.hour + 1) }));
  return visibleCandidates(s)[0].id;
};
const live = (s: GameState, host: string) => s.mail.tenants.find((t) => t.host === host && t.endsAt === null)!;
const boxesOf = (s: GameState, host: string) => s.mail.accounts.filter((a) => a.tenant === live(s, host).id && a.closedAt === null);

describe("mail accounts", () => {
  it("point the MX record at a booked provider at once and keep the sales address on it", () => {
    const s = readyGame(1);
    expect(mxTarget(s)?.host).toBe("ionose");
    expect(mxHostsAt(s, s.hour)).toEqual(["mx00.ionose.de", "mx01.ionose.de"]);
    expect(salesAddress(s)).toBe(`sales@${s.company.domain}`);
    cancelMail(s);
    expect(mxTarget(s)).toBeNull();
    expect(salesAddress(s)).toMatch(/@gmix\.com$/);
  });

  it("refuse a hire without a free mailbox under the company domain and make one with every hire", () => {
    const s = readyGame(2);
    cancelMail(s);
    expect(hire(s, candidate(s))).toEqual({ ok: false, error: "error.hireNoMailbox" });
    expect(s.staff).toHaveLength(0);
    bookMail(s, "hostedExchange");
    const r = hire(s, candidate(s));
    expect(r.ok).toBe(true);
    const e = s.staff.find((x) => x.id === idOf(r))!, box = s.mail.accounts.find((a) => a.employee === e.id)!;
    expect(box).toMatchObject({ domain: s.company.domain, title: e.name, roles: [], closedAt: null });
    expect(box.local).toMatch(/^[a-z]+\.[a-z]+\d*$/);
    expect(box.password).toHaveLength(8);
    expect(deleteMailAccount(s, box.id)).toMatchObject({ ok: false, error: "error.mailInUse" });
    expect(fire(s, e.id).ok).toBe(true);
    expect(s.mail.accounts.some((a) => a.id === box.id)).toBe(false);
    expect(s.mail.retired.map((x) => x.address)).toContain(`${box.local}@${box.domain}`);
  });

  it("bill every mailbox at the month start after sign-up", () => {
    const s = readyGame(3);
    toMonthStart(s);
    expect(mailLedger(s)).toMatchObject([{ amount: -10, params: { seats: 1, name: "Hosted Exchange by Ionose" } }]);
    hire(s, candidate(s));
    createMailAccount(s, { tenant: live(s, "ionose").id, local: "info", title: "Info", password: "info-pw" });
    toMonthStart(s);
    expect(mailLedger(s)).toMatchObject([{ amount: -30, params: { seats: 3 } }]);
    expect(s.company.mail).toMatchObject({ seats: 3 });
  });

  it("give a Goggle sign-up a mailbox for every employee and cap the free edition", () => {
    const s = readyGame(4);
    hire(s, candidate(s));
    s.hour = at("2011-06");
    const r = createTenant(s, { host: "goggle", plan: "free" });
    expect(r.ok).toBe(true);
    const t = s.mail.tenants.find((x) => x.id === idOf(r))!;
    expect(t.verified).toBe(false);
    expect(s.mail.accounts.filter((a) => a.tenant === t.id).map((a) => a.employee)).toEqual([s.staff[0].id]);
    for (let i = 0; i < 9; i++) expect(createMailAccount(s, { tenant: t.id, local: `box${i}`, title: "Box", password: "box-pw" }).ok).toBe(true);
    expect(createMailAccount(s, { tenant: t.id, local: "box9", title: "Box", password: "box-pw" })).toEqual({ ok: false, error: "error.mailLimit" });
    expect(setTenantPlan(s, t.id, "paid").ok).toBe(true);
    expect(createMailAccount(s, { tenant: t.id, local: "box9", title: "Box", password: "box-pw" }).ok).toBe(true);
    expect(setTenantPlan(s, t.id, "free")).toEqual({ ok: false, error: "error.mailQuotaPlan" });
  });

  it("refuse a hire at the free edition's cap until the plan is upgraded", () => {
    const s = readyGame(5);
    s.hour = at("2011-06");
    expect(bookMail(s, "goggleWorkspace").ok).toBe(true);
    const t = live(s, "goggle");
    s.mail = { ...s.mail, tenants: s.mail.tenants.map((x) => (x.id === t.id ? { ...x, plan: "free" } : x)) };
    for (let i = 1; i < 10; i++) createMailAccount(s, { tenant: t.id, local: `box${i}`, title: "Box", password: "box-pw" });
    expect(boxesOf(s, "goggle")).toHaveLength(10);
    expect(hire(s, candidate(s))).toEqual({ ok: false, error: "error.hireNoMailbox" });
    s.mail = { ...s.mail, tenants: s.mail.tenants.map((x) => (x.id === t.id ? { ...x, plan: "paid" } : x)) };
    expect(hire(s, candidate(s)).ok).toBe(true);
  });

  it("route a role by the local part and bill no shared mailbox on Lookout 365", () => {
    const s = readyGame(6);
    expect(roleAddress(s, "support")).toBe(`sales@${s.company.domain}`);
    const sales = s.mail.primary;
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === sales ? { ...a, roles: ["owner", "sales"] } : a)) };
    createMailAccount(s, { tenant: live(s, "ionose").id, local: "support", title: "Support", password: "supp-pw" });
    expect(roleAddress(s, "support")).toBe(`support@${s.company.domain}`);
    s.hour = at("2012-01");
    bookMail(s, "lookout365");
    const t = live(s, "lookout");
    expect(createMailAccount(s, { tenant: t.id, local: "team", title: "Team", password: "", shared: true }).ok).toBe(true);
    expect(seatsBilled(s, t)).toBe(1);
  });

  it("answer a client by the access switch, the poll gap and the password", () => {
    const s = readyGame(7), gmix = s.mail.accounts.find((a) => a.domain === "gmix.com")!;
    expect(serverStatus(s, gmix.id, "pop", gmix.password)).toBe("external");
    setExternalAccess(s, gmix.id, true);
    expect(serverStatus(s, gmix.id, "pop", gmix.password, 5)).toBe("poll");
    expect(serverStatus(s, gmix.id, "pop", gmix.password, 15)).toBe("ok");
    expect(serverStatus(s, gmix.id, "imap", gmix.password, 15)).toBe("external");
    expect(serverStatus(s, gmix.id, "pop", "wrong")).toBe("auth");
    const box = s.mail.accounts.find((a) => a.id === s.mail.primary)!;
    expect(vacationOn({ ...box, vacation: { on: true, subject: "", text: "", until: s.hour + 1 } }, s.hour)).toBe(true);
    expect(vacationOn({ ...box, vacation: { on: true, subject: "", text: "", until: s.hour } }, s.hour)).toBe(false);
  });

  it("give employees of an old save a mailbox on the domain tenant", () => {
    const s = readyGame(8);
    hire(s, candidate(s));
    const raw = JSON.parse(serialize(s));
    raw.mail.accounts = raw.mail.accounts.filter((a: { employee: string | null }) => !a.employee);
    const old = deserialize(JSON.stringify(raw));
    expect(old.mail.accounts.find((a) => a.employee === s.staff[0].id)?.domain).toBe(s.company.domain);
  });
});
