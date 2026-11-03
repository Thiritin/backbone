import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { t } from "../../../i18n/en";
import { AccountSheet, accountsOf, sides, yearOfHour, type Account } from "./accounts";
import { arrowRows, useBooks } from "./view";

// Thyme writes a balance as an amount with its side.
const balance = (v: number) => (Math.abs(v) < 0.005 ? "" : `${euroCents(Math.abs(v))} ${t(v > 0 ? "books-screens.dr" : "books-screens.cr")}`);

// Thyme's chart of accounts: every account by number with the fiscal year's debits, credits and balance, and the
// selected account's sheet under it.
export function ChartTab({ go }: { go: (tab: string) => void }) {
  const game = useBooks();
  const now = yearOfHour(game.hour);
  const years = [...new Set([now, ...game.ledger.map((e) => yearOfHour(e.hour))])].sort((a, b) => b - a);
  const [year, setYear] = useState(now);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const all = accountsOf(game, year);
  const accounts = all.filter((a) => !q || String(a.no).startsWith(q) || a.label.toLowerCase().includes(q));
  const sel = accounts.find((a) => a.id === selected);
  const totals = (a: Account) => a.entries.reduce(([d, c], e) => { const [x, y] = sides(a, e); return [d + x, c + y]; }, [0, 0]);
  const no = (a: Account) => String(a.no).padStart(4, "0");
  const byCat = new Map(all.map((a) => [a.id, a]));
  return (
    <div className="bk-chart">
      <div className="fin-toolbar bk-chart-bar">
        <label>{t("books-screens.fiscalYear")}
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected(null); }}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        </label>
        <input type="search" aria-label={t("books-screens.search")} placeholder={t("books-screens.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="fin-scroll bk-chart-list" onKeyDown={arrowRows}>
        <table className="table fin-table">
          <thead><tr>
            <th>{t("books-screens.col.no")}</th><th>{t("books-screens.col.name")}</th>
            <th className="r">{t("books-screens.col.debit")}</th><th className="r">{t("books-screens.col.credit")}</th><th className="r">{t("books-screens.col.balance")}</th>
          </tr></thead>
          <tbody>
            {accounts.map((a) => {
              const [d, c] = totals(a);
              return (
                <tr key={a.id} className={a.id === selected ? "sel" : ""} tabIndex={0} onClick={() => setSelected(a.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(a.id)}>
                  <td className="num">{no(a)}</td><td>{a.label}</td>
                  <td className="r num">{d ? euroCents(d) : ""}</td><td className="r num">{c ? euroCents(c) : ""}</td><td className="r num">{balance(a.balance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel && (
        <section className="bk-chart-sheet">
          <h3>{t("books-screens.sheet", { no: no(sel), name: sel.label })}</h3>
          {sel.go ? <p><button className="btn" onClick={() => go(sel.go!)}>{t("books-screens.openItems")}</button></p>
            : <div className="fin-scroll"><AccountSheet a={sel} counter={(e) => (sel.id === "bank" ? no(byCat.get(e.category) ?? sel) : "1200")} show={balance} /></div>}
        </section>
      )}
    </div>
  );
}
