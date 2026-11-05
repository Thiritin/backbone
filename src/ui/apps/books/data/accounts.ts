import { dateOf } from "../../../../sim/00-core/time";
import type { GameState, LedgerEntry } from "../../../../sim/50-state";
import { t } from "../../../../i18n/en";
import { categoryLabel, CHART, FIXED_NO } from "./chart";
import { openItems } from "./openItems";

export type Kind = "asset" | "liability" | "equity" | "income" | "expense";
// balance is debit minus credit. go: the tab that holds an account's open items instead of entries.
export interface Account { id: string; no: number; kind: Kind; label: string; balance: number; entries: LedgerEntry[]; go?: string }

export const yearOfHour = (hour: number) => dateOf(hour).getUTCFullYear();
const sum = (list: LedgerEntry[]) => list.reduce((a, e) => a + e.amount, 0);

// The accounts over one year's entries, or over all of them; the bank's balance is the one at that year's end.
export function accountsOf(s: GameState, year?: number): Account[] {
  const byCat = new Map<string, LedgerEntry[]>();
  const kept = year === undefined ? s.ledger : s.ledger.filter((e) => yearOfHour(e.hour) === year);
  for (const e of kept) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e]);
  const later = year === undefined ? 0 : sum(s.ledger.filter((e) => yearOfHour(e.hour) > year));
  const open = openItems(s);
  const fixed: Account[] = [
    { id: "bank", no: FIXED_NO.bank, kind: "asset", label: t("books-screens.acc.bank"), balance: s.cash - later, entries: kept },
    { id: "receivables", no: FIXED_NO.receivables, kind: "asset", label: t("books-screens.acc.receivables"), go: "invoices", balance: open.receivable, entries: [] },
    { id: "payables", no: FIXED_NO.payables, kind: "liability", label: t("books-screens.acc.payables"), go: "payables", balance: -open.payable, entries: [] },
  ];
  const cats = [...byCat].map(([c, entries]): Account => {
    const total = sum(entries), [no, kind] = CHART[c] ?? [total >= 0 ? 2700 : 4900, total >= 0 ? "income" : "expense"];
    return { id: c, no, kind, label: c === "loans" ? t("books-screens.acc.loans") : categoryLabel(c), balance: -total, entries };
  });
  return [...fixed, ...cats].sort((a, b) => a.no - b.no);
}

// Debit and credit of an entry seen from its account: money in debits the bank and credits a category, money out the reverse.
export const sides = (a: Account, e: LedgerEntry): [number, number] => {
  const debit = a.id === "bank" ? e.amount > 0 : e.amount < 0;
  return debit ? [Math.abs(e.amount), 0] : [0, Math.abs(e.amount)];
};
