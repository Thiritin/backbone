import { useMemo } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { setupOf } from "../../../../../sim/80-business/books-guide";
import { t } from "../../../../../i18n/en";
import { categoryLabel, CHART, useAccounts, type Account, type Kind } from "../../data";
import { useBooks } from "../../view";

export const KINDS: Kind[] = ["asset", "liability", "equity", "income", "expense"];
// Credit accounts show their sign turned, so income and debts read positive.
export const shown = (kind: Kind, v: number) => (kind === "asset" || kind === "expense" ? v : 0 - v);
export const money = (kind: Kind, v: number) => euroCents(shown(kind, v));
// The account type column: the three fixed accounts have their own types, the rest the kind.
export const typeKey = (a: Account) => (a.id === "bank" ? "bank" : a.id === "receivables" ? "receivable" : a.id === "payables" ? "payable" : a.kind);

// ponytail: the second standard chart renumbers by group offsets, not from a full template.
const no04 = (a: Account) => (a.id === "bank" ? 1800 : a.id === "receivables" ? 1200 : a.id === "payables" ? 3300 : a.kind === "income" ? a.no - 4000 : a.kind === "expense" ? a.no + 2000 : a.no);

// The accounts the program lists: once the company exists, the whole chart of the chosen template with the accounts
// that have no bookings yet at zero; before it, only the accounts with bookings.
export function useChart(): Account[] {
  const accounts = useAccounts(), game = useBooks();
  return useMemo(() => {
    const setup = setupOf(game);
    if (!setup.company) return accounts;
    const have = new Set(accounts.map((a) => a.id));
    const rest = Object.entries(CHART).filter(([c]) => !have.has(c))
      .map(([c, [no, kind]]): Account => ({ id: c, no, kind, label: c === "loans" ? t("books-screens.acc.loans") : categoryLabel(c), balance: 0, entries: [] }));
    return [...accounts, ...rest].map((a) => (setup.chart === "skr04" ? { ...a, no: no04(a) } : a)).sort((a, b) => a.no - b.no);
  }, [accounts, game]);
}
