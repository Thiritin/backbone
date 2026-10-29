import type { GameState } from "../50-state";
import type { TicketKind } from "./tickets";

// economy.md, Tickets and work rates: hours past due after which a customer closes an unanswered ticket.
// Cancellations close at the next billing date, and notices, legal requests and orders are not the customer's to close.
export const ABANDON_HOURS: Partial<Record<TicketKind, number>> = {
  outage: 72, howTo: 120, upgrade: 168, appeal: 168, billing: 336, abuse: 336, refund: 336,
};

// The wait penalty has already been charged hour by hour; closing only stops it.
export function abandonTickets(s: GameState): void {
  const gone = (t: GameState["tickets"][number]) => {
    const limit = ABANDON_HOURS[t.kind];
    return limit !== undefined && t.status === "open" && !t.work && !t.notice && s.hour - t.dueAt >= limit;
  };
  if (!s.tickets.some(gone)) return;
  s.tickets = s.tickets.map((t) => (gone(t) ? { ...t, status: "closed", outcome: "withdrawn", updatedAt: s.hour, unread: false } : t));
}
