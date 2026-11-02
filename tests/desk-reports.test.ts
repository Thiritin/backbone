import { describe, expect, it } from "vitest";
import { hourOf, monthIndexOf } from "../src/sim/00-core/time";
import { PROFILES } from "../src/sim/10-catalog/economy";
import { deskReport, firstDue, firstResponse, slaMet, slaPlans } from "../src/sim/40-support/desk-reports";
import { importDeskTickets } from "../src/sim/40-support/desk-work";
import { createTicket, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { openDesk } from "../src/sim/40-support/desk";
import { markSpam, mergeTickets } from "../src/sim/90-actions/desk";
import { replyTicket } from "../src/sim/90-actions/support";
import { newGame, registered } from "./fixtures";

// Tuesday 7 January 2020, 9:00, with OsTickit from the Pear Store.
function withDesk(): GameState {
  const s = registered({ ...newGame(3), hour: hourOf(new Date(Date.UTC(2020, 0, 7, 9))), cash: 1e6 });
  openDesk(s, "ostickit");
  return s;
}
const reply = (t: Ticket, hour: number, by?: string) => { t.replies = [...t.replies, { hour, template: "ftp", right: true, ...(by && { by }) }]; };

describe("desk reports", () => {
  it("count first response, SLA hits, agents, kinds and months", () => {
    const s = withDesk();
    const id = addCustomer(s, "One", "private"), c = s.customers.find((x) => x.id === id)!;
    const fast = createTicket(s, c, "howTo", null, "upload"), late = createTicket(s, c, "billing", null, "charge");
    const missed = createTicket(s, c, "howTo", null, "upload"), fresh = createTicket(s, c, "howTo", null, "upload");
    importDeskTickets(s);
    const due = firstDue(s, fast);
    expect(due).toBe(fast.dueAt);
    reply(fast, s.hour + 2);
    reply(late, due + 3, "Finn Fischer");
    fast.status = "resolved";
    // A month on, a new ticket is still inside its deadline while the unanswered one is long past it.
    s.hour = hourOf(new Date(Date.UTC(2020, 1, 4, 9)));
    Object.assign(fresh, { createdAt: s.hour, dueAt: firstDue(s, { ...fresh, createdAt: s.hour }) });
    expect([slaMet(s, fast), slaMet(s, late), slaMet(s, missed), slaMet(s, fresh)]).toEqual([true, false, false, null]);
    const r = deskReport(s, 0, s.hour + 1);
    expect(r).toMatchObject({ created: 4, solved: 1, firstResponse: (2 + due + 3 - late.createdAt) / 2, slaHit: 1 / 3 });
    expect(r.byKind).toEqual({ howTo: 3, billing: 1 });
    expect(r.byAgent).toEqual({ owner: 1, "Finn Fischer": 1 });
    expect(r.byMonth.map((m) => [m.month, m.created])).toEqual([[monthIndexOf(fast.createdAt), 3], [monthIndexOf(s.hour), 1]]);
    expect(deskReport(s, s.hour, s.hour + 1).created).toBe(1);
    // A customer who gave up after the deadline counts as a breach, one closed before it counts neither way.
    Object.assign(missed, { status: "closed", outcome: "withdrawn", updatedAt: due + 1 });
    expect(slaMet(s, missed)).toBe(false);
    Object.assign(missed, { updatedAt: due - 1 });
    expect(slaMet(s, missed)).toBeNull();
  });

  it("leave out spam and merged duplicates", () => {
    const s = withDesk();
    const id = addCustomer(s, "One", "private"), c = s.customers.find((x) => x.id === id)!;
    const [a, b, junk] = [0, 1, 2].map(() => createTicket(s, c, "howTo", null, "upload"));
    importDeskTickets(s);
    junk.kind = "spam";
    mergeTickets(s, a.id, [b.id]);
    markSpam(s, junk.id);
    expect(deskReport(s, 0, s.hour + 1).created).toBe(1);
  });

  it("measure from the opening even after a wrong answer moved the due hour", () => {
    const s = withDesk();
    const id = addCustomer(s, "One", "private"), c = s.customers.find((x) => x.id === id)!;
    const t = createTicket(s, c, "howTo", null, "upload");
    importDeskTickets(s);
    const due = t.dueAt;
    expect(replyTicket(s, t.id, "dns").ok).toBe(true);
    while (!t.replies.length && s.hour < due) { tick(s); Object.assign(t, s.tickets.find((x) => x.id === t.id)); }
    expect(t.replies[0].right).toBe(false);
    expect(t.dueAt).toBeGreaterThan(due);
    expect(firstDue(s, t)).toBe(due);
    expect(firstResponse(t)).toBe(t.replies[0].hour - t.createdAt);
    expect(slaMet(s, t)).toBe(true);
  });

  it("list the SLA plans from the profile table", () => {
    const s = withDesk();
    addCustomer(s, "One", "private");
    addCustomer(s, "Two", "enterprise");
    const plans = slaPlans(s);
    expect(plans.map((p) => [p.id, p.hours])).toEqual(PROFILES.map((p) => [p.id, p.reply.hours]));
    expect(plans.find((p) => p.id === "private")!.customers).toBe(1);
    expect(plans.find((p) => p.id === "enterprise")!.customers).toBe(1);
  });
});
