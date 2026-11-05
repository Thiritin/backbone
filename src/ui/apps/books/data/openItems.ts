import { isUnpaid, owed } from "../../../../sim/45-billing/billing";
import type { GameState } from "../../../../sim/50-state";

const EPS = 0.005;

// Invoices the customers still owe and supplier bills not yet fully booked.
export function openItems(s: GameState) {
  const receivables = s.invoices.filter(isUnpaid);
  const payables = s.payables.filter((p) => p.booked < p.amount - EPS);
  return {
    receivables,
    payables,
    receivable: receivables.reduce((a, i) => a + owed(i), 0),
    payable: payables.reduce((a, p) => a + p.amount - p.booked, 0),
  };
}
