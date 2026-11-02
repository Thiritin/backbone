import { afterEach, describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { checkMailLogin } from "../src/sim/42-mail/accounts";
import { mailHooks } from "../src/sim/42-mail/caps";
import { catchRate, deliver, deliveryTrace, junkPassPerDay, mailDeliveryTick, MAIL_HOPS } from "../src/sim/42-mail/deliver";
import { boxOf } from "../src/sim/42-mail/model";
import type { MailAccount } from "../src/sim/42-mail/types";
import type { GameState } from "../src/sim/50-state";
import { createTenant, setTenantLock, verifyTenant } from "../src/sim/90-actions/mail";
import { createMailGroup, createMailAccount, deleteMailAccount, saveFilter, setAccountRoles, setFilterOn } from "../src/sim/90-actions/mailbox";
import { idOf } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const boxAt = (s: GameState, address: string) => s.mail.accounts.find((a) => `${a.local}@${a.domain}` === address)!;
const sales = (s: GameState) => boxAt(s, `sales@${s.company.domain}`);
const add = (s: GameState, local: string) => {
  const r = createMailAccount(s, { tenant: sales(s).tenant, local, title: local, password: "secret1" });
  expect(r.ok).toBe(true);
  return s.mail.accounts.find((a) => a.id === idOf(r))!;
};
const patch = (s: GameState, id: string, p: Partial<MailAccount>) => {
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => (a.id === id ? { ...a, ...p } : a)) };
};
const req = (to: string, from = "n:Some Customer") => ({ to, from, kind: "support" as const, topic: "x" });
const original = mailHooks.mxTarget;
afterEach(() => { mailHooks.mxTarget = original; });

