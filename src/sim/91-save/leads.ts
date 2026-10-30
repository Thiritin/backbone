import type { Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SalesRequest } from "../30-market/market";

// Saves from before sales leads were order tickets: a live quote request becomes an order ticket in Support that carries its
// thread, quote and deadline, and a finished one leaves with the customer and service it already created.
export function legacyLeads(s: GameState): GameState {
  const old = (r: SalesRequest) => (r.kind as string) === "new";
  const tickets: Ticket[] = [];
  const requests = s.sales.requests.flatMap((r): SalesRequest[] => {
    if (!old(r)) return [r];
    if (["won", "lost", "declined"].includes(r.status)) return [];
    const waiting = r.replyAt !== null;
    const t: Ticket = {
      id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "order", topic: r.product, status: waiting ? "waiting" : "open",
      createdAt: r.createdAt, dueAt: r.deadline, updatedAt: s.hour, unread: !waiting, replies: [], outcome: null, work: null, assignee: null,
    };
    tickets.push(t);
    return [{ ...r, kind: "order", ticketId: t.id }];
  });
  s.sales = { ...s.sales, requests };
  s.tickets = [...s.tickets, ...tickets];
  return s;
}
