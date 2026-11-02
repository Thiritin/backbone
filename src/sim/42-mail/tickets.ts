// Ticket envelopes: every ticket the sim opens arrives as a message in the mailbox of its role
// (docs/design/plans/mail-core.md, Support requests, tickets and the desk).
import { DESK_ROUTE } from "../10-catalog/desks";
import { requestName } from "../30-market/market";
import { orderOf } from "../30-market/orders";
import { senderById, subjectParams } from "../40-support/notices";
import { isFinal, type Ticket, type TicketKind } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { roleAddress } from "./accounts";
import { deliver, type Inbound } from "./deliver";
import type { MailAccount, MailKind } from "./types";

const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const KIND: Partial<Record<TicketKind, MailKind>> = { order: "order", sponsor: "order", abuse: "notice", notice: "notice", legal: "notice", extortion: "notice", pear: "system" };

// Mail tickets are system mail until the cutover makes them messages, or were made from a message.
const enveloped = (t: Ticket): boolean => t.kind !== "mail" && !t.mail;

function senderOf(s: GameState, t: Ticket): string {
  if (t.customerId) return `cust:${t.customerId}`;
  if (t.notice) return `n:${senderById(t.notice.sender).name}`;
  const order = t.kind === "order" ? orderOf(s, t) : undefined;
  if (order) return `n:${requestName(order)}`;
  return `n:${t.kind === "pear" ? "Pear" : t.kind === "sponsor" ? subjectParams(s, t).event : ""}`;
}

const inbound = (s: GameState, t: Ticket): Inbound =>
  ({ to: roleAddress(s, DESK_ROUTE[t.kind].role), from: senderOf(s, t), kind: KIND[t.kind] ?? "support", ticket: t.id });

// The tickets opened since the last walk, each delivered as its envelope in creation order. The first walk of a save
// from before envelopes leaves out the requests already closed.
export function syncTicketMail(s: GameState): void {
  const first = !s.mail.seen, fresh: Ticket[] = [];
  for (let i = s.tickets.length - 1; i >= 0 && num(s.tickets[i].id) > s.mail.seen; i--) fresh.push(s.tickets[i]);
  if (!fresh.length) return;
  s.mail = { ...s.mail, seen: fresh.reduce((n, t) => Math.max(n, num(t.id)), s.mail.seen) };
  for (const t of fresh.reverse()) if (enveloped(t) && !(first && isFinal(t))) deliver(s, inbound(s, t));
}

// The mailbox holding a ticket's envelope, where its replies leave from.
export function envelopeBox(s: GameState, ticketId: string): MailAccount | undefined {
  return s.mail.accounts.find((a) => s.mail.msgs[a.id]?.some((m) => m.ticket === ticketId && m.reply === undefined && m.folder !== "sent"));
}
