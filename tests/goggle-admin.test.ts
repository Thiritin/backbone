import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { mailPlan } from "../src/sim/10-catalog/mail-providers";
import { checkMailLogin, seatsBilled } from "../src/sim/42-mail/accounts";
import { mxTarget } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { goggleReport } from "../src/sim/80-business/mail-provider";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { setTenantLock, verifyTenant } from "../src/sim/90-actions/mail";
import { deleteGoggleUser, makeGoggleAdmin, migrateMailbox, signUpGmix, signUpGoggle, suspendUser, upgradeGoggleEdition } from "../src/sim/90-actions/mail-provider";
import { addAlias, createMailAccount, createMailGroup, setCatchAll, setExternalAccess } from "../src/sim/90-actions/mailbox";
import { hire } from "../src/sim/90-actions/staff";
import { err, idOf, mailLedger, toMonthStart } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const goggle = (s: GameState) => s.mail.tenants.find((t) => t.host === "goggle")!;
// Inbox mail from the test sender, so a mailbox's welcome message does not count.
const inbox = (s: GameState, id: string) => (s.mail.msgs[id] ?? []).filter((m) => m.folder === "inbox" && (m.from === "n:Supplier" || m.from === "n:Bank"));
const user = (s: GameState, local: string) => idOf(createMailAccount(s, { tenant: goggle(s).id, local, title: local, password: "user-pw" }));

// A Goggle tenant that is verified and named by the MX record, so mail to the company domain reaches it.
function live(seed: number, ym: string, plan = "paid"): GameState {
  const s = readyGame(seed);
  s.hour = at(ym);
  expect(err(signUpGoggle(s, { domain: s.company.domain!, plan, local: "admin", title: "Admin", password: "admin-pw" }))).toBe("ok");
  verifyTenant(s, goggle(s).id);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "1 aspmx.l.goggle.com" });
  s.hour += 2;
  expect(mxTarget(s)?.id).toBe(goggle(s).id);
  return s;
}
const send = (s: GameState, local: string) => deliver(s, { to: `${local}@${s.company.domain}`, from: "n:Supplier", kind: "notice", topic: "x" });

