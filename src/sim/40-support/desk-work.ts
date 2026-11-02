import { DESK_ROUTE } from "../10-catalog/desks";
import type { DeskChannel } from "../42-mail/types";
import type { Employee } from "../47-staff/staff";
import type { GameState } from "../50-state";
import { deskReachable, nextRef, priorityOf, type Department, type Priority } from "./desk";
import { isFinal, type Ticket, type TicketKind } from "./tickets";

// The assignee of the player's own queue, which staff skip.
export const OWNER = "owner";
// Kinds a customer can open through the desk's portal, and the share of them that does while the portal is reachable.
export const WEB_KINDS: TicketKind[] = ["outage", "howTo", "billing"];
export const WEB_SHARE = 0.3;
export const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];

// Customer support, spam, and mail a channel took in without a ticket.
export const inDesk = (t: Pick<Ticket, "kind"> & { mail?: Ticket["mail"] }): boolean => DESK_ROUTE[t.kind].dept !== null || t.kind === "spam" || !!t.mail?.msg;
// A ticket the desk holds: fetched from one of its channels or opened on its portal.
export const held = (t: Pick<Ticket, "channelId" | "via">): boolean => !!t.channelId || t.via === "web";

export function deskNote(s: GameState, t: Ticket, key: string, params: Record<string, string | number> = {}, by = OWNER): void {
  t.notes = [...(t.notes ?? []), { hour: s.hour, by, key, params }];
}

// Support employees in a department; empty members means all of them.
export function membersOf(s: GameState, d: Department): Employee[] {
  const support = s.staff.filter((e) => e.role === "support");
  return d.members.length ? support.filter((e) => d.members.includes(e.id)) : support;
}

// The member with the fewest open tickets assigned, the first hired on a tie.
export function autoAssignee(s: GameState, d: Department): string | null {
  const load = (id: string) => s.tickets.filter((t) => t.assignee === id && !isFinal(t)).length;
  return membersOf(s, d).reduce<Employee | null>((best, e) => (!best || load(e.id) < load(best.id) ? e : best), null)?.id ?? null;
}

export const validAssignee = (s: GameState, id: string): boolean => id === OWNER || s.staff.some((e) => e.id === id && e.role === "support");

// Department, priority and assignee from the desk's rules in order, starting from the channel's department or the first.
export function routeTicket(s: GameState, t: Ticket, base: string | null = null): void {
  const d = s.desk;
  if (!d) return;
  let deptId = d.departments.find((x) => x.id === base)?.id ?? d.departments[0]?.id ?? null, priority: Priority | undefined, assignee: string | undefined;
  for (const r of d.rules) {
    if (r.when !== "*" && r.when !== t.kind) continue;
    if (r.set.deptId && d.departments.some((x) => x.id === r.set.deptId)) deptId = r.set.deptId;
    if (r.set.priority) priority = r.set.priority;
    if (r.set.assignee && validAssignee(s, r.set.assignee)) assignee = r.set.assignee;
  }
  const dept = d.departments.find((x) => x.id === deptId);
  Object.assign(t, { deptId, ...(priority && { priority }) });
  if (assignee) t.assignee = assignee;
  else if (dept?.autoAssign && !t.assignee) t.assignee = autoAssignee(s, dept);
}

// Takes a ticket into the desk: its number, how it came in, the channel and its routing.
export function importTicket(s: GameState, t: Ticket, web: boolean, channel: DeskChannel | null = null): void {
  s.desk = { ...s.desk! };
  const ch = web ? null : channel ?? s.mail.channels.find((c) => c.desk === s.desk!.id);
  Object.assign(t, { ref: t.ref || nextRef(s, t), via: web ? "web" : "email", channelId: ch?.id ?? null });
  routeTicket(s, t, ch?.deptId ?? null);
}

// The order an employee takes open tickets in: assigned to them, unassigned in a department they belong to, unassigned in
// a department with no members. With a desk, higher priority first and the due hour inside one priority.
export function staffQueue(s: GameState, e: Employee, open: Ticket[]): Ticket[] {
  const depts = s.desk?.departments ?? [];
  const rank = (t: Ticket): number => {
    if (t.assignee === e.id) return 0;
    if (t.assignee === OWNER || (t.assignee && s.staff.some((x) => x.id === t.assignee))) return -1;
    const d = depts.find((x) => x.id === t.deptId);
    return !d || !d.members.length ? 2 : d.members.includes(e.id) ? 1 : -1;
  };
  const prio = new Map(open.map((t) => [t.id, s.desk ? PRIORITIES.indexOf(priorityOf(s, t)) : 0]));
  return open
    .filter((t) => rank(t) >= 0 && deskReachable(s, t))
    .sort((a, b) => rank(a) - rank(b) || prio.get(a.id)! - prio.get(b.id)! || a.dueAt - b.dueAt);
}
