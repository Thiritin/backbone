import { HandCoins } from "lucide-react";
import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { annuity, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate, type Loan } from "../../../sim/45-billing/billing";
import { repayLoan, takeLoan } from "../../../sim/90-actions/billing";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import "../shop/shop.css";
import "./bank.css";

const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const term = (y: number) => `${y} ${y === 1 ? "year" : "years"}`;

export function BankApp() {
  const game = useStore((s) => s.game);
  const [years, setYears] = useState(LOAN_YEARS[2]);
  const limit = Math.floor(loanAvailable(game));
  const blocked = game.hour < game.loansBlockedUntil;
  const presets = LOAN_AMOUNTS.filter((a) => a <= limit);
  const amounts = blocked ? [] : limit > 0 && !presets.includes(limit) ? [...presets, limit] : presets;
  const rate = loanRate(game);

  return (
    <div className="shop">
      <div className="shop-main">
        <div className="shop-bar">
          <div className="seg" role="group" aria-label="Term">
            {LOAN_YEARS.map((y) => <button key={y} aria-pressed={years === y} onClick={() => setYears(y)}>{term(y)}</button>)}
          </div>
          <span className="grow" />
          <span className="bank-limit">Available <strong className="num">{euro(blocked ? 0 : limit)}</strong></span>
        </div>
        <div className="bank-scroll">
          {game.loans.length > 0 && <>
            <h3 className="bank-h">Your loans</h3>
            <div className="shop-grid">{game.loans.map((l) => <LoanCard key={l.id} loan={l} />)}</div>
          </>}
          <h3 className="bank-h">Offers</h3>
          <div className="shop-grid">
            {amounts.map((a) => <Offer key={a} amount={a} rate={rate} years={years} />)}
            {!amounts.length && (
              <div className="shop-none">
                {blocked ? `The bank lends again from ${formatDay(game.loansBlockedUntil)}.` : "Your loans use the whole limit."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Offer({ amount, rate, years }: { amount: number; rate: number; years: number }) {
  const act = useStore((s) => s.act);
  const payment = annuity(amount, rate, years * 12);
  return (
    <div className="shop-card">
      <div className="shop-name">
        <strong className="num bank-amount">{euro(amount)}</strong>
        <span>{term(years)}</span>
      </div>
      <dl className="shop-specs">
        <div><dt>Interest rate</dt><dd className="num">{pct(rate)}</dd></div>
        <div><dt>Monthly instalment</dt><dd className="num">{euroCents(payment)}</dd></div>
        <div><dt>Total interest</dt><dd className="num">{euroCents(payment * years * 12 - amount)}</dd></div>
        <div><dt>Instalments</dt><dd className="num">{years * 12}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <button className="btn primary" onClick={() => act((s) => takeLoan(s, amount, years))}><HandCoins />Take loan</button>
      </div>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const cash = useStore((s) => s.game.cash);
  const act = useStore((s) => s.act);
  return (
    <div className="shop-card">
      <div className="shop-name">
        <strong className="num bank-amount">{euro(loan.amount)}</strong>
        <span>Taken {formatDay(loan.takenAt)}</span>
      </div>
      <dl className="shop-specs">
        <div><dt>Remaining</dt><dd className="num">{euroCents(loan.balance)}</dd></div>
        <div><dt>Monthly instalment</dt><dd className="num">{euroCents(loan.payment)}</dd></div>
        <div><dt>Instalments left</dt><dd className="num">{loan.left}</dd></div>
        <div><dt>Interest rate</dt><dd className="num">{pct(loan.rate)}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <button className="btn" disabled={cash < loan.balance} onClick={() => act((s) => repayLoan(s, loan.id))}>Repay</button>
      </div>
    </div>
  );
}