describe("Goggle Admin console", () => {
  it("delivers an alias to its user, copies a group to every member without billing it, and catches unknown names", () => {
    const s = live(1, "2009-03");
    const ada = user(s, "ada"), bob = user(s, "bob");
    expect(err(addAlias(s, ada, "hello"))).toBe("ok");
    send(s, "hello");
    expect(inbox(s, ada).length).toBe(1);
    const seats = seatsBilled(s, goggle(s));
    expect(err(createMailGroup(s, { tenant: goggle(s).id, local: "team", title: "Team", members: [ada, bob] }))).toBe("ok");
    expect(seatsBilled(s, goggle(s))).toBe(seats);
    send(s, "team");
    expect([inbox(s, ada).length, inbox(s, bob).length]).toEqual([2, 1]);
    expect(err(setCatchAll(s, bob))).toBe("ok");
    send(s, "nobody-here");
    expect(inbox(s, bob).length).toBe(2);
  });

  it("drops a deleted user's mail without a transfer and keeps it under a label with one", () => {
    const s = live(2, "2011-03");
    const ada = user(s, "ada"), bob = user(s, "bob"), cy = user(s, "cy");
    send(s, "ada");
    send(s, "bob");
    const before = (s.mail.msgs[cy] ?? []).length;
    expect(err(deleteGoggleUser(s, ada, { to: null, alias: false, transfer: false }))).toBe("ok");
    expect(s.mail.msgs[ada]).toBeUndefined();
    expect(err(deleteGoggleUser(s, bob, { to: cy, alias: true, transfer: true }))).toBe("ok");
    const moved = s.mail.msgs[cy].slice(before);
    expect(moved.filter((m) => m.from === "n:Supplier").length).toBe(1);
    expect(moved.every((m) => m.folder === "archive" && m.labels?.[0] === moved[0].labels![0])).toBe(true);
    expect(s.mail.folders.find((f) => f.id === moved[0].labels![0])!.name).toBe(`bob@${s.company.domain}`);
    send(s, "bob");
    expect(inbox(s, cy).length).toBe(1);
  });

  it("refuses the transfer before 2010 and an employee's mailbox at any time", () => {
    const s = live(3, "2009-03");
    const ada = user(s, "ada"), bob = user(s, "bob");
    expect(err(deleteGoggleUser(s, ada, { to: bob, alias: false, transfer: true }))).toBe("error.mailProviderLater");
    const staffBox = s.mail.accounts.find((a) => a.tenant === goggle(s).id && a.employee);
    if (staffBox) expect(err(deleteGoggleUser(s, staffBox.id, { to: null, alias: false, transfer: false }))).toBe("error.mailInUse");
    expect(err(deleteGoggleUser(s, goggle(s).admin!, { to: null, alias: false, transfer: false }))).toBe("error.mailAdmin");
    expect(err(makeGoggleAdmin(s, ada))).toBe("ok");
    expect(goggle(s).admin).toBe(ada);
  });

  it("bills every mailbox at the catalog price, suspended ones too", () => {
    const s = live(4, "2014-03");
    const ada = user(s, "ada");
    expect(err(suspendUser(s, ada))).toBe("ok");
    const seats = seatsBilled(s, goggle(s));
    toMonthStart(s);
    const line = mailLedger(s).find((e) => e.params?.name === "Goggle Workspace")!;
    expect(line.params!.seats).toBe(seats);
    expect(line.amount).toBeCloseTo(-seats * mailPlan("goggle", "paid")!.price(2014));
  });

  it("refuses a hire at the Standard Edition cap and takes it after the upgrade", () => {
    const s = live(5, "2011-06", "free");
    for (let i = 0; seatsBilled(s, goggle(s)) < 10; i++) user(s, `box${i}`);
    const c = s.candidates[0];
    s.candidates = [{ ...c, arriveAt: 0, leaveAt: s.hour + 1000 }, ...s.candidates.slice(1)];
    expect(err(hire(s, c.id))).toBe("error.hireNoMailbox");
    expect(err(upgradeGoggleEdition(s, goggle(s).id))).toBe("ok");
    expect(err(hire(s, c.id))).toBe("ok");
  });

  it("migrates a mailbox's Inbox once and refuses FreeMix over IMAP before 2012", () => {
    const s = live(6, "2011-03");
    const ada = user(s, "ada"), box = idOf(signUpGmix(s, { local: "old.box", title: "Old", password: "old-pw", plan: "pro" }));
    setExternalAccess(s, box, true);
    for (let i = 0; i < 3; i++) deliver(s, { to: "old.box@gmix.com", from: "n:Bank", kind: "bank", topic: "x" });
    expect(err(migrateMailbox(s, ada, { source: "old.box@gmix.com", password: "wrong", proto: "imap" }))).toBe("error.mailLogin");
    expect(err(migrateMailbox(s, ada, { source: "old.box@gmix.com", password: "old-pw", proto: "imap" }))).toBe("ok");
    expect(inbox(s, ada).length).toBe(3);
    expect(inbox(s, box).length).toBe(3);
    expect(s.mail.fetch.length).toBe(0);
    setExternalAccess(s, idOf(signUpGmix(s, { local: "free.box", title: "Free", password: "free-pw", plan: "free" })), true);
    expect(err(migrateMailbox(s, ada, { source: "free.box@gmix.com", password: "free-pw", proto: "imap" }))).not.toBe("ok");
  });

  it("reports sent and received mail per user", () => {
    const s = live(7, "2014-03");
    const ada = user(s, "ada");
    send(s, "ada");
    const r = goggleReport(s, goggle(s).id);
    expect(r.rows.find((x) => x.id === ada)).toMatchObject({ sent: 0, received: (s.mail.msgs[ada] ?? []).length });
    expect(inbox(s, ada).length).toBe(1);
    expect(r.sent).toBe(0);
  });

  it("lets only the administrator of a locked tenant through the console sign-in", () => {
    const s = live(8, "2009-03");
    const d = s.company.domain!;
    user(s, "ada");
    setTenantLock(s, goggle(s).id, true);
    expect(err(checkMailLogin(s, `admin@${d}`, "admin-pw"))).toBe("error.mailLocked");
    expect(err(checkMailLogin(s, `admin@${d}`, "admin-pw", true))).toBe("ok");
    expect(err(checkMailLogin(s, `ada@${d}`, "user-pw", true))).toBe("error.mailLocked");
  });
});
