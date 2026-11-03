// The books as accounts, shared by GnuCache's account tree and Thyme's chart of accounts: the bank, receivables and
// payables, then one account per ledger category, numbered after the German standard chart.
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { isUnpaid, owed } from "../../../sim/45-billing/billing";
import type { GameState, LedgerEntry } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { formatDay } from "../billing/format";
import { categoryLabel } from "./Reports";

export type Kind = "asset" | "liability" | "equity" | "income" | "expense";
// balance is debit minus credit. go: the tab that holds an account's open items instead of entries.
export interface Account { id: string; no: number; kind: Kind; label: string; balance: number; entries: LedgerEntry[]; go?: string }

const NO: Record<string, [number, Kind]> = {
  transfers: [1360, "asset"], loans: [630, "liability"], vat: [1780, "liability"], capital: [800, "equity"],
  payments: [8400, "income"], setup: [8401, "income"], sales: [8402, "income"], credit: [2700, "income"],
  salaries: [4120, "expense"], rent: [4210, "expense"], power: [4240, "expense"], tax: [4320, "expense"], insurance: [4360, "expense"],
  marketing: [4600, "expense"], maintenance: [4805, "expense"], leasing: [4810, "expense"], hardware: [4855, "expense"],
  transit: [4920, "expense"], domains: [4925, "expense"], subscriptions: [4964, "expense"], licenses: [4965, "expense"], fees: [4970, "expense"],
};
const EPS = 0.005;
export const yearOfHour = (hour: number) => dateOf(hour).getUTCFullYear();
const sum = (list: LedgerEntry[]) => list.reduce((a, e) => a + e.amount, 0);

// The accounts over one year's entries, or over all of them; the bank's balance is the one at that year's end.
export function accountsOf(s: GameState, year?: number): Account[] {
  const byCat = new Map<string, LedgerEntry[]>();
  const kept = year === undefined ? s.ledger : s.ledger.filter((e) => yearOfHour(e.hour) === year);
  for (const e of kept) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e]);
  const later = year === undefined ? 0 : sum(s.ledger.filter((e) => yearOfHour(e.hour) > year));
  const fixed: Account[] = [
    { id: "bank", no: 1200, kind: "asset", label: t("books-screens.acc.bank"), balance: s.cash - later, entries: kept },
    { id: "receivables", no: 1400, kind: "asset", label: t("books-screens.acc.receivables"), go: "invoices",
      balance: s.invoices.filter(isUnpaid).reduce((a, i) => a + owed(i), 0), entries: [] },
    { id: "payables", no: 1600, kind: "liability", label: t("books-screens.acc.payables"), go: "payables",
      balance: -s.payables.filter((p) => p.booked < p.amount - EPS).reduce((a, p) => a + p.amount - p.booked, 0), entries: [] },
  ];
  const cats = [...byCat].map(([c, entries]): Account => {
    const total = sum(entries), [no, kind] = NO[c] ?? [total >= 0 ? 2700 : 4900, total >= 0 ? "income" : "expense"];
    return { id: c, no, kind, label: c === "loans" ? t("books-screens.acc.loans") : categoryLabel(c), balance: -total, entries };
  });
  return [...fixed, ...cats].sort((a, b) => a.no - b.no);
}

// Debit and credit of an entry seen from its account: money in debits the bank and credits a category, money out the reverse.
export const sides = (a: Account, e: LedgerEntry): [number, number] => {
  const debit = a.id === "bank" ? e.amount > 0 : e.amount < 0;
  return debit ? [Math.abs(e.amount), 0] : [0, Math.abs(e.amount)];
};

// ponytail: the latest SHOWN entries only, a date filter once accounts run to thousands of lines.
const SHOWN = 300;

// One account's entries with the running balance, newest first; counter names the account on the other side and show
// writes a debit-minus-credit balance the program's way.
export function AccountSheet({ a, counter, show }: { a: Account; counter: (e: LedgerEntry) => string; show: (v: number) => string }) {
  let run = a.balance - a.entries.reduce((x, e) => { const [d, c] = sides(a, e); return x + d - c; }, 0);
  const lines = a.entries.map((e) => {
    const [d, c] = sides(a, e);
    run += d - c;
    return { e, d, c, run };
  }).reverse().slice(0, SHOWN);
  const money = (v: number) => (v ? euroCents(v) : "");
  return (
    <table className="table fin-table bk-sheet">
      <thead><tr>
        <th>{t("books.col.date")}</th><th>{t("books-screens.col.text")}</th><th>{t("books-screens.col.counter")}</th>
        <th className="r">{t("books-screens.col.debit")}</th><th className="r">{t("books-screens.col.credit")}</th><th className="r">{t("books-screens.col.balance")}</th>
      </tr></thead>
      <tbody>
        {lines.map(({ e, d, c, run }, i) => (
          <tr key={i}>
            <td className="num">{formatDay(e.hour)}</td>
            <td className="books-ref" title={t(e.key, e.params)}>{t(e.key, e.params)}</td>
            <td>{counter(e)}</td>
            <td className="r num">{money(d)}</td>
            <td className="r num">{money(c)}</td>
            <td className="r num">{show(run)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

