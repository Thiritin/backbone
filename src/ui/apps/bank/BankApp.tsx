import { euro, euroCents } from "../../../sim/00-core/money";
import type { Loan } from "../../../sim/45-billing/billing";
import { repayLoan } from "../../../sim/90-actions/billing";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { More } from "../More";
import { formatDay } from "../billing/format";
import "../shop/shop.css";
import "./bank.css";
import { t } from "../../../i18n/en";

const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

// Finance lists the running loans; the bank's website offers new ones.
export function BankApp() {
  const game = useStore((s) => s.game);
  return (
    <div className="shop">
      <div className="shop-main">
        <div className="bank-scroll">
          <h3 className="bank-h">{t("misc2.yourLoans")}</h3>
          <div className="shop-grid">
            {game.loans.map((l) => <LoanCard key={l.id} loan={l} />)}
            {!game.loans.length && <div className="shop-none">{t("bank.finance.noLoans")}</div>}
          </div>
        </div>
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
