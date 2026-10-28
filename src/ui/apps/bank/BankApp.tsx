import { HandCoins, Landmark } from "lucide-react";
import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { annuity, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate } from "../../../sim/45-billing/billing";
import { repayLoan, takeLoan } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import "../billing/billing.css";

const CATEGORY: Record<string, string> = {
  payments: "Customer payments", hardware: "Hardware", rent: "Rent", power: "Power", transit: "Transit", salaries: "Salaries", loans: "Loans", tax: "Tax",
};
const monthKey = (hour: number) => dateOf(hour).toISOString().slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

export function BankApp() {
  const game = useStore((s) => s.game);
  const [month, setMonth] = useState("all");
  // Balance after each entry, counted back from current cash.
  let balance = game.cash;
  const rows = game.ledger.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
    const row = { e, i, balance };
    balance -= e.amount;
    return row;
  });
  const months = [...new Set(rows.map((r) => monthKey(r.e.hour)))];
  const shown = month === "all" ? rows : rows.filter((r) => monthKey(r.e.hour) === month);

  return (
    <div className="fin">
      <div className="fin-main">
        <div className="fin-toolbar">
          <h2>Account</h2>
          <span className="grow" />
          <select className="field" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
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
      <Loans />
    </div>
  );
}

function Loans() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const available = loanAvailable(game);
  const options = LOAN_AMOUNTS.filter((a) => a <= available);
  const [amount, setAmount] = useState(options[0] ?? 0);
  const [years, setYears] = useState(LOAN_YEARS[2]);
  const pick = options.includes(amount) ? amount : (options[0] ?? 0);
  const rate = loanRate(game);
  const payment = pick ? annuity(pick, rate, years * 12) : 0;
  const blocked = game.hour < game.loansBlockedUntil;

  return (
    <aside className="fin-detail" aria-label="Loans">
      <section className="fin-card">
        <h3 className="fin-card-h"><Landmark />Loans</h3>
        {game.loans.length === 0 ? <div className="fin-none">No loans</div> : game.loans.map((l) => (
          <div className="fin-loan" key={l.id}>
            <div className="fin-loan-h">
              <span className="num">{euro(l.amount)}</span>
              <span className="pill num">{pct(l.rate)}</span>
              <span className="grow" />
              <button className="btn" disabled={game.cash < l.balance} onClick={() => act((s) => repayLoan(s, l.id))}>Repay</button>
            </div>
            <dl className="fin-rows">
              <div><dt>Remaining</dt><dd className="num">{euroCents(l.balance)}</dd></div>
              <div><dt>Monthly instalment</dt><dd className="num">{euroCents(l.payment)}</dd></div>
              <div><dt>Instalments left</dt><dd className="num">{l.left}</dd></div>
            </dl>
          </div>
        ))}
      </section>
      <section className="fin-card">
        <h3 className="fin-card-h"><HandCoins />Take loan</h3>
        <div className="fin-card-b">
          <label className="fin-field">
            <span>Amount</span>
            <select className="field" value={pick} disabled={!options.length || blocked} onChange={(e) => setAmount(Number(e.target.value))}>
              {options.map((a) => <option key={a} value={a}>{euro(a)}</option>)}
            </select>
          </label>
          <label className="fin-field">
            <span>Term</span>
            <select className="field" value={years} disabled={blocked} onChange={(e) => setYears(Number(e.target.value))}>
              {LOAN_YEARS.map((y) => <option key={y} value={y}>{y} {y === 1 ? "year" : "years"}</option>)}
            </select>
          </label>
          <dl className="fin-rows">
            <div><dt>Available</dt><dd className="num">{euro(available)}</dd></div>
            <div><dt>Interest rate</dt><dd className="num">{pct(rate)}</dd></div>
            <div><dt>Monthly instalment</dt><dd className="num">{euroCents(payment)}</dd></div>
            <div><dt>Total interest</dt><dd className="num">{euroCents(payment * years * 12 - pick)}</dd></div>
            {blocked && <div><dt>Blocked until</dt><dd className="num">{formatDay(game.loansBlockedUntil)}</dd></div>}
          </dl>
          <button className="btn primary" disabled={!pick || blocked} onClick={() => act((s) => takeLoan(s, pick, years))}>Take loan</button>
        </div>
      </section>
    </aside>
  );
}
