import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { isWorkHour } from "../src/sim/00-core/workhours";
import { profileStats, createTicket, type Ticket } from "../src/sim/40-support/tickets";
import { deskStatus } from "../src/sim/40-support/desk";
import { importDeskTickets, OWNER, staffQueue, WEB_SHARE } from "../src/sim/40-support/desk-work";
import { supportTick } from "../src/sim/40-support/tick";
import { activityFor } from "../src/sim/47-staff/activity";
import { TASKS } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addDepartment, addNote, addRule, lookupTicket, markSpam, mergeTickets, setDepartment, setPriority, submitWebTicket, updateDepartment } from "../src/sim/90-actions/desk";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { hire } from "../src/sim/90-actions/staff";
import { install } from "../src/sim/90-actions/store";
import { assignTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { useDeskTickets, useDeskViews } from "../src/ui/apps/browser/sites/desk/headless/useDeskTickets";
import { newGame, registered } from "./fixtures";

const at = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const customer = (s: GameState, id: string) => s.customers.find((c) => c.id === id)!;
const idOf = (r: ActionResult): string => (r.ok ? r.id! : "");
const ticket = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;

// A game in 2020 with OsTickit from the Pear Store, which has merge, departments, rules and the portal by then.
function withDesk(seed = 3): GameState {
  const s = registered({ ...newGame(seed), hour: at(2020) + 24 * 6 + 9, cash: 1e6 });
  expect(install(s, "ostickit").ok).toBe(true);
  return s;
}
function hireSupport(s: GameState): string {
  // The pool of a new game, moved to now.
  const pool = newGame(41).candidates.filter((x) => x.role === "support");
  const c = { ...pool[s.staff.length % pool.length], id: `cand${s.nextId++}`, arriveAt: s.hour, leaveAt: s.hour + 1000 };
  s.candidates = [...s.candidates, c];
  const r = hire(s, c.id);
  if (!r.ok) throw new Error(r.error);
  Object.assign(s.staff.find((x) => x.id === r.id)!, { skill: 50, talent: 100, trained: [...TASKS.support], salary: 2000 });
  return r.id!;
}
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const answeredBy = (s: GameState, t: Ticket) => activityFor(s, t.customerId).filter((a) => a.by).map((a) => a.by);

describe("merging duplicates", () => {
  // A high-budget customer writes three outage tickets for one service; the hours after they are due cost happiness.
  const run = (merge: boolean) => {
    const s = withDesk();
    const c = customer(s, addCustomer(s, "Big Corp", "enterprise"));
    const ts = [0, 1, 2].map(() => createTicket(s, c, "outage", null, "down"));
    importDeskTickets(s);
    if (merge) expect(mergeTickets(s, ts[0].id, [ts[1].id, ts[2].id])).toEqual({ ok: true, id: ts[0].id });
    s.hour = ts[0].dueAt + 1;
    c.happiness = 60;
    let hours = 0;
    for (let i = 0; i < 6; i++, s.hour++) {
      if (isWorkHour(s.hour) || profileStats(c.profile).reply.clock === "always") hours++;
      supportTick(s);
    }
    return { s, ids: ts.map((t) => t.id), drop: 60 - customer(s, c.id).happiness, hours };
  };

  it("charges one wait penalty instead of three", () => {
    const merged = run(true), apart = run(false), p = profileStats("enterprise").waitPenalty;
    expect(merged.hours).toBeGreaterThan(0);
    expect(merged.drop).toBeCloseTo(p * merged.hours);
    expect(apart.drop).toBeCloseTo(3 * p * apart.hours);
  });

  it("closes the duplicates as merged and keeps their numbers in the thread", () => {
    const { s, ids } = run(true);
    const [into, a, b] = ids.map((id) => ticket(s, id));
    for (const d of [a, b]) expect(d).toMatchObject({ status: "closed", outcome: "merged", mergedInto: into.id });
    expect(into.status).toBe("open");
    expect(into.notes!.filter((n) => n.key === "desk.note.merged").map((n) => n.params!.ref)).toEqual([a.ref, b.ref]);
    expect(useDeskTickets(s, "closed").map((t) => t.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it("refuses another customer's or another kind's ticket", () => {
    const s = withDesk();
    const c = customer(s, addCustomer(s, "One", "private")), d = customer(s, addCustomer(s, "Two", "private"));
    const x = createTicket(s, c, "billing", null, "charge"), y = createTicket(s, d, "billing", null, "charge"), z = createTicket(s, c, "howTo", null, "upload");
    expect(mergeTickets(s, x.id, [y.id])).toEqual({ ok: false, error: "error.mergeMismatch" });
    expect(mergeTickets(s, x.id, [z.id])).toEqual({ ok: false, error: "error.mergeMismatch" });
    expect(mergeTickets(s, x.id, [x.id])).toEqual({ ok: false, error: "error.mergeMismatch" });
  });

  it("needs a desk with merge", () => {
    const s = registered({ ...newGame(3), hour: at(2016), cash: 1e6 });
    const c = customer(s, addCustomer(s, "One", "private"));
    const x = createTicket(s, c, "billing", null, "charge"), y = createTicket(s, c, "billing", null, "charge");
    expect(mergeTickets(s, x.id, [y.id])).toEqual({ ok: false, error: "error.noDesk" });
    install(s, "ostickit");
    expect(mergeTickets(s, x.id, [y.id])).toEqual({ ok: false, error: "error.deskFeature" });
  });
});

describe("spam, notes and priority", () => {
  it("closes junk with no happiness change and a customer's request like closing it", () => {
    const s = withDesk();
    const c = customer(s, addCustomer(s, "One", "private"));
    const junk = createTicket(s, c, "howTo", null, "upload"), real = createTicket(s, c, "howTo", null, "upload");
    Object.assign(junk, { kind: "spam", customerId: "", topic: "" });
    importDeskTickets(s);
    const before = c.happiness;
    expect(markSpam(s, junk.id).ok).toBe(true);
    expect(ticket(s, junk.id)).toMatchObject({ status: "closed", outcome: "spam" });
    expect(customer(s, c.id).happiness).toBe(before);
    expect(markSpam(s, real.id).ok).toBe(true);
    expect(ticket(s, real.id).outcome).toBe("spam");
    expect(customer(s, c.id).happiness).toBe(before - 10);
    expect(useDeskTickets(s, "spam").map((t) => t.id).sort()).toEqual([junk.id, real.id].sort());
  });

  it("keeps typed notes and priority overrides through a save", () => {
    const s = withDesk();
    const t = createTicket(s, customer(s, addCustomer(s, "One", "private")), "howTo", null, "upload");
    expect(addNote(s, t.id, "  Called back  ").ok).toBe(true);
    expect(addNote(s, t.id, " ")).toEqual({ ok: false, error: "error.emptyNote" });
    expect(setPriority(s, t.id, "urgent").ok).toBe(true);
    const back = ticket(deserialize(serialize(s)), t.id);
    expect(back.priority).toBe("urgent");
    expect(back.notes!.map((n) => n.text ?? n.key)).toEqual(["Called back", "desk.note.priority.urgent"]);
  });
});

describe("staff queue", () => {
  it("leaves the player's own tickets to the player", () => {
    const run = (assignee: string | null) => {
      const s = withDesk(41);
      const agent = hireSupport(s);
      const t = createTicket(s, customer(s, addCustomer(s, "Mine", "private")), "howTo", null, "upload");
      importDeskTickets(s);
      expect(assignTicket(s, t.id, assignee).ok).toBe(true);
      runTo(s, s.hour + 30);
      return answeredBy(s, t).includes(s.staff.find((e) => e.id === agent)!.name);
    };
    expect(run(null)).toBe(true);
    expect(run(OWNER)).toBe(false);
  });

  it("serves a department's members, and departments without members to everyone", () => {
    const s = withDesk(41);
    const a = hireSupport(s), b = hireSupport(s), ea = s.staff.find((e) => e.id === a)!, eb = s.staff.find((e) => e.id === b)!;
    const billing = idOf(addDepartment(s, "Billing"));
    expect(updateDepartment(s, billing, { members: [b] }).ok).toBe(true);
    const c = customer(s, addCustomer(s, "One", "private"));
    const bill = createTicket(s, c, "billing", null, "charge"), how = createTicket(s, c, "howTo", null, "upload");
    importDeskTickets(s);
    expect(setDepartment(s, bill.id, billing).ok).toBe(true);
    expect(staffQueue(s, ea, [bill, how]).map((t) => t.id)).toEqual([how.id]);
    expect(staffQueue(s, eb, [how, bill]).map((t) => t.id)).toEqual([bill.id, how.id]);
  });

  it("takes higher priority first and the due hour inside one priority", () => {
    const s = withDesk(41);
    const id = hireSupport(s), e = s.staff.find((x) => x.id === id)!;
    const c = customer(s, addCustomer(s, "One", "private"));
    const late = createTicket(s, c, "howTo", null, "upload"), early = createTicket(s, c, "howTo", null, "upload"), urgent = createTicket(s, c, "howTo", null, "upload");
    early.dueAt = late.dueAt - 5;
    setPriority(s, urgent.id, "urgent");
    expect(staffQueue(s, e, [late, early, urgent]).map((t) => t.id)).toEqual([urgent.id, early.id, late.id]);
  });

  it("works mailbox tickets while the desk is down and not the desk's own", () => {
    const s = withDesk(41);
    const id = hireSupport(s), e = s.staff.find((x) => x.id === id)!;
    const c = customer(s, addCustomer(s, "One", "private"));
    const fetched = createTicket(s, c, "howTo", null, "upload");
    importDeskTickets(s);
    const mailbox = createTicket(s, c, "howTo", null, "upload");
    s.desk = { ...s.desk!, hosting: { kind: "self", clusterId: "gone" } };
    expect(deskStatus(s)).toBe("down");
    expect(fetched.channelId ?? fetched.via).toBeTruthy();
    expect(staffQueue(s, e, [fetched, mailbox]).map((t) => t.id)).toEqual([mailbox.id]);
  });
});

describe("rules at import", () => {
  it("sets department, priority and an auto-assigned member", () => {
    const s = withDesk(41);
    const agent = hireSupport(s);
    const billing = idOf(addDepartment(s, "Billing"));
    updateDepartment(s, billing, { autoAssign: true });
    expect(addRule(s, { when: "billing", set: { deptId: billing, priority: "high" } }).ok).toBe(true);
    expect(addRule(s, { when: "billing", set: {} })).toEqual({ ok: false, error: "error.emptyRule" });
    const c = customer(s, addCustomer(s, "One", "private"));
    const bill = createTicket(s, c, "billing", null, "charge"), how = createTicket(s, c, "howTo", null, "upload");
    importDeskTickets(s);
    expect(bill).toMatchObject({ deptId: billing, priority: "high", assignee: agent });
    expect(how).toMatchObject({ deptId: "support", assignee: null });
    expect(how.priority).toBeUndefined();
    const back = deserialize(serialize(s));
    expect(back.desk!.rules).toEqual(s.desk!.rules);
    expect(back.desk!.departments.map((d) => d.name)).toEqual(["Support", "Billing"]);
  });
});

describe("web tickets", () => {
  it("open on the portal without a mailbox and are found by email and number", () => {
    const s = withDesk();
    s.mail = { ...s.mail, channels: [] };
    const c = customer(s, addCustomer(s, "One", "private"));
    const r = submitWebTicket(s, c.address.email.toUpperCase(), "billing");
    expect(r.ok).toBe(true);
    const t = ticket(s, idOf(r));
    expect(t).toMatchObject({ customerId: c.id, kind: "billing", via: "web", channelId: null, deptId: "support" });
    expect(t.ref).toMatch(/^\d{6}$/);
    expect(submitWebTicket(s, c.address.email, "billing")).toEqual({ ok: false, error: "error.ticketExists" });
    expect(submitWebTicket(s, "nobody@example.org", "howTo")).toEqual({ ok: false, error: "error.unknownEmail" });
    expect(lookupTicket(s, c.address.email, `#${t.ref}`)).toEqual({ ok: true, id: t.id });
    expect(lookupTicket(s, "nobody@example.org", t.ref!)).toEqual({ ok: false, error: "error.ticketLookup" });
    expect(useDeskViews(s).find((v) => v.id === "open")!.count).toBe(1);
  });

  it("come in for a share of customers while the desk is reachable, and none while it is down", () => {
    const s = withDesk();
    s.mail = { ...s.mail, channels: [] };
    const c = customer(s, addCustomer(s, "One", "private"));
    const ts = Array.from({ length: 200 }, () => createTicket(s, c, "howTo", null, "upload"));
    const down = { ...s.desk!, hosting: { kind: "self" as const, clusterId: "gone" } }, up = s.desk!;
    s.desk = down;
    importDeskTickets(s);
    expect(ts.filter((t) => t.via === "web")).toHaveLength(0);
    expect(submitWebTicket(s, c.address.email, "billing")).toEqual({ ok: false, error: "error.deskDown" });
    s.desk = up;
    importDeskTickets(s);
    const web = ts.filter((t) => t.via === "web").length / ts.length;
    expect(web).toBeGreaterThan(WEB_SHARE - 0.1);
    expect(web).toBeLessThan(WEB_SHARE + 0.1);
    // Without a channel the rest stay in the mailbox.
    expect(ts.filter((t) => t.via !== "web").every((t) => !t.channelId && !t.ref)).toBe(true);
  });
});

describe("old saves", () => {
  it("load a desk ticket without notes or priority", () => {
    const s = withDesk();
    const t = createTicket(s, customer(s, addCustomer(s, "One", "private")), "howTo", null, "upload");
    importDeskTickets(s);
    const raw = JSON.parse(serialize(s));
    for (const x of raw.tickets) { delete x.notes; delete x.priority; delete x.mergedInto; }
    const back = deserialize(JSON.stringify(raw));
    expect(addNote(back, t.id, "Hello").ok).toBe(true);
    expect(useDeskTickets(back, "open").map((x) => x.id)).toEqual([t.id]);
  });
});
