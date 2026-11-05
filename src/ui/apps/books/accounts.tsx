// The books as accounts, shared by GnuCache's account tree and Thyme's chart of accounts: the bank, receivables and
// payables, then one account per ledger category, numbered after the German standard chart.
import { euroCents } from "../../../sim/00-core/money";
import type { LedgerEntry } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { formatDay } from "../billing/format";
import { sides, type Account } from "./data/accounts";

export { accountsOf, sides, yearOfHour, type Account, type Kind } from "./data/accounts";

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

