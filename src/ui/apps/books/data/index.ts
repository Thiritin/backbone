// Shared data layer of the Books programs. Pure functions over game state, wrapped in hooks that read the
// store's books view (records the shop has not handed over stay hidden). Programs render; they do not compute.
//
//   useAccounts(year?)  Account[] sorted by number: bank, receivables, payables, one per ledger category
//   useLedger()         { years, rows, months }: years with bookings, and the bank statement newest first
//   useOpenItems()      { receivables, payables, receivable, payable }: unpaid invoices and open supplier bills
//   useVatReturns()     { available, linked, certs }: tax portal state and the certificates that can link it
//   useReports()        { overview(), profitLoss(year) }: headline figures and the year's profit and loss
//
// The chart of account numbers is CHART in ./chart; sides() gives an entry's debit and credit for an account.
import { useMemo } from "react";
import { useBooks } from "../view";
import { accountsOf } from "./accounts";
import { ledgerYears, statement } from "./ledger";
import { openItems } from "./openItems";
import { overview, profitLoss } from "./reports";
import { vatReturns } from "./vat";

export { accountsOf, sides, yearOfHour, type Account, type Kind } from "./accounts";
export { categoryLabel, CHART, FIXED_NO } from "./chart";
export { ledgerYears, openItems, overview, profitLoss, statement, vatReturns };

export const useAccounts = (year?: number) => { const g = useBooks(); return useMemo(() => accountsOf(g, year), [g, year]); };
export const useLedger = () => { const g = useBooks(); return useMemo(() => ({ years: ledgerYears(g), ...statement(g) }), [g]); };
export const useOpenItems = () => { const g = useBooks(); return useMemo(() => openItems(g), [g]); };
export const useVatReturns = () => { const g = useBooks(); return useMemo(() => vatReturns(g), [g]); };
export const useReports = () => {
  const g = useBooks();
  return useMemo(() => ({ overview: () => overview(g), profitLoss: (year: number) => profitLoss(g, year) }), [g]);
};