describe("mail delivery", () => {
  it("resolves boxes, aliases and the catch-all, and bounces the rest", () => {
    const s = readyGame(1), d = s.company.domain!, box = sales(s);
    expect(deliver(s, req(`SALES@${d}`))).toMatchObject({ result: "accepted", account: box.id });
    patch(s, box.id, { aliases: ["info"] });
    expect(deliver(s, req(`info@${d}`)).account).toBe(box.id);
    // Mail from the sim to an unknown address vanishes; mail the player sent comes back from the daemon.
    expect(deliver(s, req(`nobody@${d}`))).toMatchObject({ result: "bounced", why: "unknown" });
    const n = boxOf(s, box.id).length;
    deliver(s, req(`nobody@${d}`, `acct:${box.id}`));
    expect(boxOf(s, box.id).slice(n).map((m) => [m.from, m.topic])).toEqual([["daemon", "bounceUser"]]);
    expect(deliver(s, req("someone@hotmeal.com", `acct:${box.id}`))).toMatchObject({ result: "accepted", account: null });
    s.mail = { ...s.mail, catchAll: box.id };
    expect(deliver(s, req(`nobody@${d}`)).account).toBe(box.id);
  });

  it("loses a deleted mailbox's mail and bounces mail to its address as stale", () => {
    const s = readyGame(2), d = s.company.domain!, box = add(s, "support");
    deliver(s, req(`support@${d}`));
    expect(deleteMailAccount(s, box.id).ok).toBe(true);
    expect(s.mail.msgs[box.id]).toBeUndefined();
    expect(deliver(s, req(`support@${d}`))).toMatchObject({ result: "bounced", why: "stale" });
  });

  it("bounces mail to a locked tenant and refuses its sign-in", () => {
    const s = readyGame(3), box = sales(s);
    setTenantLock(s, box.tenant, true);
    expect(deliver(s, req(`sales@${s.company.domain}`))).toMatchObject({ result: "bounced", why: "closed" });
    expect(checkMailLogin(s, `sales@${s.company.domain}`, box.password)).toEqual({ ok: false, error: "error.mailLocked" });
  });

  it("queues mail for a full box, delivers it once space frees, and falls back to the primary after five days", () => {
    const s = readyGame(4), d = s.company.domain!, box = add(s, "support");
    patch(s, box.id, { quotaMb: 0 });
    expect(deliver(s, req(`support@${d}`))).toMatchObject({ result: "queued", why: "full" });
    s.hour++; mailDeliveryTick(s);
    expect(s.mail.queue).toHaveLength(1);
    patch(s, box.id, { quotaMb: 100 });
    s.hour++; mailDeliveryTick(s);
    expect(s.mail.queue).toHaveLength(0);
    expect(boxOf(s, box.id).filter((m) => m.late && m.kind === "support")).toHaveLength(1);

    patch(s, box.id, { quotaMb: 0 });
    deliver(s, req(`support@${d}`));
    s.hour += 121; mailDeliveryTick(s);
    expect(boxOf(s, s.mail.primary).filter((m) => m.late && m.kind === "support")).toHaveLength(1);
    patch(s, s.mail.primary, { quotaMb: 0 });
    deliver(s, req(`support@${d}`));
    s.hour += 121; mailDeliveryTick(s);
    expect(s.mail.accounts.find((a) => a.id === box.id)!.dropped).toBeGreaterThan(0);
    expect(boxOf(s, s.mail.primary).filter((m) => m.late && m.kind === "support")).toHaveLength(1);
    expect(s.mail.queue.some((q) => q.msg.kind === "support")).toBe(false);
  });

  it("runs server filters in order and stops at a stop action", () => {
    const s = readyGame(5), box = sales(s);
    const cond = { field: "kind" as const, op: "is" as const, value: "support" };
    const f1 = idOf(saveFilter(s, box.id, { name: "Requests", on: true, match: "all", conds: [cond], acts: [{ do: "move", folder: "archive" }, { do: "stop" }] }));
    saveFilter(s, box.id, { name: "Star", on: true, match: "any", conds: [cond], acts: [{ do: "star" }] });
    expect(deliver(s, req(`sales@${s.company.domain}`))).toMatchObject({ result: "filtered" });
    expect(boxOf(s, box.id).at(-1)).toMatchObject({ folder: "archive" });
    expect(boxOf(s, box.id).at(-1)!.star).toBeUndefined();
    setFilterOn(s, f1, false);
    deliver(s, req(`sales@${s.company.domain}`));
    expect(boxOf(s, box.id).at(-1)).toMatchObject({ folder: "inbox", star: true });
  });

  it("ends a forwarding loop after three hops and keeps the message", () => {
    const s = readyGame(6), d = s.company.domain!, a = sales(s), b = add(s, "info2");
    patch(s, a.id, { forward: { to: `info2@${d}`, keep: false } });
    patch(s, b.id, { forward: { to: `sales@${d}`, keep: false } });
    const before = boxOf(s, a.id).length + boxOf(s, b.id).length;
    deliver(s, req(`sales@${d}`));
    expect(boxOf(s, a.id).length + boxOf(s, b.id).length - before).toBe(1);
  });

  it("answers out-of-office only while it is on, and two replies on a host without loop protection loop to the hop limit", () => {
    const s = readyGame(7), d = s.company.domain!, a = sales(s), b = add(s, "office");
    const vacation = { on: true, subject: "Away", text: "Back Monday", until: null };
    deliver(s, req(`office@${d}`, `acct:${a.id}`));
    expect(boxOf(s, a.id).some((m) => m.auto)).toBe(false);
    patch(s, a.id, { vacation }); patch(s, b.id, { vacation });
    deliver(s, req(`office@${d}`, `acct:${a.id}`));
    const replies = [...boxOf(s, a.id), ...boxOf(s, b.id)].filter((m) => m.auto && m.folder === "sent");
    expect(replies.length).toBe(MAIL_HOPS + 1);
    expect([...boxOf(s, a.id), ...boxOf(s, b.id)].filter((m) => m.topic === "bounceLoop")).toHaveLength(1);
  });

  it("copies group mail to each member with the group label and refuses a role for the group", () => {
    const s = readyGame(8), d = s.company.domain!;
    s.hour = hourOfMonth("2008-03");
    const g = idOf(createTenant(s, { host: "goggle", plan: "paid" }));
    expect(g).not.toBe("");
    verifyTenant(s, g);
    const t = s.mail.tenants.find((x) => x.id === g)!;
    mailHooks.mxTarget = () => s.mail.tenants.find((x) => x.id === g)!;
    const m1 = idOf(createMailAccount(s, { tenant: g, local: "ann", title: "Ann", password: "secret1" }));
    const m2 = idOf(createMailAccount(s, { tenant: g, local: "bob", title: "Bob", password: "secret1" }));
    const grp = idOf(createMailGroup(s, { tenant: t.id, local: "team", title: "Team", members: [m1, m2] }));
    expect(deliver(s, req(`team@${d}`)).result).toBe("accepted");
    for (const id of [m1, m2]) {
      const label = s.mail.folders.find((f) => f.accountId === id && f.label && f.name === "Team")!;
      expect(boxOf(s, id).at(-1)).toMatchObject({ kind: "support", labels: [label.id] });
    }
    expect(setAccountRoles(s, grp, ["support"])).toEqual({ ok: false, error: "error.mailGroupRole" });
    expect(createMailAccount(s, { tenant: g, local: "team", title: "x", password: "secret1" })).toEqual({ ok: false, error: "error.mailTaken" });
  });

  it("catches junk at the host's rate and lets it all through with the spam filter off", () => {
    const s = readyGame(9), box = s.mail.accounts.find((a) => a.domain === "gmix.com")!, to = `${box.local}@gmix.com`;
    patch(s, box.id, { quotaMb: 100000 });
    const caught = (n: number) => Array.from({ length: n }, () => deliver(s, { to, from: "n:Rolecks", kind: "spam", topic: "junk.replica" })).filter((r) => r.result === "quarantined").length;
    const rate = catchRate(s, box);
    expect(rate).toBe(0.85);
    expect(Math.abs(caught(2000) / 2000 - rate)).toBeLessThan(0.03);
    patch(s, box.id, { prefs: { spam: "off" } });
    expect(caught(200)).toBe(0);
  });

  it("writes one trace entry per outcome and keeps the newest 200", () => {
    const s = readyGame(10), d = s.company.domain!;
    const n = s.mail.trace.length;
    deliver(s, req(`sales@${d}`)); deliver(s, req(`nobody@${d}`));
    expect(s.mail.trace.length - n).toBe(2);
    expect(deliveryTrace(s, { result: "bounced" })[0]).toMatchObject({ to: `nobody@${d}`, why: "unknown" });
    for (let i = 0; i < 250; i++) deliver(s, req(`nobody@${d}`));
    expect(s.mail.trace).toHaveLength(200);
  });

  it("delivers daily junk whose passing share matches junkPassPerDay", () => {
    const s = readyGame(11), box = s.mail.accounts.find((a) => a.domain === "gmix.com")!;
    patch(s, box.id, { quotaMb: 100000 });
    const inboxSpam = () => boxOf(s, box.id).filter((m) => m.kind === "spam" && m.folder === "inbox").length;
    let expected = 0, got = 0;
    const start = s.hour - (s.hour % 24) + 27;
    for (let day = 0; day < 200; day++) {
      s.hour = start + day * 24;
      expected += junkPassPerDay(s, box.id);
      const n = inboxSpam();
      mailDeliveryTick(s);
      got += inboxSpam() - n;
    }
    expect(expected).toBeGreaterThan(50);
    expect(Math.abs(got - expected) / expected).toBeLessThan(0.2);
    expect(boxOf(s, box.id).filter((m) => m.folder === "junk").length).toBeLessThanOrEqual(30);
    expect(s.mail.accounts.find((a) => a.id === box.id)!.junkCaught).toBeGreaterThan(0);
  });

  it("keeps the state under budget when 5,000 messages land in three mailboxes", () => {
    const s = readyGame(12), d = s.company.domain!, boxes = [sales(s), add(s, "support"), add(s, "info")];
    for (const b of boxes) patch(s, b.id, { quotaMb: 100000 });
    for (let i = 0; i < 5000; i++) deliver(s, req(`${boxes[i % 3].local}@${d}`));
    for (const b of boxes) expect(boxOf(s, b.id).length).toBeLessThanOrEqual(300);
    expect(s.mail.accounts.find((a) => a.id === boxes[0].id)!.older.n).toBeGreaterThan(1300);
    expect(JSON.stringify(s.mail).length).toBeLessThan(400_000);
  });
});
