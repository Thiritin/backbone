import { HandCoins } from "lucide-react";
import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { annuity, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate, type Loan } from "../../../sim/45-billing/billing";
import { repayLoan, takeLoan } from "../../../sim/90-actions/billing";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { More } from "../More";
import { formatDay } from "../billing/format";
import "../shop/shop.css";
import "./bank.css";
import { t } from "../../../i18n/en";

const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const term = (y: number) => t("misc2.year", { n: y });

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
          <div className="seg" role="group" aria-label={t("misc2.term")}>
            {LOAN_YEARS.map((y) => <button key={y} aria-pressed={years === y} onClick={() => setYears(y)}>{term(y)}</button>)}
          </div>
          <span className="grow" />
          <span className="bank-limit">{t("misc2.available", { amount: euro(blocked ? 0 : limit) })}</span>
        </div>
        <div className="bank-scroll">
          {game.loans.length > 0 && <>
            <h3 className="bank-h">{t("misc2.yourLoans")}</h3>
            <div className="shop-grid">{game.loans.map((l) => <LoanCard key={l.id} loan={l} />)}</div>
          </>}
          <h3 className="bank-h">{t("misc2.offers")}</h3>
          <div className="shop-grid">
            {amounts.map((a) => <Offer key={a} amount={a} rate={rate} years={years} />)}
            {!amounts.length && (
              <div className="shop-none">
                {blocked ? t("misc2.lendsAgain", { date: formatDay(game.loansBlockedUntil) }) : t("misc2.limitUsed")}
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
        <div><dt>{t("misc2.interestRate")}</dt><dd className="num">{pct(rate)}</dd></div>
        <div><dt>{t("misc2.instalment")}</dt><dd className="num">{euroCents(payment)}</dd></div>
        <div><dt>{t("misc2.totalInterest")}</dt><dd className="num">{euroCents(payment * years * 12 - amount)}</dd></div>
        <div><dt>{t("misc2.instalments")}</dt><dd className="num">{years * 12}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <button className="btn primary" onClick={() => act(takeLoan, amount, years)}><HandCoins />{t("misc2.takeLoan")}</button>
      </div>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const act = useStore((s) => s.act);
  const menu = () => [{ label: t("misc2.repay"), run: () => act(repayLoan, loan.id) }];
  return (
    <div className="shop-card" onContextMenu={menuOn(menu)}>
      <div className="shop-name">
        <strong className="num bank-amount">{euro(loan.amount)}</strong>
        <span>{t("misc2.taken", { date: formatDay(loan.takenAt) })}</span>
      </div>
      <dl className="shop-specs">
        <div><dt>{t("misc2.remaining")}</dt><dd className="num">{euroCents(loan.balance)}</dd></div>
        <div><dt>{t("misc2.instalment")}</dt><dd className="num">{euroCents(loan.payment)}</dd></div>
        <div><dt>{t("misc2.instalmentsLeft")}</dt><dd className="num">{loan.left}</dd></div>
        <div><dt>{t("misc2.interestRate")}</dt><dd className="num">{pct(loan.rate)}</dd></div>
      </dl>
      <div className="shop-buy">
        <span className="grow" />
        <More label={t("misc2.loanOf", { amount: euro(loan.amount) })} entries={menu} />
      </div>
    </div>
  );
}
