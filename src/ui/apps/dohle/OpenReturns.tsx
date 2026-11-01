import { t } from "../../../i18n/en";
import { period } from "../../../i18n/tax";
import { euroCents } from "../../../sim/00-core/money";
import { taxFor } from "../../../sim/46-finance/finance";
import type { GameState } from "../../../sim/50-state";
import { monthsOf, type TaxReturn, vatBetween } from "../../../sim/80-business/tax";
import { paperDay } from "../FormDoc";

// What a return will cost: the period's VAT payable, or the income tax on the year's profit.
export const owed = (game: GameState, r: TaxReturn): number => (r.kind === "vat" ? vatBetween(game, r.from, r.to).payable : taxFor(game, r.year).tax);

// The returns still to file, oldest first; Finance and Books show the same list.
export function OpenReturns({ game }: { game: GameState }) {
  const open = game.tax.returns.filter((r) => r.filedAt === null);
  return (
    <table className="table">
      <thead>
        <tr><th>{t("ui-tax.formular.return")}</th><th>{t("ui-tax.formular.period")}</th><th>{t("ui-tax.formular.due")}</th><th className="r">{t("ui-tax.returns.owed")}</th><th>{t("bank.pay.status")}</th></tr>
      </thead>
      <tbody>
        {open.map((r) => (
          <tr key={r.id}>
            <td>{t(`ui-tax.formular.kind.${r.kind}`)}</td>
            <td>{period({ from: r.from, months: monthsOf(r) })}</td>
            <td className="num">{paperDay(r.dueAt - 24)}</td>
            <td className="r num">{euroCents(owed(game, r))}</td>
            <td className={game.hour >= r.dueAt ? "neg" : undefined}>{t(game.hour >= r.dueAt ? "bank.pay.overdue" : "bank.pay.open")}</td>
          </tr>
        ))}
        {!open.length && <tr><td colSpan={5}>{t("ui-tax.formular.none")}</td></tr>}
      </tbody>
    </table>
  );
}
