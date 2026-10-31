// Quotes: A4 documents in Books with an order's price, sent onto its ticket (90-actions/orders.ts, attachQuote).
import type { InvoiceLine } from "../45-billing/billing";
import { reviewing } from "../45-billing/fraud";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { applyStep, AUTOMATION, quoteAccepted, stepsDone } from "./manual";
import { orderOf } from "./orders";

export type QuoteStatus = "draft" | "sent" | "accepted" | "countered" | "declined";
// customerId stays null until the order's account exists; ticketId is the order ticket it answers.
export interface Quote {
  id: string; number: string; customerId: string | null; ticketId: string | null; lines: InvoiceLine[]; monthly: number; setup: number;
  status: QuoteStatus; sentAt: number | null;
}

// The Lexwear module that joins Books and the helpdesk.
export const HELPDESK_LINK = "helpdesk-link";
export const hasHelpdeskLink = (s: GameState): boolean => s.modules.includes(HELPDESK_LINK);

// The customer answered an order's quote: the quote that is out takes the answer. With the Helpdesk link an acceptance
// creates the account from the order email and sends the first invoice.
export function answerQuote(s: GameState, requestId: string, events: SimEvent[]): void {
  const r = s.sales.requests.find((x) => x.id === requestId), q = r?.ticketId ? s.quotes.find((x) => x.ticketId === r.ticketId && x.status === "sent") : undefined;
  if (!r || !q) return;
  const status: QuoteStatus | null = quoteAccepted(r) ? "accepted" : r.status === "countered" ? "countered" : r.status === "refused" || r.status === "lost" ? "declined" : null;
  if (!status) return;
  s.quotes = s.quotes.map((x) => (x.id === q.id ? { ...x, status } : x));
  if (status !== "accepted" || !hasHelpdeskLink(s) || reviewing(s, r.product)) return;
  for (const step of ["account", "invoice"] as const) {
    const t = s.tickets.find((x) => x.id === r.ticketId)!;
    if (stepsDone(s, orderOf(s, t)!)[step]) continue;
    const failed = applyStep(s, t, step, AUTOMATION);
    if (failed) return void events.push(failed);
  }
}
