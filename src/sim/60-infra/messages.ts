// economy.md, DirectAdmin Message System: a window onto tickets and system state that already exist; nothing is stored.
import { isFinal, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { vulnerable } from "./security";
import { accountsOf } from "./webpanel";

export const MESSAGE_KINDS = ["outage", "howTo", "abuse", "upgrade", "migration"];

export interface HostMessage { id: string; hour: number; ticket?: Ticket; kind: "ticket" | "advisory" | "certExpired"; serviceId?: string }

// Newest first: the tickets of customers whose sites run on the host, the advisory under way for it and its expired certificates.
export function hostMessages(s: GameState, hostId: string): HostMessage[] {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c) return [];
  const mine = accountsOf(s, hostId), customers = new Set(mine.map((v) => v.customerId));
  const out: HostMessage[] = s.tickets.filter((t) => customers.has(t.customerId) && MESSAGE_KINDS.includes(t.kind))
    .map((ticket) => ({ id: ticket.id, hour: ticket.createdAt, ticket, kind: "ticket" as const }));
  if (s.security.vuln && s.security.stage >= 1 && vulnerable(s, c)) out.push({ id: `adv-${s.security.vuln}`, hour: s.hour, kind: "advisory" });
  for (const v of mine) if (s.webpanel.ssl.expired.includes(v.id)) out.push({ id: `cert-${v.id}`, hour: s.webpanel.ssl.expires[v.id] ?? s.hour, kind: "certExpired", serviceId: v.id });
  return out.sort((a, b) => b.hour - a.hour);
}

export const unreadCount = (list: HostMessage[]): number => list.filter((m) => (m.ticket ? m.ticket.unread && !isFinal(m.ticket) : true)).length;
