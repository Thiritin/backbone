import { priorityOf } from "../../../../../../sim/40-support/desk";
import { held, inDesk, OWNER, PRIORITIES } from "../../../../../../sim/40-support/desk-work";
import { isFinal, type Ticket } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";

// The queues every desk draws under its own names (see the capability table in docs/design/plans/support-desk.md).
export const DESK_VIEWS = ["open", "mine", "unassigned", "overdue", "waiting", "escalated", "closed", "spam"] as const;
export type DeskView = (typeof DESK_VIEWS)[number];

const isSpam = (t: Ticket) => t.kind === "spam" || t.outcome === "spam";
const IN_VIEW: Record<DeskView, (t: Ticket, hour: number) => boolean> = {
  open: (t) => t.status === "open",
  mine: (t) => !isFinal(t) && t.assignee === OWNER,
  unassigned: (t) => t.status === "open" && !t.assignee,
  overdue: (t, hour) => t.status === "open" && t.dueAt < hour,
  waiting: (t) => t.status === "waiting",
  escalated: (t) => t.status === "escalated",
  closed: (t) => isFinal(t),
  spam: () => true,
};

const deskTickets = (s: GameState): Ticket[] => (s.desk ? s.tickets.filter((t) => inDesk(t) && held(t)) : []);
const inView = (t: Ticket, view: DeskView, hour: number): boolean => (view === "spam") === isSpam(t) && IN_VIEW[view](t, hour);

// A view's tickets: open ones by priority, then due hour; closed ones latest first.
export function useDeskTickets(s: GameState, view: DeskView): Ticket[] {
  const rank = (t: Ticket) => PRIORITIES.indexOf(priorityOf(s, t));
  const list = deskTickets(s).filter((t) => inView(t, view, s.hour));
  return view === "closed" || view === "spam" ? list.sort((a, b) => b.updatedAt - a.updatedAt) : list.sort((a, b) => rank(a) - rank(b) || a.dueAt - b.dueAt);
}

export function useDeskViews(s: GameState): { id: DeskView; count: number }[] {
  const all = deskTickets(s);
  return DESK_VIEWS.map((id) => ({ id, count: all.filter((t) => inView(t, id, s.hour)).length }));
}
