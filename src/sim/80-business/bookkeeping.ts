// docs/design/plans/billing-by-hand.md, 9c: the installed bookkeeping program, its fees and its vendor's site.
import { isMonthStart } from "../00-core/time";
import { booksVendor, type BooksVendor } from "../10-catalog/bookkeeping";
import { cents } from "../45-billing/billing";
import { invoice, invoicing } from "../46-finance/payables";
import type { GameState, LedgerEntry } from "../50-state";
import { LEXWEAR_HOST } from "./lexwear";

export const YEAR_HOURS = 365 * 24;
export const LICENCE_KEY = "ledger.booksLicence", MONTHLY_KEY = "ledger.booksMonthly", UPDATE_KEY = "ledger.booksUpdate";

export const currentVendor = (s: GameState): BooksVendor | undefined => booksVendor(s.books.vendor);
export const booksHost = (v: BooksVendor): string => (v.id === "lexwear" ? LEXWEAR_HOST : `${v.id}.de`);
export const booksUrl = (v: BooksVendor, module?: string): string => `www.${booksHost(v)}/${module ? `module/${module}` : ""}`;
// The licence is bought once per program, so a program installed again costs nothing.
export const licensed = (s: GameState, v: BooksVendor): boolean => s.ledger.some((e) => e.key === LICENCE_KEY && e.params.program === v.program);
// An unpaid Lexwear update stops new modules until it is paid.
export const updateOpen = (s: GameState): boolean => s.payables.some((p) => p.paidAt === null && p.lines.some((e) => e.key === UPDATE_KEY));

// A fee goes out as the vendor's invoice once the company banks, and straight off the cash before.
export function bill(s: GameState, v: BooksVendor, key: string, amount: number): void {
  const line: LedgerEntry = { hour: s.hour, category: "licenses", key, params: { program: v.program }, amount: -amount };
  if (invoicing(s)) { invoice(s, "books", v.name, [line]); return; }
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, line];
}

// Hourly: the monthly fee at each month start and Lexwear's update fee on each anniversary of the install.
export function booksTick(s: GameState): void {
  const v = currentVendor(s);
  if (!v) return;
  if (v.monthly && isMonthStart(s.hour)) bill(s, v, MONTHLY_KEY, v.monthly);
  const age = s.hour - s.books.installedAt;
  if (v.update && age > 0 && age % YEAR_HOURS === 0) bill(s, v, UPDATE_KEY, v.update);
}
