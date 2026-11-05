import { dateOf } from "../../../../sim/00-core/time";
import { monthKey } from "../../../../sim/46-finance/finance";
import { isUnpaid } from "../../../../sim/45-billing/billing";
import type { GameState, LedgerEntry } from "../../../../sim/50-state";
import { t } from "../../../../i18n/en";

// The years with bookings, newest first, always including the current one.
export function ledgerYears(s: GameState): number[] {
  const year = (hour: number) => dateOf(hour).getUTCFullYear();
  return [...new Set([year(s.hour), ...s.ledger.map((e) => year(e.hour))])].sort((a, b) => b - a);
}

export interface StatementRow { e: LedgerEntry; i: number; balance: number }

// Every booking newest first with the bank balance after it, and the months that have bookings.
export function statement(s: GameState): { rows: StatementRow[]; months: string[] } {
  let balance = s.cash;
  const rows = s.ledger.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
    const row = { e, i, balance };
    balance -= e.amount;
    return row;
  });
  return { rows, months: [...new Set(rows.map((r) => monthKey(r.e.hour)))].sort().reverse() };
}

// A bank line not yet booked against a document. out: a payment out; back: a refund of a paid invoice.
export interface BankLine { id: string; hour: number; name: string; text: string; amount: number; out: boolean; back: boolean }

// Unbooked bank lines oldest first: payments in and refunds from the transfers, payments out from the account.
export function bankLines(s: GameState): BankLine[] {
  return [
    ...s.transfers.filter((x) => x.matchedAt === null && !x.covers).map((x) => ({ id: x.id, hour: x.hour, name: x.from, text: t(x.reference, x.params), amount: x.amount, out: false, back: !!x.back })),
    ...(s.bank?.outgoing ?? []).filter((o) => o.matched === null && !o.returned).map((o) => ({ id: o.id, hour: o.hour, name: o.name, text: o.reference, amount: -o.amount, out: true, back: false })),
  ].sort((a, b) => a.hour - b.hour);
}

// The document numbers a line can be booked against: open supplier bills for a payment out, paid invoices for a refund, unpaid ones otherwise.
export const docsFor = (s: GameState, line: BankLine): string[] => line.out
  ? s.payables.filter((p) => p.booked < p.amount - 0.005).map((p) => p.number)
  : s.invoices.filter((i) => (line.back ? i.status === "paid" : isUnpaid(i))).map((i) => i.number);
