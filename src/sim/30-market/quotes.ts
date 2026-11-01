// Quotes: A4 documents in Books with an order's price, sent onto its ticket (90-actions/orders.ts, attachQuote).
import type { InvoiceLine } from "../45-billing/billing";
import { reviewing } from "../45-billing/fraud";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { applyStep, AUTOMATION, quoteAccepted, stepsDone } from "./manual";
import { orderOf } from "./orders";

export type QuoteStatus = "draft" | "sent" | "accepted" | "countered" | "declined" | "invoiced";
// customerId stays null until the order's account exists; ticketId is the order ticket it answers.
export interface Quote {
  id: string; number: string; customerId: string | null; ticketId: string | null; lines: InvoiceLine[]; monthly: number; setup: number;
  status: QuoteStatus; sentAt: number | null;
  // When it was written, and the first invoice it was carried forward to.
  createdAt?: number; invoiceId?: string;
}

// An accepted quote of the order becomes invoiced once the order's first invoice exists.
export function carryForward(s: GameState, ticketId: string, invoiceId: string): void {
  s.quotes = s.quotes.map((q) => (q.ticketId === ticketId && q.status === "accepted" ? { ...q, status: "invoiced", invoiceId } : q));
}

// The Lexwear module that joins Books and the helpdesk.
export const HELPDESK_LINK = "helpdesk-link";
export const hasHelpdeskLink = (s: GameState): boolean => s.modules.includes(HELPDESK_LINK);

// The customer answered an order's quote: the quote that is out takes the answer. With the Helpdesk link an acceptance
// creates the account from the order email and sends the first invoice.
export function answerQuote(s: GameState, requestId: string, events: SimEvent[]): void {
  const r = s.sales.requests.find((x) => x.id === requestId), q = r?.ticketId ? s.quotes.find((x) => x.ticketId === r.ticketId && x.status === "sent") : undefined;
  if (!r || !q) return;
  // With automatic orders the first invoice may exist already.
  const status: QuoteStatus | null = quoteAccepted(r) ? (r.invoiceId ? "invoiced" : "accepted") : r.status === "countered" ? "countered" : r.status === "refused" || r.status === "lost" ? "declined" : null;
  if (!status) return;
  s.quotes = s.quotes.map((x) => (x.id === q.id ? { ...x, status, ...(status === "invoiced" && { invoiceId: r.invoiceId }) } : x));
  if (status !== "accepted" || !hasHelpdeskLink(s) || reviewing(s, r.product)) return;
  for (const step of ["account", "invoice"] as const) {
    const t = s.tickets.find((x) => x.id === r.ticketId)!;
    if (stepsDone(s, orderOf(s, t)!)[step]) continue;
    const failed = applyStep(s, t, step, AUTOMATION);
    if (failed) return void events.push(failed);
  }
}
