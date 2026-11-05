import { dateOf } from "../../../../sim/00-core/time";
import { monthKey } from "../../../../sim/46-finance/finance";
import type { GameState, LedgerEntry } from "../../../../sim/50-state";

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
