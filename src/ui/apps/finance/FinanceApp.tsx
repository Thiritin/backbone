import { CalendarDays, Landmark, Layers } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import "../billing/billing.css";

const CATEGORY: Record<string, string> = {
  payments: "Customer payments", hardware: "Hardware", rent: "Rent", power: "Power", transit: "Transit", salaries: "Salaries", loans: "Loans", tax: "Tax", subscriptions: "Pear One",
};
const monthKey = (hour: number) => dateOf(hour).toISOString().slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function FinanceApp() {
  const game = useStore((s) => s.game);
  const [month, setMonth] = useState<string | null>(null);
  // Balance after each entry, counted back from current cash.
  let balance = game.cash;
  const rows = game.ledger.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
    const row = { e, i, balance };
    balance -= e.amount;
    return row;
  });
  const months = [...new Set(rows.map((r) => monthKey(r.e.hour)))];
  const count = (m: string) => rows.filter((r) => monthKey(r.e.hour) === m).length;
  const shown = month ? rows.filter((r) => monthKey(r.e.hour) === month) : rows;

  return (
    <div className="fin">
      <aside className="sidebar fin-side" aria-label="Months">
        <div className="side-h">Statement</div>
        <button className={`side-item${!month ? " active" : ""}`} aria-pressed={!month} onClick={() => setMonth(null)}>
          <Layers />All months<span className="side-count">{rows.length}</span>
        </button>
        {months.map((m) => (
          <button key={m} className={`side-item${month === m ? " active" : ""}`} aria-pressed={month === m} onClick={() => setMonth(m)}>
            <CalendarDays />{monthLabel(m)}<span className="side-count">{count(m)}</span>
          </button>
        ))}
      </aside>
      <div className="fin-main">
        <div className="fin-toolbar">
          <h2>Account</h2>
          <span className="grow" />
          <span className="num">{euroCents(game.cash)}</span>
        </div>
        <div className="fin-scroll">
          {shown.length === 0 ? (
            <div className="fin-empty"><Landmark />No bookings</div>
          ) : (
            <table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Text</th><th className="r">Amount</th><th className="r">Balance</th></tr></thead>
              <tbody>
                {shown.map(({ e, i, balance }) => (
                  <tr key={i}>
                    <td className="num">{formatDay(e.hour)}</td>
                    <td>{CATEGORY[e.category] ?? e.category}</td>
                    <td className="fin-text">{t(e.key, e.params)}</td>
                    <td className="r num">{euroCents(e.amount)}</td>
                    <td className="r num">{euroCents(balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
