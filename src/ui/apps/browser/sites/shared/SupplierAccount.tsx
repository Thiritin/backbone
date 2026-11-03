import { Fragment } from "react";
import { t } from "../../../../../i18n/en";
import { euroCents } from "../../../../../sim/00-core/money";
import { debitAllowed, overdue, PAY_METHODS, payMethod } from "../../../../../sim/46-finance/payables";
import type { GameState } from "../../../../../sim/50-state";
import { setPayMethod } from "../../../../../sim/90-actions/bank";
import { formatDay } from "../../../billing/format";
import { usePageAct } from "../../pageAct";
import "./supplier-account.css";

// How one supplier is paid, chosen on its site; each site passes its own class.
export function PayMethodPanel({ game, name, className, title = t("accounts.payMethod") }: { game: GameState; name: string; className?: string; title?: string }) {
  const act = usePageAct();
  if (!game.bank) return null;
  const now = payMethod(game, name);
  const off = { transfer: false, card: !game.bank.card, debit: !debitAllowed(name) };
  return (
    <fieldset className={`pay-methods ${className ?? ""}`}>
      <legend>{title}</legend>
      {PAY_METHODS.map((m) => (
        <label key={m} className={off[m] ? "off" : undefined}>
          <input type="radio" name={`pay-${name}`} checked={now === m} disabled={off[m]} onChange={() => act(setPayMethod, name, m)} />
          {t(`accounts.pay.${m}`)}
          {m === "debit" && off.debit && <small> ({t("accounts.germanyOnly")})</small>}
        </label>
      ))}
    </fieldset>
  );
}

// A supplier's invoices, newest first, each with its lines below it.
export function InvoiceTable({ game, name, className }: { game: GameState; name: string; className?: string }) {
  const bills = game.payables.filter((p) => p.name === name).reverse();
  if (!bills.length) return <p>{t("bank.pay.none")}</p>;
  return (
    <table className={className}>
      <thead><tr><th>{t("bank.pay.number")}</th><th>{t("accounts.issued")}</th><th>{t("bank.pay.due")}</th><th className="r">{t("bank.site.amount")}</th><th>{t("bank.pay.status")}</th></tr></thead>
      <tbody>
        {bills.map((p) => (
          <Fragment key={p.id}>
            <tr className="inv-head">
              <td className="num">{p.number}</td><td className="num">{formatDay(p.issuedAt)}</td><td className="num">{formatDay(p.dueAt)}</td><td className="r num">{euroCents(p.amount)}</td>
              <td className={overdue(game, p) ? "neg" : undefined}>{t(p.paidAt !== null ? "bank.pay.paid" : overdue(game, p) ? "bank.pay.overdue" : "bank.pay.open")}</td>
            </tr>
            {p.lines.map((e, i) => <tr key={i} className="inv-line"><td /><td colSpan={2}>{t(e.key, e.params)}</td><td className="r num">{euroCents(-e.amount)}</td><td /></tr>)}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
